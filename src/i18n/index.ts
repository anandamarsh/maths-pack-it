// src/i18n/index.ts — React context, hooks, and translation helpers

import { createContext, useContext, useState, useCallback, useEffect } from "react";
import type { ReactNode } from "react";
import { createElement } from "react";
import type { Translations, TranslationKey, TFunction } from "./types";
import en from "./en";
import zh from "./zh";
import hi from "./hi";

// --- Built-in locale map ---

export const BUILT_IN_LOCALES: Record<string, Translations> = { en, zh, hi };

export const LOCALE_NAMES: Record<string, string> = {
  en: "English",
  zh: "中文",
  hi: "हिन्दी",
};

const INTL_LOCALE_MAP: Record<string, string> = {
  en: "en-AU",
  zh: "zh-CN",
  hi: "hi-IN",
};

export interface LocaleFormatConfig {
  intlLocale: string;
  timeOptions: Intl.DateTimeFormatOptions;
  emailDateOptions: Intl.DateTimeFormatOptions;
  pdfDateOptions: Intl.DateTimeFormatOptions;
  compactDurationLabels?: {
    minute: string;
    second: string;
  };
  useCompactDurationInEmail?: boolean;
}

const DEFAULT_LOCALE_FORMAT: LocaleFormatConfig = {
  intlLocale: "en-AU",
  timeOptions: { hour: "numeric", minute: "2-digit" },
  emailDateOptions: { year: "numeric", month: "long", day: "numeric" },
  pdfDateOptions: { weekday: "long", year: "numeric", month: "long", day: "numeric" },
};

const LOCALE_FORMAT_MAP: Record<string, Partial<LocaleFormatConfig>> = {
  hi: {
    timeOptions: { hour: "2-digit", minute: "2-digit", hour12: false },
    compactDurationLabels: { minute: "m", second: "s" },
    useCompactDurationInEmail: true,
  },
};

const STORAGE_KEY = "lang";
const CACHE_PREFIX = "i18n_cache_";
const CUSTOM_LANGS_KEY = "i18n_custom_langs";

// --- Interpolation ---

function interpolate(template: string, vars?: Record<string, string | number>): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (_, key) => {
    const val = vars[key];
    return val !== undefined ? String(val) : `{${key}}`;
  });
}

// --- Non-React translation function ---

export function getT(locale: string): TFunction {
  const strings = getStringsForLocale(locale);
  return (key: TranslationKey, vars?: Record<string, string | number>) => {
    const raw = strings[key] ?? en[key] ?? key;
    return interpolate(raw, vars);
  };
}

function getStringsForLocale(locale: string): Translations {
  if (BUILT_IN_LOCALES[locale]) return BUILT_IN_LOCALES[locale];
  // Check localStorage for cached on-demand translations
  try {
    const cached = localStorage.getItem(CACHE_PREFIX + locale);
    if (cached) return JSON.parse(cached) as Translations;
  } catch { /* ignore */ }
  return en;
}

// --- Load custom language names from localStorage ---

function loadCustomLangs(): Record<string, string> {
  try {
    const raw = localStorage.getItem(CUSTOM_LANGS_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return {};
}

export function saveCustomLang(code: string, name: string) {
  const langs = loadCustomLangs();
  langs[code] = name;
  localStorage.setItem(CUSTOM_LANGS_KEY, JSON.stringify(langs));
}

export function getCustomLangs(): Record<string, string> {
  return loadCustomLangs();
}

export function cacheTranslation(locale: string, translations: Translations) {
  localStorage.setItem(CACHE_PREFIX + locale, JSON.stringify(translations));
}

export function getIntlLocale(locale: string): string {
  return INTL_LOCALE_MAP[locale] || locale || "en-AU";
}

export function getLocaleFormat(locale: string): LocaleFormatConfig {
  const normalized = locale.toLowerCase();
  const base = normalized.split("-")[0];
  const overrides = LOCALE_FORMAT_MAP[normalized] || LOCALE_FORMAT_MAP[base] || {};
  return {
    ...DEFAULT_LOCALE_FORMAT,
    ...overrides,
    intlLocale: getIntlLocale(locale),
  };
}

// --- React Context ---

interface I18nContextValue {
  locale: string;
  setLocale: (code: string) => void;
  t: TFunction;
}

const I18nContext = createContext<I18nContextValue>({
  locale: "en",
  setLocale: () => {},
  t: (key) => en[key] ?? key,
});

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<string>(() => {
    try { return localStorage.getItem(STORAGE_KEY) || "en"; } catch { return "en"; }
  });
  const [strings, setStrings] = useState<Translations>(() => getStringsForLocale(locale));

  const setLocale = useCallback((code: string) => {
    setLocaleState(code);
    setStrings(getStringsForLocale(code));
    try { localStorage.setItem(STORAGE_KEY, code); } catch { /* ignore */ }
  }, []);

  // Re-derive strings when locale changes (handles cached translations becoming available)
  useEffect(() => {
    setStrings(getStringsForLocale(locale));
  }, [locale]);

  const t: TFunction = useCallback(
    (key: TranslationKey, vars?: Record<string, string | number>) => {
      const raw = strings[key] ?? en[key] ?? key;
      return interpolate(raw, vars);
    },
    [strings],
  );

  return createElement(I18nContext.Provider, { value: { locale, setLocale, t } }, children);
}

export function useT(): TFunction {
  return useContext(I18nContext).t;
}

export function useLocale() {
  const { locale, setLocale } = useContext(I18nContext);
  return { locale, setLocale };
}
