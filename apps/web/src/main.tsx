import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { AppRouter } from '@/app/router'
import { installEvidenceOfflineReplay } from '@/store/evidencePack'
import '@/i18n'
import '@/index.css'

installEvidenceOfflineReplay()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppRouter />
  </StrictMode>,
)
