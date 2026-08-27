import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { AccessBadge, FileRow, FolderRow } from '@/lib/api'
import { formatBytes, formatWhen } from '@/lib/format'
import { cn } from '@/lib/utils'
import {
  Download,
  File as FileIcon,
  FileSpreadsheet,
  FileText,
  Folder,
  Image,
  MoreHorizontal,
  Pencil,
  Share2,
  Trash2,
} from 'lucide-react'

export type Row =
  | ({ kind: 'folder' } & FolderRow)
  | ({ kind: 'file' } & FileRow)

export interface RowActions {
  rename: (row: Row) => void
  move: (row: Row) => void
  share: (row: Row) => void
  remove: (row: Row) => void
  download: (row: Row) => void
}

interface Props {
  rows: Row[]
  onOpen: (row: Row) => void
  /** Left out for anyone who is only reading, which also hides the whole column. */
  actions?: RowActions
}

export function FileTable({ rows, onOpen, actions }: Props) {
  // The column carries what was granted on a row itself. When nothing here was,
  // it has nothing to say: readers are sent no access data at all, and a folder
  // whose rows only inherit is already explained by the banner and the rails.
  const showAccess = rows.some((row) => row.access?.direct)

  return (
    // The columns have a floor below which they crush rather than reflow, so on a
    // narrow screen the table scrolls sideways and the page does not.
    <div className="overflow-x-auto">
      <table className="w-full min-w-[540px] border-collapse">
        <thead>
          <tr>
            <Th className="w-full">Name</Th>
            {showAccess && <Th>Access</Th>}
            <Th className="text-right">Size</Th>
            <Th className="text-right">Modified</Th>
            {actions && <Th aria-label="Actions" />}
          </tr>
        </thead>

        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="group border-b border-hairline last:border-b-0 hover:bg-sunken">
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

              {showAccess && (
                <td className="px-4 py-[13px] whitespace-nowrap">
                  {row.access && <AccessChips access={row.access} />}
                </td>
              )}

              <td className="tabular px-4 py-[13px] text-right text-[13px] whitespace-nowrap text-ink-muted">
                {row.kind === 'file' ? formatBytes(row.sizeBytes) : ''}
              </td>

              <td className="tabular px-4 py-[13px] text-right text-[13px] whitespace-nowrap text-ink-muted">
                {formatWhen(row.updatedAt)}
              </td>

              {actions && (
                <td className="py-[13px] pr-3 pl-0">
                  <RowMenu row={row} actions={actions} />
                </td>
              )}
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
    : type === 'application/pdf' || type.startsWith('text/')
      ? FileText
      : type.includes('sheet') || type.includes('csv')
        ? FileSpreadsheet
        : FileIcon

  return <Icon className="size-4 shrink-0 text-ink-faint" />
}

/**
 * Only what was granted on this row itself. Access that came from above is drawn
 * by the rail and explained once by the banner over the table, so repeating it
 * here would be the same fact three times.
 */
function AccessChips({ access }: { access: AccessBadge }) {
  if (!access.direct) return null

  return (
    <span className="flex items-center gap-1.5">
      {access.link && (
        <Chip className="bg-primary-wash text-primary-active">
          <Dot />
          Link
        </Chip>
      )}
      {access.people > 0 && (
        <Chip className="bg-secondary-wash text-secondary">
          <Dot />
          {access.people} {access.people === 1 ? 'person' : 'people'}
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
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="utility"
          size="icon"
          className="text-ink-faint opacity-0 group-hover:opacity-100 data-[state=open]:opacity-100"
          aria-label={`Actions for ${row.name}`}
        >
          <MoreHorizontal />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-44">
        {row.kind === 'file' && (
          <DropdownMenuItem onSelect={() => actions.download(row)}>
            <Download />
            Download
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onSelect={() => actions.share(row)}>
          <Share2 />
          Share
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => actions.rename(row)}>
          <Pencil />
          Rename
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => actions.move(row)}>Move to</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onSelect={() => actions.remove(row)}>
          <Trash2 />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
