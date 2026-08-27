import { Prisma, PrismaClient } from '@prisma/client'
import { v7 as uuidv7 } from 'uuid'
import { nameTaken } from './errors.js'

export const prisma = new PrismaClient()

/**
 * v7 rather than v4: the ids end up in URLs and in every folder path, so they have
 * to be unguessable, but they are also primary keys on tables that grow, and random
 * ids scatter btree inserts across the whole index. v7 is time-ordered, so it keeps
 * inserts at the right edge while still being opaque.
 */
export const newId = (): string => uuidv7()

/**
 * Sibling names are unique in the database, and that index is the only honest
 * arbiter: checking first and inserting second loses the race against a second
 * upload of the same name. So the write goes ahead and the rejection is translated.
 */
export async function withUniqueName<T>(
  what: 'file' | 'folder',
  name: string,
  write: () => Promise<T>,
): Promise<T> {
  try {
    return await write()
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw nameTaken(what, name)
    }
    throw error
  }
}
