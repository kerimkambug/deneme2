import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { CURRENCIES, LANGS, type Currency, type L10n, type Lang } from '../types';
import { STRINGS, type StrKey } from './i18n';

interface Prefs {
  lang: Lang;
  currency: Currency;
  setLang: (l: Lang) => void;
  setCurrency: (c: Currency) => void;
}

const Ctx = createContext<Prefs | null>(null);

function read<T extends string>(key: string, allowed: readonly T[], fallback: T): T {
  try {
    const v = localStorage.getItem(key) as T | null;
    if (v && allowed.includes(v)) return v;
  } catch {
    /* yok say */
  }
  return fallback;
}

function detectLang(): Lang {
  const nav = (typeof navigator !== 'undefined' ? navigator.language : 'tr').slice(0, 2) as Lang;
  return LANGS.includes(nav) ? nav : 'en';
}

const DEFAULT_CURRENCY: Record<Lang, Currency> = { tr: 'TRY', en: 'EUR', ru: 'EUR', de: 'EUR', pl: 'EUR' };

export function PrefsProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => {
    // ?lang=en bağlantısı (arama motoru / paylaşılan link) her şeyden önce gelir
    const q = typeof location !== 'undefined' ? new URLSearchParams(location.search).get('lang') : null;
    if (q && (LANGS as readonly string[]).includes(q)) {
      try {
        localStorage.setItem('vip:lang', q);
      } catch {
        /* yok say */
      }
      return q as Lang;
    }
    return read('vip:lang', LANGS, detectLang());
  });
  const [currency, setCurState] = useState<Currency>(() => read('vip:cur', CURRENCIES, DEFAULT_CURRENCY[lang]));

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    try {
      localStorage.setItem('vip:lang', l);
    } catch {
      /* yok say */
    }
  }, []);
  const setCurrency = useCallback((c: Currency) => {
    setCurState(c);
    try {
      localStorage.setItem('vip:cur', c);
    } catch {
      /* yok say */
    }
  }, []);

  const value = useMemo(() => ({ lang, currency, setLang, setCurrency }), [lang, currency, setLang, setCurrency]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function usePrefs() {
  const c = useContext(Ctx);
  if (!c) throw new Error('PrefsProvider eksik');
  return c;
}

/** Arayüz metni ve panelden girilen çok dilli içerik için çevirici */
export function useT() {
  const { lang } = usePrefs();
  const t = useCallback((k: StrKey) => STRINGS[k][lang], [lang]);
  // Çevirisi girilmemiş metinde: Türkçe ziyaretçiye Türkçe, diğerlerine İngilizce göster
  const tl = useCallback((v: L10n | undefined) => (v ? v[lang] || (lang === 'tr' ? v.tr : v.en) || v.tr || v.en || '' : ''), [lang]);
  return { t, tl, lang };
}
