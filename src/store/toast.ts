import { create } from 'zustand'

export type ToastTone = 'default' | 'alert' | 'success'

type ToastState = {
  message: string | null
  tone: ToastTone
  show: (message: string, tone?: ToastTone) => void
  clear: () => void
}

let clearTimer: ReturnType<typeof setTimeout> | null = null

export const useToastStore = create<ToastState>((set) => ({
  message: null,
  tone: 'default',
  show: (message, tone = 'default') => {
    if (clearTimer) clearTimeout(clearTimer)
    set({ message, tone })
    clearTimer = setTimeout(() => {
      set({ message: null })
      clearTimer = null
    }, 4500)
  },
  clear: () => {
    if (clearTimer) clearTimeout(clearTimer)
    clearTimer = null
    set({ message: null })
  },
}))

export function showToast(message: string, tone: ToastTone = 'default') {
  useToastStore.getState().show(message, tone)
}
