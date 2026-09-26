import { describe, expect, it } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import type { ReactElement } from 'react'
import type { ColumnDef } from '@tanstack/table-core'
import { I18nextProvider } from 'react-i18next'
import { DataTable } from '@/components/ui/data-table'
import i18n from '@/i18n'

type Row = { id: string; title: string }

const columns: ColumnDef<Row>[] = [
  {
    accessorKey: 'title',
    header: 'Title',
  },
]

function renderTable(ui: ReactElement) {
  return render(<I18nextProvider i18n={i18n}>{ui}</I18nextProvider>)
}

describe('DataTable loading', () => {
  it('shows skeleton status and hides empty message while loading', () => {
    renderTable(
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
    expect(screen.queryByTestId('data-table-pagination')).not.toBeInTheDocument()
  })

  it('shows empty message when ready with no rows', () => {
    renderTable(
      <DataTable columns={columns} data={[]} emptyMessage="No rows" loading={false} />,
    )
    expect(screen.getByText('No rows')).toBeInTheDocument()
    expect(screen.queryByTestId('data-table-skeleton')).not.toBeInTheDocument()
    expect(screen.queryByTestId('data-table-pagination')).not.toBeInTheDocument()
  })
})

describe('DataTable pagination', () => {
  const rows = Array.from({ length: 12 }, (_, i) => ({
    id: String(i + 1),
    title: `Row ${i + 1}`,
  }))

  it('pages rows and updates range', () => {
    renderTable(<DataTable columns={columns} data={rows} pageSize={10} />)

    expect(screen.getByTestId('data-table-pagination')).toBeInTheDocument()
    expect(screen.getByText('Row 1')).toBeInTheDocument()
    expect(screen.queryByText('Row 11')).not.toBeInTheDocument()
    expect(screen.getByTestId('data-table-page-range')).toHaveTextContent(/1–10/)

    fireEvent.click(screen.getByTestId('data-table-next'))
    expect(screen.getByText('Row 11')).toBeInTheDocument()
    expect(screen.queryByText('Row 1')).not.toBeInTheDocument()
    expect(screen.getByTestId('data-table-page-range')).toHaveTextContent(/11–12/)
  })

  it('hides pagination when disabled', () => {
    renderTable(<DataTable columns={columns} data={rows} pageSize={false} />)
    expect(screen.queryByTestId('data-table-pagination')).not.toBeInTheDocument()
    expect(screen.getByText('Row 12')).toBeInTheDocument()
  })
})
