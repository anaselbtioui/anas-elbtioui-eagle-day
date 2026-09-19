import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { MobileShell, QuestionPage } from '@/app/MobileShell'
import { Button } from '@/components/ui/button'
import { Card, CardDescription, CardTitle } from '@/components/ui/card'
import type { Contact } from '@/domain/types.ts'
import { api } from '@/services/api.ts'
import { useProfileStore } from '@/store/profile.ts'

export function AssistPage() {
  const { t } = useTranslation()
  const profile = useProfileStore((s) => s.profile)
  const [contacts, setContacts] = useState<Contact[]>([])

  useEffect(() => {
    void api.listContacts(profile.assistanceOnContract).then((list) => {
      setContacts(list.filter((c) => c.role === 'assistance'))
    })
  }, [profile.assistanceOnContract])

  const primary = contacts[0]
  const number = profile.assistanceNumber.trim() || primary?.phone || null

  return (
    <MobileShell title={t('assist.title')} backTo="/">
      <QuestionPage title={t('assist.title')} hint={t('assist.body')}>
        <Card className="mb-4">
          <CardTitle className="text-2xl tabular-nums">{number ?? '—'}</CardTitle>
          <CardDescription>
            {primary?.displayName ?? profile.insurer ?? t('assist.fallback')}
            <br />
            {t('now.assistHint')}
          </CardDescription>
        </Card>
        {number ? (
          <Button asChild className="mb-3 w-full" variant="moss" size="lg">
            <a href={`tel:${number}`}>{t('now.assistCall')}</a>
          </Button>
        ) : (
          <p className="mb-3 text-sm text-ink-muted">{t('assist.none')}</p>
        )}
        {contacts.length > 0 ? (
          <div className="mb-4 space-y-2" data-testid="assist-contacts">
            <p className="text-sm font-semibold">{t('assist.contactsTitle')}</p>
            <ul className="space-y-2">
              {contacts.map((c) => (
                <li key={c.id} className="rounded-[var(--radius-labas)] bg-sand-deep px-3 py-2 text-sm">
                  <span className="font-medium">{c.displayName}</span>
                  {c.phone ? (
                    <>
                      <br />
                      <a href={`tel:${c.phone}`} className="text-moss underline">
                        {c.phone}
                      </a>
                    </>
                  ) : null}
                  {c.note ? <p className="mt-1 text-xs text-ink-muted">{c.note}</p> : null}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        <Button asChild variant="ghost" className="w-full">
          <Link to="/">{t('now.backHome')}</Link>
        </Button>
      </QuestionPage>
    </MobileShell>
  )
}
