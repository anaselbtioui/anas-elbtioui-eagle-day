import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ShellListFrame, ShellScroll } from '@/app/AppShell'
import { DataTable } from '@/components/ui/data-table'
import { LoadingLine } from '@/components/ui/loading-line'
import type { ColumnDef } from '@tanstack/table-core'
import type { BrokerClient } from '@/services/http-contract.ts'
import { api } from '@/services/api.ts'

export function BrokerClientsPage() {
  const { t } = useTranslation()
  const [clients, setClients] = useState<BrokerClient[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void api
      .listBrokerClients()
      .then((list) => {
        if (!cancelled) {
          setClients(list)
          setLoading(false)
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'load_failed')
          setLoading(false)
        }
      })
    return () => {
      cancelled = true
    }
  }, [])

  const columns: ColumnDef<BrokerClient>[] = [
    {
      id: 'name',
      accessorFn: (row) => row.name,
      header: t('broker.colClient'),
      cell: ({ row }) => <span className="font-semibold text-ink">{row.original.name}</span>,
    },
    {
      id: 'email',
      accessorFn: (row) => row.email ?? '',
      header: t('broker.colEmail'),
      cell: ({ row }) => (
        <span className="text-sm text-ink-muted">{row.original.email ?? '—'}</span>
      ),
    },
    {
      id: 'phone',
      accessorFn: (row) => row.phone ?? '',
      header: t('broker.colPhone'),
      cell: ({ row }) => (
        <span className="font-mono text-sm tabular-nums">{row.original.phone ?? '—'}</span>
      ),
    },
    {
      id: 'plate',
      accessorFn: (row) => row.plate ?? '',
      header: t('broker.colPlate'),
      cell: ({ row }) => (
        <span className="font-mono text-sm">{row.original.plate ?? '—'}</span>
      ),
    },
    {
      id: 'policy',
      accessorFn: (row) => row.policyNumber ?? '',
      header: t('broker.colPolicy'),
      cell: ({ row }) => (
        <span className="font-mono text-sm tabular-nums">
          {row.original.policyNumber ?? '—'}
        </span>
      ),
    },
  ]

  return (
    <ShellScroll>
      <ShellListFrame>
      <div className="mb-5">
        <h1 className="font-display text-3xl font-bold">{t('broker.clientsTitle')}</h1>
        <p className="mt-2 max-w-xl text-base text-ink-muted">{t('broker.clientsHint')}</p>
      </div>

      {loading ? <LoadingLine /> : null}
      {error ? <p className="mb-3 text-sm text-alert">{error}</p> : null}

      {!loading ? (
        <DataTable
          columns={columns}
          data={clients}
          emptyMessage={t('broker.clientsEmpty')}
          getRowTestId={(row) => `client-${row.motoristId}`}
        />
      ) : null}
      </ShellListFrame>
    </ShellScroll>
  )
}
