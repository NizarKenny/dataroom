import { describe, expect, it } from 'vitest'
import { cleanName, nextFreeName, splitExtension, versionedName } from './names.js'

describe('cleanName', () => {
  it('trims the edges', () => {
    expect(cleanName('  Financials  ')).toBe('Financials')
  })

  it('keeps the spaces and dots inside a name', () => {
    expect(cleanName('Q4 2025 report.final.pdf')).toBe('Q4 2025 report.final.pdf')
  })

  it('refuses a name that is only whitespace', () => {
    expect(() => cleanName('   ')).toThrow(/cannot be empty/)
  })

  // A name holding a separator would read as a path in the breadcrumbs, and the
  // paths in this app are built from ids rather than names.
  it('refuses separators', () => {
    expect(() => cleanName('Legal/NDA')).toThrow(/cannot contain/)
    expect(() => cleanName('C:\Users')).toThrow(/cannot contain/)
  })

  it('refuses the two names that mean somewhere else', () => {
    expect(() => cleanName('.')).toThrow()
    expect(() => cleanName('..')).toThrow()
  })

  it('refuses control characters', () => {
    expect(() => cleanName('report\u0007.pdf')).toThrow(/cannot contain/)
  })
})

describe('splitExtension', () => {
  it('splits on the last dot', () => {
    expect(splitExtension('report.final.pdf')).toEqual(['report.final', '.pdf'])
  })

  it('treats a name with no dot as all stem', () => {
    expect(splitExtension('Financials')).toEqual(['Financials', ''])
  })

  // A leading dot names a hidden file, it does not introduce an extension.
  it('does not split a dotfile', () => {
    expect(splitExtension('.gitignore')).toEqual(['.gitignore', ''])
  })
})

describe('nextFreeName', () => {
  it('leaves a free name alone', () => {
    expect(nextFreeName('report.pdf', new Set())).toBe('report.pdf')
  })

  it('numbers before the extension, not after it', () => {
    expect(nextFreeName('report.pdf', new Set(['report.pdf']))).toBe('report (2).pdf')
  })

  it('keeps counting past the numbers already there', () => {
    const taken = new Set(['report.pdf', 'report (2).pdf', 'report (3).pdf'])
    expect(nextFreeName('report.pdf', taken)).toBe('report (4).pdf')
  })

  it('numbers a name with no extension', () => {
    expect(nextFreeName('Financials', new Set(['Financials']))).toBe('Financials (2)')
  })
})

describe('versionedName', () => {
  it('marks the version before the extension', () => {
    expect(versionedName('Management accounts.pdf', 3)).toBe('Management accounts (v3).pdf')
  })

  it('marks a name with no extension', () => {
    expect(versionedName('Disclosure schedule', 2)).toBe('Disclosure schedule (v2)')
  })

  it('does not mistake a leading dot for an extension', () => {
    expect(versionedName('.gitignore', 2)).toBe('.gitignore (v2)')
  })
})
