import { d } from '@/lib/dictionary'
import type { Phrase } from '@/lib/i18n'
import { useSyncExternalStore } from 'react'

export type ColumnId = 'access' | 'size' | 'modified'

/**
 * The columns a reader can arrange. Name is not here because it is the row
 * itself, and the row menu is not here because it is anchored to the end.
 */
export const COLUMNS: { id: ColumnId; label: Phrase }[] = [
  { id: 'access', label: d.columns.access },
  { id: 'size', label: d.common.size },
  { id: 'modified', label: d.columns.modified },
]

/**
 * Where a dropped column lands. Which side of the target it takes depends on the
 * direction of travel: rightwards lands after it, leftwards before it. Always
 * inserting before instead means dragging the first column onto the second does
 * nothing at all, because before the second is where it already was.
 */
export function orderAfterDrop(order: ColumnId[], id: ColumnId, target: ColumnId): ColumnId[] {
  const from = order.indexOf(id)
  const to = order.indexOf(target)
  if (from < 0 || to < 0 || from === to) return order

  const rest = order.filter((other) => other !== id)
  const at = rest.indexOf(target) + (from < to ? 1 : 0)
  return [...rest.slice(0, at), id, ...rest.slice(at)]
}

export interface Layout {
  order: ColumnId[]
  hidden: ColumnId[]
  /** Locked, the headers sort. Unlocked, they are handles. Not both at once. */
  unlocked: boolean
}

const KEY = 'dataroom.columns'
const DEFAULT: Layout = { order: ['access', 'size', 'modified'], hidden: [], unlocked: false }

const known = new Set(COLUMNS.map((column) => column.id))
const isColumn = (value: unknown): value is ColumnId =>
  typeof value === 'string' && known.has(value as ColumnId)

/**
 * Anything stored can have been written by an older build or edited by hand, so
 * it is filtered against what exists and topped up with what it is missing. A
 * column added later therefore appears rather than vanishing.
 */
function read(): Layout {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Partial<Layout> | null
    if (!saved) return DEFAULT

    const order = (saved.order ?? []).filter(isColumn)
    const hidden = (saved.hidden ?? []).filter(isColumn)
    return {
      order: [...order, ...DEFAULT.order.filter((id) => !order.includes(id))],
      hidden,
      // Deliberately not remembered: rearranging is something you do once and
      // then stop doing, and a table that is still wobbling tomorrow is a table
      // that will get rearranged by accident.
      unlocked: false,
    }
  } catch {
    return DEFAULT
  }
}

// One layout for the whole app, the way the theme is, so a table and the menu
// that arranges it can never disagree.
let layout = read()
const listeners = new Set<() => void>()

function write(next: Layout) {
  layout = next
  localStorage.setItem(KEY, JSON.stringify(next))
  for (const listener of listeners) listener()
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useColumns() {
  const current = useSyncExternalStore(subscribe, () => layout)

  return {
    layout: current,
    unlocked: current.unlocked,

    toggleLock() {
      write({ ...current, unlocked: !current.unlocked })
    },

    /** In the reader's order, with the switched off ones left out. */
    visible: current.order.filter((id) => !current.hidden.includes(id)),

    toggle(id: ColumnId) {
      write({
        ...current,
        hidden: current.hidden.includes(id)
          ? current.hidden.filter((other) => other !== id)
          : [...current.hidden, id],
      })
    },

    moveTo(id: ColumnId, target: ColumnId) {
      write({ ...current, order: orderAfterDrop(current.order, id, target) })
    },

    /** The same move one step at a time, for anyone not using a mouse. */
    nudge(id: ColumnId, by: -1 | 1) {
      const at = current.order.indexOf(id)
      const to = at + by
      if (at < 0 || to < 0 || to >= current.order.length) return
      const order = [...current.order]
      const [moved] = order.splice(at, 1)
      order.splice(to, 0, moved!)
      write({ ...current, order })
    },

    reset() {
      localStorage.removeItem(KEY)
      write({ ...DEFAULT, unlocked: current.unlocked })
    },

    isDefault: current.hidden.length === 0 && current.order.join() === DEFAULT.order.join(),
  }
}
