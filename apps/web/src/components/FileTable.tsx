import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ColumnsMenu } from '@/components/ColumnsMenu'
import type { AccessBadge, FileRow, FolderRow } from '@/lib/api'
import { COLUMNS, useColumns, type ColumnId } from '@/lib/columns'
import { d } from '@/lib/dictionary'
import { useT } from '@/lib/i18n'
import { formatBytes, formatWhen } from '@/lib/format'
import { cn } from '@/lib/utils'
import {
  Download,
  File as FileIcon,
  FileSpreadsheet,
  FileText,
  Folder,
  History,
  Image,
  MoreHorizontal,
  Pencil,
  Share2,
  Trash2,
} from 'lucide-react'
import { useState } from 'react'

export type Row = ({ kind: 'folder' } & FolderRow) | ({ kind: 'file' } & FileRow)

export interface RowActions {
  rename: (row: Row) => void
  move: (row: Row) => void
  share: (row: Row) => void
  remove: (row: Row) => void
  download: (row: Row) => void
  history: (row: Row) => void
}

interface Props {
  rows: Row[]
  onOpen: (row: Row) => void
  /** Left out for anyone who is only reading, which also hides the whole column. */
  actions?: RowActions
}

export function FileTable({ rows, onOpen, actions }: Props) {
  const t = useT()
  const columns = useColumns()
  const [dragging, setDragging] = useState<ColumnId | null>(null)
  const [over, setOver] = useState<ColumnId | null>(null)

  // Present for an owner even when empty: a column that comes and goes between
  // sibling folders moves every column after it under the reader's cursor.
  // A reader is sent no access data at all, so for them it is not there.
  const showAccess = rows.some((row) => row.access !== null)
  const shown = columns.visible.filter((id) => id !== 'access' || showAccess)

  function drop(onto: ColumnId) {
    if (dragging) columns.moveTo(dragging, onto)
    setDragging(null)
    setOver(null)
  }

  return (
    // The columns have a floor below which they crush rather than reflow, so on a
    // narrow screen the table scrolls sideways and the page does not.
    <div className="overflow-x-auto">
      <table className="w-full min-w-[540px] border-collapse">
        <thead>
          <tr>
            <Th className="w-full">{t(d.common.name)}</Th>

            {shown.map((id) => (
              <Th
                key={id}
                draggable
                onDragStart={() => setDragging(id)}
                onDragEnd={() => {
                  setDragging(null)
                  setOver(null)
                }}
                onDragOver={(event) => {
                  event.preventDefault()
                  setOver(id)
                }}
                onDragLeave={() => setOver((current) => (current === id ? null : current))}
                onDrop={() => drop(id)}
                // Label and values share one axis down the middle of the
                // column. Ranged left or right they hang off an edge instead,
                // and a column of "just now" over "22 minutes ago" then drifts
                // by the difference between them on every row.
                className={cn(
                  'min-w-[104px] cursor-grab text-center select-none',
                  dragging === id && 'opacity-45',
                  over === id && dragging !== id && 'bg-primary-wash text-primary-active',
                )}
              >
                {t(COLUMNS.find((column) => column.id === id)!.label)}
              </Th>
            ))}

            {/* Arranging the columns is the reader's, not the owner's: a link
                holder reads the same table and can want the same order. */}
            <Th aria-label={t(d.columns.arrange)} className="pr-3 pl-0 text-right">
              <ColumnsMenu />
            </Th>
          </tr>
        </thead>

        <tbody>
          {rows.map((row) => (
            <tr
              key={row.id}
              className="group border-b border-hairline last:border-b-0 hover:bg-sunken"
            >
              <td
                className={cn(
                  'px-4 py-[13px]',
                  // The signature: a row whose access was granted somewhere above it
                  // carries the rail, so inherited reach is visible without opening
                  // anything.
                  row.access?.inherited &&
                    "relative before:absolute before:inset-y-0 before:left-0 before:w-0.5 before:bg-primary before:content-['']",
                )}
              >
                <button
                  onClick={() => onOpen(row)}
                  className="flex w-full items-center gap-2.5 text-left"
                >
                  <RowIcon row={row} />
                  <span className="truncate">{row.name}</span>
                </button>
              </td>

              {shown.map((id) =>
                id === 'access' ? (
                  <td key={id} className="px-4 py-[13px] text-center whitespace-nowrap">
                    {row.access && <AccessChips access={row.access} />}
                  </td>
                ) : (
                  <td
                    key={id}
                    className="tabular px-4 py-[13px] text-center text-[13px] whitespace-nowrap text-ink-muted"
                  >
                    {id === 'size'
                      ? row.kind === 'file'
                        ? formatBytes(row.sizeBytes)
                        : ''
                      : formatWhen(row.updatedAt)}
                  </td>
                ),
              )}

              <td className="py-[13px] pr-3 pl-0">
                {actions && <RowMenu row={row} actions={actions} />}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function Th({ className, children, ...props }: React.ComponentProps<'th'>) {
  return (
    <th
      className={cn(
        'border-b border-hairline px-4 py-2.5 text-left text-xs font-semibold tracking-[0.125px] whitespace-nowrap text-ink-faint uppercase',
        className,
      )}
      {...props}
    >
      {children}
    </th>
  )
}

function RowIcon({ row }: { row: Row }) {
  if (row.kind === 'folder') return <Folder className="size-4 shrink-0 text-secondary" />

  const type = row.mimeType
  const Icon = type.startsWith('image/')
    ? Image
    : type.includes('csv') || type.includes('sheet') || type.includes('excel')
      ? FileSpreadsheet
      : type === 'application/pdf' || type.startsWith('text/')
        ? FileText
        : FileIcon

  return <Icon className="size-4 shrink-0 text-ink-faint" />
}

/**
 * Only what was granted on this row itself. Access that came from above is drawn
 * by the rail and explained once by the banner over the table, so repeating it
 * here would be the same fact three times.
 *
 * A row nothing reaches says so. A column of blanks reads as one that failed to
 * load, rather than as a room where most things are private.
 */
const grantedHere = (access: AccessBadge) => access.here.people > 0 || access.here.link

function AccessChips({ access }: { access: AccessBadge }) {
  const t = useT()

  if (!grantedHere(access)) {
    return (
      <Chip className="bg-sunken text-ink-muted">
        {t(access.inherited ? d.columns.inherited : d.columns.private)}
      </Chip>
    )
  }

  const { people, link } = access.here
  return (
    <span className="flex items-center justify-center gap-1.5">
      {link && (
        <Chip className="bg-primary-wash text-primary-active">
          <Dot />
          Link
        </Chip>
      )}
      {people > 0 && (
        <Chip className="bg-secondary-wash text-secondary">
          <Dot />
          {t(d.access.peopleCount(people))}
        </Chip>
      )}
    </span>
  )
}

function Chip({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-[3px] text-xs font-semibold tracking-[0.125px]',
        className,
      )}
    >
      {children}
    </span>
  )
}

const Dot = () => <i className="size-[5px] rounded-full bg-current" />

function RowMenu({ row, actions }: { row: Row; actions: RowActions }) {
  const t = useT()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="utility"
          size="icon"
          className="text-ink-faint opacity-0 group-hover:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100"
          aria-label={t(d.columns.actionsFor(row.name))}
        >
          <MoreHorizontal />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-44">
        {row.kind === 'file' && (
          <>
            <DropdownMenuItem onSelect={() => actions.download(row)}>
              <Download />
              {t(d.common.download)}
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => actions.history(row)}>
              <History />
              {t(d.columns.history)}
            </DropdownMenuItem>
          </>
        )}
        <DropdownMenuItem onSelect={() => actions.share(row)}>
          <Share2 />
          {t(d.common.share)}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => actions.rename(row)}>
          <Pencil />
          {t(d.common.rename)}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => actions.move(row)}>
          {t(d.columns.moveTo)}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onSelect={() => actions.remove(row)}>
          <Trash2 />
          {t(d.common.delete)}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
