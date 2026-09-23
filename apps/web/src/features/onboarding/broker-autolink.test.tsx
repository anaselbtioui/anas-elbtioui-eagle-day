import { describe, expect, it, vi, beforeEach } from 'vitest'
import { act, render, screen, waitFor } from '@testing-library/react'
import { I18nextProvider } from 'react-i18next'
import i18n from '@/i18n'
import { emptyWallet } from '@/services/wallet.ts'
import { useProfileStore } from '@/store/profile'

const listRegisteredBrokers = vi.fn()
const saveProfile = vi.fn().mockResolvedValue(undefined)

vi.mock('@/services/api.ts', () => ({
  api: {
    listRegisteredBrokers: (...args: unknown[]) => listRegisteredBrokers(...args),
    saveProfile: (...args: unknown[]) => saveProfile(...args),
    uploadProfileDoc: vi.fn(),
  },
}))

const { OnboardingSteps, ONBOARDING_STEPS } = await import(
  '@/features/onboarding/OnboardingPage'
)

const BROKER_STEP = ONBOARDING_STEPS.indexOf('broker')

beforeEach(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  })
})

describe('onboarding broker auto-link', () => {
  beforeEach(() => {
    listRegisteredBrokers.mockReset()
    saveProfile.mockClear()
    useProfileStore.setState({
      profile: {
        ...emptyWallet,
        motoristId: 'M-test',
        vehicleId: 'V-test',
        insurerId: 'I-test',
        policyId: 'P-test',
        brokerId: '',
        broker: '',
      },
      error: null,
      saving: false,
    })
  })

  it('auto-selects the sole registered broker without a click', async () => {
    listRegisteredBrokers.mockResolvedValue([
      { id: 'B-sole', displayName: 'Said Courtier', email: 'said@courtier.com' },
    ])

    render(
      <I18nextProvider i18n={i18n}>
        <OnboardingSteps
          step={BROKER_STEP}
          goTo={() => {}}
          onLeave={() => {}}
          onFinish={() => {}}
        />
      </I18nextProvider>,
    )

    await waitFor(() => {
      expect(screen.getByTestId('broker-pick-B-sole')).toBeInTheDocument()
    })

    await waitFor(() => {
      expect(useProfileStore.getState().profile.brokerId).toBe('B-sole')
      expect(useProfileStore.getState().profile.broker).toBe('Said Courtier')
    })

    const continueBtn = screen.getByRole('button', { name: /Continuer|Continue/i })
    expect(continueBtn).not.toBeDisabled()
  })

  it('re-links when wallet holds a stale broker id', async () => {
    useProfileStore.setState({
      profile: {
        ...useProfileStore.getState().profile,
        brokerId: 'B-gone',
        broker: 'Old',
      },
    })
    listRegisteredBrokers.mockResolvedValue([
      { id: 'B-sole', displayName: 'Said Courtier', email: 'said@courtier.com' },
    ])

    await act(async () => {
      render(
        <I18nextProvider i18n={i18n}>
          <OnboardingSteps
            step={BROKER_STEP}
            goTo={() => {}}
            onLeave={() => {}}
            onFinish={() => {}}
          />
        </I18nextProvider>,
      )
    })

    await waitFor(() => {
      expect(useProfileStore.getState().profile.brokerId).toBe('B-sole')
    })
  })
})
