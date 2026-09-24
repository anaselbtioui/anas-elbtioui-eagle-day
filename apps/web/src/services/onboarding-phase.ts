import {
  attestationDaysRemaining,
  firstWalletGapStep,
  walletClaimReady,
  walletFullyComplete,
  walletIncompleteSteps,
  walletRemainingPercent,
  type Wallet,
  type WalletGapStepId,
} from '@/services/wallet.ts'

/**
 * Derived onboarding / wallet phase — server fields only, no local step index.
 * Pure state machine for nudge + resume (no XState).
 */
export type OnboardingPhase =
  | 'gaps'
  | 'claimReady'
  | 'brokerAssigned'
  | 'complete'
  | 'expiring'
  | 'expired'

export function deriveOnboardingPhase(wallet: Wallet): OnboardingPhase {
  const days = attestationDaysRemaining(wallet.attestationValidUntil)
  // Past date always wins — even when other fields still incomplete.
  if (days !== null && days < 0) return 'expired'
  // Sole-broker auto-link notice blocks wallet-complete until dismissed.
  if (wallet.brokerAutoAssignPending) return 'brokerAssigned'
  if (!walletFullyComplete(wallet)) {
    return walletClaimReady(wallet) ? 'claimReady' : 'gaps'
  }
  if (days !== null && days <= 45) return 'expiring'
  return 'complete'
}

/** Resume wizard at first incomplete portefeuille step (or review). */
export function resumeStepId(wallet: Wallet): WalletGapStepId | 'review' {
  return firstWalletGapStep(wallet)
}

export function onboardingGapCount(wallet: Wallet): number {
  return walletIncompleteSteps(wallet).length
}

export function onboardingRemainingPercent(wallet: Wallet): number {
  return walletRemainingPercent(wallet)
}
