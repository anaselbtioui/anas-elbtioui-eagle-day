import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { ColumnDef } from '@tanstack/table-core'
import { DataTable } from '@/components/ui/data-table'

type Row = { id: string; title: string }

const columns: ColumnDef<Row>[] = [
  {
    accessorKey: 'title',
    header: 'Title',
  },
]

describe('DataTable loading', () => {
  it('shows skeleton status and hides empty message while loading', () => {
    render(
      <DataTable
        columns={columns}
        data={[]}
        emptyMessage="No rows"
        loading
        loadingLabel="Loading accidents…"
      />,
    )
    expect(screen.getByRole('status')).toHaveTextContent('Loading accidents…')
    expect(screen.getByTestId('data-table-skeleton')).toBeInTheDocument()
    expect(screen.queryByText('No rows')).not.toBeInTheDocument()
  })

  it('shows empty message when ready with no rows', () => {
    render(
      <DataTable columns={columns} data={[]} emptyMessage="No rows" loading={false} />,
    )
    expect(screen.getByText('No rows')).toBeInTheDocument()
    expect(screen.queryByTestId('data-table-skeleton')).not.toBeInTheDocument()
  })
})
