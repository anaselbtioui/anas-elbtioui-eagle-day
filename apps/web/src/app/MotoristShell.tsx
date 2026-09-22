import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useEffect, useMemo, useState, type KeyboardEvent, type ReactNode } from 'react'
import { AppShell, ShellNavLink, shellActiveEntry } from '@/app/AppShell'
import { LabasIcon } from '@/components/LabasIcon'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { displayAccidentRef } from '@/domain/accident-ref'
import { ProfileSettingsModal } from '@/features/home/ProfileSettingsModal'
import { WalletNudgeDrawer } from '@/features/home/WalletNudgeDrawer'
import { openMotoristPack } from '@/features/home/openMotoristPack'
import { useEvidenceStore } from '@/store/evidencePack'
import { useProfileStore } from '@/store/profile'
import { useSessionStore } from '@/store/session'
import { showToast } from '@/store/toast'
import { api } from '@/services/api.ts'
import { walletClaimReady } from '@/services/wallet.ts'
import { fullTimestampFr, shortRelativeFr } from '@/lib/relative-time'
import { cn } from '@/lib/utils'

function packLabel(id: string, ref: string | undefined): string {
  return displayAccidentRef(ref, id)
}

export function MotoristShell({ children }: { children?: ReactNode }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const user = useSessionStore((s) => s.user)
  const profile = useProfileStore((s) => s.profile)
  const history = useEvidenceStore((s) => s.history)
  const pack = useEvidenceStore((s) => s.pack)
  const hydrateFromDomain = useEvidenceStore((s) => s.hydrateFromDomain)
  const start = useEvidenceStore((s) => s.start)
  const starting = useEvidenceStore((s) => s.starting)
  const resume = useEvidenceStore((s) => s.resume)
  const claimReady = walletClaimReady(profile)
  const { packId } = useParams()
  const { pathname } = useLocation()
  const inAccidentFlow = pathname === '/now' || pathname.startsWith('/now/')
  const [searchQuery, setSearchQuery] = useState('')
  const [settingsOpen, setSettingsOpen] = useState(false)

  useEffect(() => {
    if (!profile.onboarded || !profile.motoristId) return
    void api.listPacks(profile.motoristId).then(hydrateFromDomain).catch(() => undefined)
  }, [profile.onboarded, profile.motoristId, hydrateFromDomain])

  const recentPacks = useMemo(() => {
    const byId = new Map<string, { id: string; ref: string; createdAt: string; status: string }>()
    for (const h of history) {
      byId.set(h.id, { id: h.id, ref: h.ref, createdAt: h.createdAt, status: h.status })
    }
    if (pack) {
      byId.set(pack.id, {
        id: pack.id,
        ref: pack.ref,
        createdAt: pack.createdAt,
        status: pack.status,
      })
    }
    const q = searchQuery.trim().toLowerCase()
    return [...byId.values()]
      .filter((p) => {
        if (!q) return true
        return (
          p.id.toLowerCase().includes(q) ||
          p.ref.toLowerCase().includes(q) ||
          displayAccidentRef(p.ref, p.id).toLowerCase().includes(q) ||
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
    openRecentPack(first.id)
  }

  function openRecentPack(id: string) {
    const found =
      (pack?.id === id ? pack : null) ?? history.find((h) => h.id === id) ?? undefined
    openMotoristPack({
      pack: found,
      packId: id,
      resume,
      navigate,
      claimReady,
      onLaterBlocked: () => showToast(t('home.laterBlocked'), 'alert'),
      onExpired: () => showToast(t('now.expiredToast'), 'alert'),
    })
  }

  async function onNewAccident() {
    await start()
    navigate('/now')
  }

  return (
    <>
      <AppShell
        homeTo="/"
        navLabel={t('motorist.navLabel')}
        displayName={displayName}
        avatarTestId="motorist-avatar"
        onSettings={() => setSettingsOpen(true)}
        sidebarPrimary={
          <Button
            className="h-11 w-full min-h-11 justify-start gap-2.5 pl-2.5 pr-3 text-sm"
            disabled={starting}
            onClick={() => {
              void onNewAccident()
            }}
            data-testid="sidebar-new-accident"
            title={t('home.doorNowHint')}
            aria-label={t('home.doorNow')}
          >
            <LabasIcon
              name="warning"
              className="h-[1.125rem] w-[1.125rem] shrink-0"
              tone="onInk"
              aria-hidden
            />
            <span className="leading-none">
              {starting ? t('now.starting') : t('home.doorNowShort')}
            </span>
          </Button>
        }
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
                  <button
                    type="button"
                    onClick={() => openRecentPack(p.id)}
                    className={cn(
                      'flex min-h-10 w-full items-center gap-2 rounded-[var(--radius-labas)] px-3 py-2.5 text-left text-sm leading-none transition-colors',
                      packId === p.id
                        ? shellActiveEntry
                        : 'text-ink-muted hover:bg-sand-deep/70 hover:text-ink',
                    )}
                    data-testid={`nav-pack-${p.id}`}
                  >
                    <span className="min-w-0 flex-1 truncate font-mono text-[0.8125rem] font-semibold leading-normal">
                      {packLabel(p.id, p.ref)}
                    </span>
                    <span
                      className="shrink-0 self-center tabular-nums text-[0.6875rem] font-medium leading-none text-ink-muted/80"
                      title={fullTimestampFr(p.createdAt)}
                    >
                      {shortRelativeFr(p.createdAt)}
                    </span>
                  </button>
                </li>
              ))
            )}
          </ul>
        }
        bottomDock={
          inAccidentFlow ? undefined : <WalletNudgeDrawer profile={profile} />
        }
      >
        {children}
      </AppShell>
      <ProfileSettingsModal open={settingsOpen} onOpenChange={setSettingsOpen} />
    </>
  )
}
