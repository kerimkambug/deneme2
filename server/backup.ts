import type { Booking } from '../src/types';
import type { Chat } from '../src/lib/chat';
import type { Config, CustomerRec } from './db';

/** Tam yedek dosyasının biçimi */
export interface FullBackup {
  format: 'vip-transfer-backup';
  version: 1;
  createdAt: string;
  reason: string;
  config: Config;
  bookings: Booking[];
  customers: CustomerRec[];
  adminHash: string | null;
  migrations: string[];
  kv: Record<string, unknown>;
  chats: Record<string, Chat>;
}

export interface BackupInfo {
  id: string;
  at: string;
  reason: string;
  size: number;
  bookings: number;
  customers: number;
}

/** Yedek dosyasını doğrular; hatalıysa okunur bir mesaj döner. */
export function validateBackup(x: unknown): string | null {
  const b = x as Partial<FullBackup> | null;
  if (!b || typeof b !== 'object') return 'Dosya okunamadı.';
  if (b.format !== 'vip-transfer-backup') return 'Bu dosya bir VIP Transfer tam yedeği değil.';
  if (b.version !== 1) return 'Yedek sürümü desteklenmiyor.';
  if (!b.config || typeof b.config !== 'object' || !Array.isArray((b.config as Config).vehicles)) return 'Yedekte site ayarları eksik.';
  if (!Array.isArray(b.bookings) || !Array.isArray(b.customers)) return 'Yedekte rezervasyon veya müşteri listesi eksik.';
  if (typeof b.kv !== 'object' || typeof b.chats !== 'object') return 'Yedek dosyası eksik.';
  return null;
}

/** Türkiye saatine göre bugünün tarihi (gece yedeği için) */
export const istanbulDate = (d = new Date()) => new Date(d.getTime() + 3 * 3600e3).toISOString().slice(0, 10);
export const istanbulHour = (d = new Date()) => new Date(d.getTime() + 3 * 3600e3).getUTCHours();
