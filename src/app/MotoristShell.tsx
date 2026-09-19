import { Link, useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useEffect, useMemo, useState, type KeyboardEvent, type ReactNode } from 'react'
import { AppShell, ShellNavLink, shellActiveEntry } from '@/app/AppShell'
import { Input } from '@/components/ui/input'
import {
  AvatarSettingsButton,
  ProfileSettingsModal,
} from '@/features/home/ProfileSettingsModal'
import { WalletNudgeDrawer } from '@/features/home/WalletNudgeDrawer'
import { useEvidenceStore } from '@/store/evidencePack'
import { useProfileStore } from '@/store/profile'
import { useSessionStore } from '@/store/session'
import { api } from '@/services/api.ts'
import { cn } from '@/lib/utils'

function packLabel(id: string, createdAt: string): string {
  const day = createdAt.slice(0, 10)
  return day ? `${day} · ${id.slice(0, 10)}` : id.slice(0, 14)
}

export function MotoristShell({ children }: { children?: ReactNode }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const user = useSessionStore((s) => s.user)
  const profile = useProfileStore((s) => s.profile)
  const history = useEvidenceStore((s) => s.history)
  const pack = useEvidenceStore((s) => s.pack)
  const hydrateFromDomain = useEvidenceStore((s) => s.hydrateFromDomain)
  const { packId } = useParams()
  const [searchQuery, setSearchQuery] = useState('')
  const [settingsOpen, setSettingsOpen] = useState(false)

  useEffect(() => {
    if (!profile.onboarded || !profile.motoristId) return
    void api.listPacks(profile.motoristId).then(hydrateFromDomain).catch(() => undefined)
  }, [profile.onboarded, profile.motoristId, hydrateFromDomain])

  const recentPacks = useMemo(() => {
    const byId = new Map<string, { id: string; createdAt: string; status: string }>()
    for (const h of history) {
      byId.set(h.id, { id: h.id, createdAt: h.createdAt, status: h.status })
    }
    if (pack) {
      byId.set(pack.id, { id: pack.id, createdAt: pack.createdAt, status: pack.status })
    }
    const q = searchQuery.trim().toLowerCase()
    return [...byId.values()]
      .filter((p) => {
        if (!q) return true
        return (
          p.id.toLowerCase().includes(q) ||
          p.createdAt.toLowerCase().includes(q) ||
          p.status.toLowerCase().includes(q)
        )
      })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 24)
  }, [history, pack, searchQuery])

  const displayName =
    user?.displayName?.trim() || profile.name.trim() || t('role.motorist')

  function onSearchKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key !== 'Enter') return
    const first = recentPacks[0]
    if (!first) return
    navigate(`/past/${first.id}`)
  }

  return (
    <>
      <AppShell
        homeTo="/"
        navLabel={t('motorist.navLabel')}
        displayName={displayName}
        avatarTestId="motorist-avatar"
        avatarAction={<AvatarSettingsButton onClick={() => setSettingsOpen(true)} />}
        search={
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={onSearchKeyDown}
            placeholder={t('motorist.searchPh')}
            className="min-h-10 border border-border bg-surface/80 px-3 py-2 text-sm"
            data-testid="motorist-search"
            aria-label={t('motorist.searchPh')}
          />
        }
        nav={
          <>
            <ShellNavLink
              to="/"
              end
              icon="warning"
              label={t('motorist.navClaims')}
              testId="nav-motorist-claims"
            />
            <ShellNavLink
              to="/past"
              icon="clipboard"
              label={t('motorist.navPast')}
              testId="nav-motorist-past"
            />
          </>
        }
        listTitle={t('motorist.navRecent')}
        list={
          <ul className="space-y-0.5">
            {recentPacks.length === 0 ? (
              <li className="px-3 py-2 text-sm text-ink-muted">
                {searchQuery.trim() ? t('motorist.noMatch') : t('motorist.pastEmpty')}
              </li>
            ) : (
              recentPacks.map((p) => (
                <li key={p.id}>
                  <Link
                    to={`/past/${p.id}`}
                    className={cn(
                      'block truncate rounded-[var(--radius-labas)] px-3 py-2 text-sm transition-colors',
                      packId === p.id
                        ? shellActiveEntry
                        : 'text-ink-muted hover:bg-sand-deep/70 hover:text-ink',
                    )}
                    data-testid={`nav-pack-${p.id}`}
                  >
                    {packLabel(p.id, p.createdAt)}
                  </Link>
                </li>
              ))
            )}
          </ul>
        }
        bottomDock={<WalletNudgeDrawer profile={profile} />}
      >
        {children}
      </AppShell>
      <ProfileSettingsModal open={settingsOpen} onOpenChange={setSettingsOpen} />
    </>
  )
}
