import type { Currency, Lang } from '../types';

const LOCALE: Record<Lang, string> = { tr: 'tr-TR', en: 'en-GB', ru: 'ru-RU' };

export function money(eur: number, cur: Currency, rates: Record<Currency, number>, lang: Lang) {
  const v = eur * (rates[cur] || 1);
  const rounded = cur === 'TRY' ? Math.round(v / 10) * 10 : Math.round(v);
  return new Intl.NumberFormat(LOCALE[lang], { style: 'currency', currency: cur, maximumFractionDigits: 0 }).format(rounded);
}

export function eur(v: number) {
  return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v);
}

export function dateLabel(iso: string, lang: Lang, opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long', weekday: 'short' }) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-').map(Number);
  return new Intl.DateTimeFormat(LOCALE[lang], opts).format(new Date(y, m - 1, d));
}

export function todayIso(offset = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function hoursUntil(date: string, time: string) {
  if (!date || !time) return Infinity;
  const [y, m, d] = date.split('-').map(Number);
  const [hh, mm] = time.split(':').map(Number);
  return (new Date(y, m - 1, d, hh, mm).getTime() - Date.now()) / 3600_000;
}

export const waLink = (num: string, text?: string) =>
  `https://wa.me/${num.replace(/\D/g, '')}${text ? `?text=${encodeURIComponent(text)}` : ''}`;

export const telLink = (num: string) => `tel:${num.replace(/[^+\d]/g, '')}`;

export const mapsLink = (q: string) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;

export const USE_HASH = import.meta.env.VITE_HASH === '1';

/** Uygulama içi bir yolun paylaşılabilir tam adresi */
export function appUrl(path: string) {
  return USE_HASH ? `${location.origin}${location.pathname}#${path}` : `${location.origin}${path}`;
}
