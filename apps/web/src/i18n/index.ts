import i18n from 'i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import { initReactI18next } from 'react-i18next'
import en from './en/common.json'
import fr from './fr/common.json'

const isTest = import.meta.env.MODE === 'test'

void (isTest
  ? i18n.use(initReactI18next).init({
      resources: {
        fr: { translation: fr },
        en: { translation: en },
      },
      lng: 'fr',
      supportedLngs: ['fr', 'en'],
      fallbackLng: 'fr',
      load: 'languageOnly',
      nonExplicitSupportedLngs: true,
      interpolation: { escapeValue: false },
    })
  : i18n
      .use(LanguageDetector)
      .use(initReactI18next)
      .init({
        resources: {
          fr: { translation: fr },
          en: { translation: en },
        },
        supportedLngs: ['fr', 'en'],
        fallbackLng: 'fr',
        load: 'languageOnly',
        nonExplicitSupportedLngs: true,
        detection: {
          order: ['querystring', 'localStorage', 'navigator'],
          caches: ['localStorage'],
          lookupQuerystring: 'lng',
        },
        interpolation: { escapeValue: false },
      })
).then(() => {
  if (typeof document !== 'undefined') {
    document.documentElement.lang = i18n.resolvedLanguage ?? i18n.language ?? 'fr'
  }
})

if (typeof document !== 'undefined') {
  i18n.on('languageChanged', (lng) => {
    document.documentElement.lang = lng
  })
}

/** BCP 47 tag for `Intl` formatters (Morocco FR / UK EN). */
export function uiLocale(lng = i18n.resolvedLanguage ?? i18n.language): string {
  const base = (lng || 'fr').split('-')[0]?.toLowerCase()
  return base === 'en' ? 'en-GB' : 'fr-MA'
}

export default i18n
