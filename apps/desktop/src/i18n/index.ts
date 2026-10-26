import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

// Eager-import every namespace for both locales — parity is enforced by
// scripts/check-i18n.mjs in CI (plan §3.2).
const fa = import.meta.glob('./fa/*.json', { eager: true, import: 'default' }) as Record<string, Record<string, unknown>>;
const en = import.meta.glob('./en/*.json', { eager: true, import: 'default' }) as Record<string, Record<string, unknown>>;

const resources = {
  fa: Object.fromEntries(Object.entries(fa).map(([p, v]) => [p.replace('./', '').replace('.json', ''), { translation: v }])),
  en: Object.fromEntries(Object.entries(en).map(([p, v]) => [p.replace('./', '').replace('.json', ''), { translation: v }])),
};

export type AppLanguage = 'fa' | 'en';
export const NAMESPACES = Object.keys(resources.fa);

i18n.use(initReactI18next).init({
  resources,
  lng: 'en',
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
  returnNull: false,
});

export function applyLanguageDir(lang: AppLanguage): void {
  document.documentElement.lang = lang === 'fa' ? 'fa-IR' : 'en-US';
  document.documentElement.dir = lang === 'fa' ? 'rtl' : 'ltr';
}

export function changeLanguage(lang: AppLanguage): void {
  void i18n.changeLanguage(lang);
  applyLanguageDir(lang);
}

export default i18n;
