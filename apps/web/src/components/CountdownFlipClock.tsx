import { useEffect, useRef, useState, type TransitionEvent } from 'react'
import { useTranslation } from 'react-i18next'
import styles from './CountdownFlipClock.module.css'

type CountdownFlipClockProps = {
  totalMs: number
  className?: string
}

function formatMmSs(totalMs: number): string {
  const sec = Math.max(0, Math.floor(totalMs / 1000))
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function clampDigit(n: number): number {
  return Math.min(9, Math.max(0, Math.floor(n)))
}

function FlipDigit({ value }: { value: number }) {
  const v = clampDigit(value)
  const [front, setFront] = useState(v)
  const [back, setBack] = useState(v)
  const [flipping, setFlipping] = useState(false)
  const [instant, setInstant] = useState(false)
  const targetRef = useRef(v)
  const flipActiveRef = useRef(false)

  useEffect(() => {
    if (v === front) return
    targetRef.current = v
    setBack(v)
    flipActiveRef.current = true
    setFlipping(true)
  }, [v, front])

  const onTransitionEnd = (e: TransitionEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget) return
    if (e.propertyName !== 'transform') return
    if (!flipActiveRef.current) return
    flipActiveRef.current = false
    setInstant(true)
    setFront(targetRef.current)
    setFlipping(false)
    requestAnimationFrame(() => {
      requestAnimationFrame(() => setInstant(false))
    })
  }

  return (
    <div className={styles.flipDigit} aria-hidden>
      <div
        className={[
          styles.flipInner,
          flipping ? styles.flipInnerFlipping : '',
          instant ? styles.flipInnerInstant : '',
        ]
          .filter(Boolean)
          .join(' ')}
        onTransitionEnd={onTransitionEnd}
      >
        <div className={`${styles.flipFace} ${styles.flipFaceFront}`}>{front}</div>
        <div className={`${styles.flipFace} ${styles.flipFaceBack}`}>{back}</div>
      </div>
    </div>
  )
}

/** MM:SS flip-clock countdown (wa-pharma / hamssah pattern). */
export function CountdownFlipClock({ totalMs, className }: CountdownFlipClockProps) {
  const { t } = useTranslation()
  const sec = Math.max(0, Math.floor(totalMs / 1000))
  const m = Math.floor(sec / 60)
  const s = sec % 60
  const label = formatMmSs(totalMs)

  return (
    <div
      className={[styles.flipRoot, className].filter(Boolean).join(' ')}
      role="timer"
      aria-label={t('session.timeRemaining', { time: label })}
    >
      <span className={styles.flipSr} aria-live="polite" aria-atomic="true">
        {label}
      </span>
      <div className={styles.flipRow}>
        <FlipDigit value={Math.floor(m / 10)} />
        <FlipDigit value={m % 10} />
        <span className={styles.flipSep} aria-hidden>
          :
        </span>
        <FlipDigit value={Math.floor(s / 10)} />
        <FlipDigit value={s % 10} />
      </div>
    </div>
  )
}
