// A folder's place in the tree is stored as a materialized path of ancestor ids,
// slash-delimited and slash-terminated: "/<root>/<child>/<self>/".
//
// Ids rather than names, so renaming a folder never rewrites its subtree. The
// trailing separator matters: without it "/a/" would prefix-match "/ab/".

const SEP = '/'

export function rootPath(id: string): string {
  return `${SEP}${id}${SEP}`
}

export function childPath(parentPath: string, id: string): string {
  return `${parentPath}${id}${SEP}`
}

export function segments(path: string): string[] {
  return path.split(SEP).filter(Boolean)
}

export function depthOf(path: string): number {
  return segments(path).length - 1
}

export function parentPathOf(path: string): string | null {
  const parts = segments(path)
  if (parts.length <= 1) return null
  return `${SEP}${parts.slice(0, -1).join(SEP)}${SEP}`
}

/**
 * Every path from the root down to the node itself. Used to ask "is this node
 * shared, or is any folder above it shared" as a single `resource_path in (...)`
 * lookup instead of walking the tree.
 */
export function ancestorPaths(path: string): string[] {
  const parts = segments(path)
  return parts.map((_, i) => `${SEP}${parts.slice(0, i + 1).join(SEP)}${SEP}`)
}

/**
 * LIKE pattern selecting a folder and everything under it. Paths only ever hold
 * hex, dashes and separators, so there is nothing to escape.
 */
export function subtreePattern(path: string): string {
  return `${path}%`
}
