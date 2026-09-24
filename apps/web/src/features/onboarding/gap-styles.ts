import {
  walletFieldIsProgress,
  walletFieldNeedsInput,
} from '@/services/wallet.ts'

/** Ring missing portefeuille inputs — only while resuming wallet gaps. */
export function gapClass(
  gapsOnly: boolean,
  profile: Parameters<typeof walletFieldNeedsInput>[0],
  key: Parameters<typeof walletFieldNeedsInput>[1],
) {
  if (!gapsOnly || !walletFieldIsProgress(key) || !walletFieldNeedsInput(profile, key)) {
    return undefined
  }
  return 'border-alert ring-2 ring-alert/35 focus-visible:ring-alert'
}

export function gapAttr(
  gapsOnly: boolean,
  profile: Parameters<typeof walletFieldNeedsInput>[0],
  key: Parameters<typeof walletFieldNeedsInput>[1],
) {
  return gapsOnly && walletFieldIsProgress(key) && walletFieldNeedsInput(profile, key)
    ? true
    : undefined
}
