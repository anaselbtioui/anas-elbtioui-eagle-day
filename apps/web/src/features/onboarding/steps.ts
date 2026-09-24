export const ONBOARDING_STEPS = [
  'welcome',
  'otp',
  'identity',
  'permis',
  'carteGrise',
  'attestation',
  'broker',
  'assistance',
  'review',
  'done',
] as const

export type OnboardingStepId = (typeof ONBOARDING_STEPS)[number]

export const STEP_COUNT = ONBOARDING_STEPS.length
export const REVIEW_STEP = ONBOARDING_STEPS.indexOf('review')

export function stepTitleKey(id: OnboardingStepId): string {
  return `onboarding.steps.${id}`
}
