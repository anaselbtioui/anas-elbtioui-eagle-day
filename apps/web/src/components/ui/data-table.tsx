import { flexRender, useReactTable } from '@tanstack/react-table'
import {
  getCoreRowModel,
  getSortedRowModel,
  type ColumnDef,
  type SortingState,
} from '@tanstack/table-core'
import { useState } from 'react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Skeleton, SkeletonStatus } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

type DataTableProps<TData, TValue> = {
  columns: ColumnDef<TData, TValue>[]
  data: TData[]
  onRowClick?: (row: TData) => void
  /** When true: no row click, muted cells; status/lifecycle stay interactive. */
  isRowDisabled?: (row: TData) => boolean
  /** Column ids that stay full-opacity + hoverable on a disabled row. */
  interactiveColumnIds?: string[]
  getRowTestId?: (row: TData) => string | undefined
  emptyMessage?: string
  /** First-fetch skeleton rows (header stays). */
  loading?: boolean
  loadingLabel?: string
  className?: string
}

const DEFAULT_INTERACTIVE = ['status', 'lifecycle', 'actions']
const SKELETON_ROWS = 4

export function DataTable<TData, TValue>({
  columns,
  data,
  onRowClick,
  isRowDisabled,
  interactiveColumnIds = DEFAULT_INTERACTIVE,
  getRowTestId,
  emptyMessage,
  loading = false,
  loadingLabel,
  className,
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = useState<SortingState>([])
  const interactive = new Set(interactiveColumnIds)

  const table = useReactTable({
    data: loading ? [] : data,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  })

  return (
    <Table className={className}>
      <TableHeader>
        {table.getHeaderGroups().map((headerGroup) => (
          <TableRow key={headerGroup.id} className="hover:bg-transparent">
            {headerGroup.headers.map((header) => (
              <TableHead key={header.id} colSpan={header.colSpan}>
                {header.isPlaceholder ? null : header.column.getCanSort() ? (
                  <button
                    type="button"
                    className="inline-flex cursor-pointer select-none items-center gap-1 hover:text-ink"
                    onClick={header.column.getToggleSortingHandler()}
                  >
                    {flexRender(header.column.columnDef.header, header.getContext())}
                    {{
                      asc: ' ↑',
                      desc: ' ↓',
                    }[header.column.getIsSorted() as string] ?? null}
                  </button>
                ) : (
                  flexRender(header.column.columnDef.header, header.getContext())
                )}
              </TableHead>
            ))}
          </TableRow>
        ))}
      </TableHeader>
      <TableBody>
        {loading ? (
          <TableRow className="hover:bg-transparent">
            <TableCell colSpan={columns.length} className="p-0">
              <SkeletonStatus label={loadingLabel ?? ''} className="block w-full">
                <div className="divide-y divide-border/60" data-testid="data-table-skeleton">
                  {Array.from({ length: SKELETON_ROWS }, (_, i) => (
                    <div key={i} className="flex items-center gap-4 px-5 py-3.5">
                      <Skeleton className="h-4 w-[38%] max-w-[14rem]" />
                      <Skeleton className="h-3.5 w-16 shrink-0" />
                      <Skeleton className="ml-auto h-4 w-4 shrink-0 rounded-full" />
                    </div>
                  ))}
                </div>
              </SkeletonStatus>
            </TableCell>
          </TableRow>
        ) : table.getRowModel().rows.length ? (
          table.getRowModel().rows.map((row) => {
            const disabled = Boolean(isRowDisabled?.(row.original))
            const clickable = Boolean(onRowClick) && !disabled
            return (
              <TableRow
                key={row.id}
                data-testid={getRowTestId?.(row.original)}
                aria-disabled={disabled || undefined}
                className={cn(
                  clickable && 'cursor-pointer',
                  disabled && 'cursor-default hover:bg-transparent',
                )}
                onClick={() => {
                  if (!clickable) return
                  onRowClick?.(row.original)
                }}
                onKeyDown={(e) => {
                  if (!clickable) return
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    onRowClick?.(row.original)
                  }
                }}
                tabIndex={clickable ? 0 : undefined}
                role={clickable ? 'link' : undefined}
              >
                {row.getVisibleCells().map((cell) => {
                  const keepLive = interactive.has(cell.column.id)
                  return (
                    <TableCell
                      key={cell.id}
                      className={cn(
                        disabled && !keepLive && 'pointer-events-none opacity-45',
                        disabled && keepLive && 'relative z-[1]',
                      )}
                      onClick={
                        disabled && keepLive
                          ? (e) => e.stopPropagation()
                          : undefined
                      }
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  )
                })}
              </TableRow>
            )
          })
        ) : (
          <TableRow className="hover:bg-transparent">
            <TableCell
              colSpan={columns.length}
              className="h-36 px-5 py-10 text-center text-sm text-ink-muted"
            >
              {emptyMessage ?? '—'}
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  )
}
