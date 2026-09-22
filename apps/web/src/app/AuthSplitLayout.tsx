import type { ReactNode } from 'react'
import { BrandMark } from '@/components/BrandLogo'
import { StickyActionsProvider } from '@/components/ui/sticky-actions'
import styles from './auth-split.module.css'

type AuthSplitLayoutProps = {
  children: ReactNode
  brandTitle: string
  brandBody?: string
  mobileHero?: ReactNode
}

export function AuthSplitLayout({
  children,
  brandTitle,
  brandBody,
  mobileHero,
}: AuthSplitLayoutProps) {
  const year = new Date().getFullYear()

  return (
    <div className={styles.authRoot}>
      <aside className={styles.brandPanel} aria-label="Med Assurance">
        <div className={styles.brandAmbient} aria-hidden>
          <div className={styles.brandBase} />
          <div className={styles.brandPattern} />
          <div className={`${styles.orb} ${styles.orbMoss}`} />
          <div className={`${styles.orb} ${styles.orbBlush}`} />
          <div className={`${styles.orb} ${styles.orbInk}`} />
          <div className={styles.brandGrain} />
        </div>

        <div className={styles.brandContent}>
          <div className={styles.brandLockup}>
            <BrandMark size="xl" className={styles.brandMark} />
            <span className={styles.brandWordmark}>Med Assurance</span>
          </div>
          <div className={styles.brandCopy}>
            <p className={styles.brandTitle}>{brandTitle}</p>
            {brandBody ? <p className={styles.brandBody}>{brandBody}</p> : null}
          </div>
        </div>

        <p className={styles.brandCopyright}>© {year} Med Assurance</p>
      </aside>

      <div className={styles.formColumn}>
        <div className={styles.formWrap}>
          {mobileHero ? <div className={styles.mobileOnly}>{mobileHero}</div> : null}
          {children}
        </div>
      </div>
    </div>
  )
}

export function AuthFormCard({
  title,
  lead,
  progress,
  children,
}: {
  title: string
  lead?: string
  progress?: ReactNode
  children: ReactNode
}) {
  return (
    <div className={`${styles.authFormCard} surface-card`}>
      <div className={styles.formHeaderBand}>
        {progress}
        <h1 className={styles.formTitle}>{title}</h1>
        {lead ? <p className={styles.formLead}>{lead}</p> : null}
      </div>
      <StickyActionsProvider
        className={styles.formStickyRegion}
        bodyClassName={styles.formBody}
        footerClassName={styles.formStickyFooter}
      >
        {children}
      </StickyActionsProvider>
    </div>
  )
}

export { styles as authSplitStyles }
