import { messages } from './locales/messages.js';
import { content as contentEn } from './locales/content.en.js';
import { content as contentKo } from './locales/content.ko.js';
import { content as contentJa } from './locales/content.ja.js';
import { projects, hardware, publications } from './data.js';

export const SUPPORTED_LOCALES = Object.freeze(['en', 'ko', 'ja']);
export const DEFAULT_LOCALE = 'en';
const translations = { en: contentEn, ko: contentKo, ja: contentJa };
const originals = { projects, hardware, publications };

export function normalizeLocale(value) {
  if (typeof value !== 'string') return null;
  const locale = value.trim().toLowerCase().replaceAll('_', '-').split('-')[0];
  return SUPPORTED_LOCALES.includes(locale) ? locale : null;
}

export function resolveLocale({ urlValue, storedValue } = {}) {
  return normalizeLocale(urlValue) || normalizeLocale(storedValue) || DEFAULT_LOCALE;
}

export function translate(locale, key, values = {}) {
  const selected = normalizeLocale(locale) || DEFAULT_LOCALE;
  const message = messages[selected][key];
  if (typeof message !== 'string') throw new Error(`Missing translation: ${selected}.${key}`);
  return message.replace(/\{(\w+)\}/g, (_, name) => {
    if (!Object.hasOwn(values, name)) throw new Error(`Missing interpolation: ${key}.${name}`);
    return String(values[name]);
  });
}

export function localizeHref(href, locale, baseUrl = 'https://portfolio.local/') {
  if (typeof href !== 'string') throw new TypeError('A URL string is required');
  const base = new URL(baseUrl);
  const url = new URL(href, base);
  if (!['http:', 'https:'].includes(url.protocol) || url.origin !== base.origin) return href;
  url.searchParams.set('lang', normalizeLocale(locale) || DEFAULT_LOCALE);
  return `${url.pathname}${url.search}${url.hash}`;
}

export function getContent(locale) {
  const selected = normalizeLocale(locale) || DEFAULT_LOCALE;
  return Object.fromEntries(Object.entries(originals).map(([group, items]) => [
    group, items.map(item => {
      const localized = translations[selected][group]?.[item.id];
      if (!localized) throw new Error(`Missing content: ${selected}.${group}.${item.id}`);
      return { ...item, ...localized };
    }),
  ]));
}
