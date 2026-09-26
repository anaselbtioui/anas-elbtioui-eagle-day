import { flexRender, useReactTable } from '@tanstack/react-table'
import {
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  type ColumnDef,
  type PaginationState,
  type SortingState,
  type Table as TanStackTable,
} from '@tanstack/table-core'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
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

const PAGE_SIZE_OPTIONS = [10, 25, 50] as const
const DEFAULT_PAGE_SIZE = 10

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
  /** Rows per page. Default 10. Set false to disable pagination. */
  pageSize?: number | false
}

const DEFAULT_INTERACTIVE = ['status', 'lifecycle', 'actions']
const SKELETON_ROWS = 4

function DataTablePagination<TData>({ table }: { table: TanStackTable<TData> }) {
  const { t } = useTranslation()
  const pageIndex = table.getState().pagination.pageIndex
  const pageSize = table.getState().pagination.pageSize
  const total = table.getFilteredRowModel().rows.length
  const pageCount = Math.max(table.getPageCount(), 1)
  const from = total === 0 ? 0 : pageIndex * pageSize + 1
  const to = Math.min((pageIndex + 1) * pageSize, total)

  return (
    <div
      className="flex flex-col gap-3 border-t border-border/70 bg-sand-deep/35 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
      data-testid="data-table-pagination"
    >
      <div className="flex items-center gap-2 text-sm text-ink-muted">
        <label htmlFor="data-table-page-size" className="shrink-0">
          {t('table.rowsPerPage')}
        </label>
        <select
          id="data-table-page-size"
          className="h-9 rounded-[var(--radius-labas)] border border-border bg-surface px-2 text-sm font-semibold text-ink outline-none focus-visible:ring-2 focus-visible:ring-ink"
          value={pageSize}
          onChange={(e) => {
            table.setPageSize(Number(e.target.value))
          }}
          data-testid="data-table-page-size"
        >
          {PAGE_SIZE_OPTIONS.map((size) => (
            <option key={size} value={size}>
              {size}
            </option>
          ))}
        </select>
      </div>

      <p className="text-sm text-ink-muted" data-testid="data-table-page-range">
        {t('table.showing', { from, to, total })}
      </p>

      <div className="flex items-center gap-1.5">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="min-h-9 px-2.5"
          disabled={!table.getCanPreviousPage()}
          onClick={() => table.previousPage()}
          aria-label={t('table.previous')}
          data-testid="data-table-prev"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden />
          <span className="hidden sm:inline">{t('table.previous')}</span>
        </Button>
        <span className="min-w-[5.5rem] px-1 text-center text-sm font-semibold text-ink">
          {t('table.pageOf', { page: pageIndex + 1, pages: pageCount })}
        </span>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="min-h-9 px-2.5"
          disabled={!table.getCanNextPage()}
          onClick={() => table.nextPage()}
          aria-label={t('table.next')}
          data-testid="data-table-next"
        >
          <span className="hidden sm:inline">{t('table.next')}</span>
          <ChevronRight className="h-4 w-4" aria-hidden />
        </Button>
      </div>
    </div>
  )
}

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
  pageSize: pageSizeProp = DEFAULT_PAGE_SIZE,
}: DataTableProps<TData, TValue>) {
  const paginate = pageSizeProp !== false
  const [sorting, setSorting] = useState<SortingState>([])
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: paginate ? pageSizeProp : Math.max(data.length, 1),
  })
  const interactive = new Set(interactiveColumnIds)

  useEffect(() => {
    if (!paginate) return
    setPagination((prev) =>
      prev.pageSize === pageSizeProp ? prev : { ...prev, pageSize: pageSizeProp, pageIndex: 0 },
    )
  }, [paginate, pageSizeProp])

  const table = useReactTable({
    data: loading ? [] : data,
    columns,
    state: { sorting, ...(paginate ? { pagination } : {}) },
    onSortingChange: setSorting,
    onPaginationChange: paginate ? setPagination : undefined,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: paginate ? getPaginationRowModel() : undefined,
    autoResetPageIndex: true,
  })

  const showPagination = paginate && !loading && data.length > 0

  return (
    <div
      className={cn(
        'data-table-shell flex min-h-0 flex-1 flex-col overflow-hidden rounded-[var(--radius-labas)] border border-border/70 bg-surface/90',
        className,
      )}
    >
      <ScrollArea
        orientation="vertical"
        className="min-h-0 flex-1"
        viewportClassName="min-w-0 scroll-fade [--scroll-fade-size:1.5rem]"
      >        <Table>
          <TableHeader className="sticky top-0 z-10 bg-sand-deep/95 backdrop-blur-sm">
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
      </ScrollArea>
      {showPagination ? <DataTablePagination table={table} /> : null}
    </div>
  )
}
