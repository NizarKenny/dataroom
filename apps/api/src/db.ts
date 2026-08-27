import { PrismaClient } from '@prisma/client'
import { v7 as uuidv7 } from 'uuid'

export const prisma = new PrismaClient()

/**
 * v7 rather than v4: the ids end up in URLs and in every folder path, so they have
 * to be unguessable, but they are also primary keys on tables that grow, and random
 * ids scatter btree inserts across the whole index. v7 is time-ordered, so it keeps
 * inserts at the right edge while still being opaque.
 */
export const newId = (): string => uuidv7()
