import webpush from 'web-push';
import type { Store } from './db';

/** Web Push: tarayıcının kendi bildirim altyapısı (anahtarlar ilk açılışta üretilir). */
interface Sub {
  endpoint: string;
  keys: { p256dh: string; auth: string };
  role: 'admin' | 'driver';
  driverId?: string;
  at: string;
}

let subs: Sub[] = [];
let publicKey = '';
let store: Store;

export async function initPush(s: Store) {
  store = s;
  let keys = await store.getKv<{ publicKey: string; privateKey: string }>('vapid');
  if (!keys) {
    keys = webpush.generateVAPIDKeys();
    await store.setKv('vapid', keys);
  }
  publicKey = keys.publicKey;
  webpush.setVapidDetails(process.env.PUSH_CONTACT || 'mailto:bildirim@example.com', keys.publicKey, keys.privateKey);
  subs = (await store.getKv<Sub[]>('push-subs')) ?? [];
}

export const vapidPublicKey = () => publicKey;

export async function addSub(sub: { endpoint: string; keys: { p256dh: string; auth: string } }, role: Sub['role'], driverId?: string) {
  if (!sub?.endpoint || !sub.keys?.p256dh || !sub.keys?.auth) throw new Error('Geçersiz abonelik');
  subs = subs.filter((x) => x.endpoint !== sub.endpoint);
  subs.push({ endpoint: sub.endpoint, keys: sub.keys, role, driverId, at: new Date().toISOString() });
  await store.setKv('push-subs', subs);
}

export async function removeSub(endpoint: string) {
  subs = subs.filter((x) => x.endpoint !== endpoint);
  await store.setKv('push-subs', subs);
}

export interface PushMsg {
  title: string;
  body: string;
  url?: string;
  tag?: string;
}

/** Hedef kitleye bildirim gönder; geçersizleşen abonelikleri temizle. */
export async function notify(target: { role: 'admin' } | { role: 'driver'; driverId: string }, msg: PushMsg) {
  const list = subs.filter((s) => s.role === target.role && (target.role === 'admin' || s.driverId === target.driverId));
  if (!list.length) return;
  const dead: string[] = [];
  await Promise.all(
    list.map((s) =>
      webpush.sendNotification({ endpoint: s.endpoint, keys: s.keys }, JSON.stringify(msg), { TTL: 3600, urgency: 'high' }).catch((e: { statusCode?: number }) => {
        if (e.statusCode === 404 || e.statusCode === 410) dead.push(s.endpoint);
        else console.warn('[push] gönderilemedi', e.statusCode ?? (e as Error).message);
      }),
    ),
  );
  if (dead.length) {
    subs = subs.filter((s) => !dead.includes(s.endpoint));
    await store.setKv('push-subs', subs);
  }
}
