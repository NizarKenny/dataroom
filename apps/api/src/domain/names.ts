import { badRequest } from '../errors.js'

const MAX_LENGTH = 255

// What a desktop file manager refuses, plus control characters. The slash is the
// one that matters most: names are shown in breadcrumbs and in the manifest a
// delete puts up, and a name carrying a separator reads as a path that is not real.
const ILLEGAL = /[\/:*?"<>|\u0000-\u001f]/

export function cleanName(raw: string): string {
  const name = raw.trim()
  if (name.length === 0) throw badRequest('A name cannot be empty')
  if (name.length > MAX_LENGTH) {
    throw badRequest(`A name cannot be longer than ${MAX_LENGTH} characters`)
  }
  if (ILLEGAL.test(name)) throw badRequest('A name cannot contain \ / : * ? " < > |')
  if (name === '.' || name === '..') throw badRequest(`"${name}" is not a usable name`)
  return name
}

export function splitExtension(name: string): [stem: string, extension: string] {
  const dot = name.lastIndexOf('.')
  return dot > 0 ? [name.slice(0, dot), name.slice(dot)] : [name, '']
}

/**
 * "Report.pdf" becomes "Report (2).pdf" when the name is taken. This is what the
 * upload queue offers as "keep both", and what a rename falls back to.
 */
export function nextFreeName(name: string, taken: Set<string>): string {
  if (!taken.has(name)) return name

  const [stem, extension] = splitExtension(name)
  // One more candidate than there are taken names, so one of them is free.
  for (let n = 2; n <= taken.size + 2; n++) {
    const candidate = `${stem} (${n})${extension}`
    if (!taken.has(candidate)) return candidate
  }
  throw badRequest(`There are too many files called "${name}" here`)
}
