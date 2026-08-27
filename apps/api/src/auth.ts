import type { FastifyRequest } from 'fastify'
import { createRemoteJWKSet, jwtVerify } from 'jose'
import { prisma } from './db.js'
import { env } from './env.js'
import { unauthorized } from './errors.js'
import type { Viewer } from './permissions.js'

// Supabase signs access tokens with an asymmetric key and publishes the public half,
// so the API verifies signatures without holding a shared secret. jose caches the
// key set and refetches on rotation.
const jwks = createRemoteJWKSet(new URL(`${env.SUPABASE_URL}/auth/v1/.well-known/jwks.json`))

export interface Principal {
  userId: string
  email: string
}

declare module 'fastify' {
  interface FastifyRequest {
    /** Filled in by the authenticate hook, and null on the public link routes. */
    principal: Principal | null
  }
}

export async function verifyAccessToken(token: string): Promise<Principal> {
  let payload
  try {
    ;({ payload } = await jwtVerify(token, jwks, {
      issuer: `${env.SUPABASE_URL}/auth/v1`,
      audience: 'authenticated',
    }))
  } catch {
    throw unauthorized('Your session has expired')
  }

  const userId = payload.sub
  const email = typeof payload.email === 'string' ? payload.email.toLowerCase() : null
  if (!userId || !email) throw unauthorized()

  return { userId, email }
}

// One write per account per process. The mirror row only has to be created once,
// and the claim below only ever finds anything on the first sign-in after an
// invitation, so repeating both on every request would be work for nothing.
const mirrored = new Set<string>()

/**
 * Mirrors the signed-in account into our own users table. Also claims any share
 * that was addressed to this email before the person had an account, which is how
 * an invitation sent to a stranger turns into access the moment they sign in.
 */
export async function ensurePrincipal(principal: Principal): Promise<void> {
  if (mirrored.has(principal.userId)) return

  await prisma.$transaction([
    prisma.user.upsert({
      where: { id: principal.userId },
      create: { id: principal.userId, email: principal.email },
      update: { email: principal.email },
    }),
    prisma.share.updateMany({
      where: { granteeEmail: principal.email, granteeUserId: null, revokedAt: null },
      data: { granteeUserId: principal.userId },
    }),
  ])

  mirrored.add(principal.userId)
}

export function bearerToken(header: string | undefined): string | null {
  if (!header) return null
  const [scheme, token] = header.split(' ')
  return scheme?.toLowerCase() === 'bearer' && token ? token : null
}

export async function authenticate(request: FastifyRequest): Promise<void> {
  const token = bearerToken(request.headers.authorization)
  if (!token) throw unauthorized()

  const principal = await verifyAccessToken(token)
  await ensurePrincipal(principal)
  request.principal = principal
}

export function principalOf(request: FastifyRequest): Principal {
  if (!request.principal) throw unauthorized()
  return request.principal
}

export const viewerOf = (request: FastifyRequest): Viewer => ({
  kind: 'user',
  userId: principalOf(request).userId,
})
