import type { BookingStatus, Lang } from '../types';

/** Rezervasyona bağlı şoför–yolcu mesajı */
export interface ChatMsg {
  id: string;
  from: 'driver' | 'customer';
  /** Serbest metin (hazır mesajlarda gönderenin dilindeki hali) */
  text: string;
  /** Hazır mesaj anahtarı: okuyan kişinin dilinde gösterilir */
  qr?: string;
  at: string;
}

export interface Chat {
  messages: ChatMsg[];
  /** Son okuma zamanları */
  read: { driver?: string; customer?: string };
}

/** Sohbet yalnızca şoför atanmış ve transfer sürerken açıktır */
export const CHAT_OPEN: BookingStatus[] = ['assigned', 'on_way', 'arrived', 'onboard'];
export const chatOpen = (status: BookingStatus, driverId?: string) => !!driverId && CHAT_OPEN.includes(status);

export const CHAT_MAX = 500;

type Q = Record<Lang, string>;
const q = (tr: string, en: string, ru: string, de: string, pl: string): Q => ({ tr, en, ru, de, pl });

/** Şoförün hazır mesajları */
export const DRIVER_QUICK: Record<string, Q> = {
  qr_onway: q('Yola çıktım, birazdan oradayım.', 'I’m on my way, see you shortly.', 'Я выехал, скоро буду.', 'Ich bin unterwegs und gleich da.', 'Jestem w drodze, zaraz będę.'),
  qr_5min: q('Yaklaşık 5 dakika içinde oradayım.', 'I’ll be there in about 5 minutes.', 'Буду примерно через 5 минут.', 'Ich bin in etwa 5 Minuten da.', 'Będę za około 5 minut.'),
  qr_traffic: q('Trafik var, birkaç dakika gecikebilirim.', 'There is traffic, I may be a few minutes late.', 'Пробки, могу немного задержаться.', 'Es gibt Stau, ich verspäte mich eventuell ein paar Minuten.', 'Są korki, mogę się spóźnić kilka minut.'),
  qr_arrived: q('Alış noktasına vardım, sizi bekliyorum.', 'I have arrived at the pick-up point and I’m waiting for you.', 'Я на месте подачи и жду вас.', 'Ich bin am Abholort angekommen und warte auf Sie.', 'Jestem na miejscu odbioru i czekam.'),
  qr_sign: q('Çıkış kapısında isim tabelasıyla bekliyorum.', 'I’m waiting at the arrivals exit with your name sign.', 'Жду у выхода из зоны прилёта с табличкой.', 'Ich warte am Ausgang der Ankunftshalle mit Ihrem Namensschild.', 'Czekam przy wyjściu z hali przylotów z tabliczką.'),
  qr_where: q('Neredesiniz? Sizi göremiyorum.', 'Where are you? I can’t see you.', 'Где вы? Я вас не вижу.', 'Wo sind Sie? Ich kann Sie nicht sehen.', 'Gdzie jesteś? Nie widzę Cię.'),
};

/** Yolcunun hazır mesajları */
export const CUSTOMER_QUICK: Record<string, Q> = {
  qc_landed: q('Uçağım indi, bagajımı bekliyorum.', 'My flight has landed, waiting for my luggage.', 'Самолёт приземлился, жду багаж.', 'Mein Flug ist gelandet, ich warte auf mein Gepäck.', 'Samolot wylądował, czekam na bagaż.'),
  qc_late: q('Biraz gecikeceğim, lütfen bekleyin.', 'I’ll be a little late, please wait.', 'Я немного задержусь, подождите, пожалуйста.', 'Ich verspäte mich etwas, bitte warten Sie.', 'Trochę się spóźnię, proszę poczekać.'),
  qc_ready: q('Hazırım, çıkıyorum.', 'I’m ready and coming out.', 'Я готов(а), выхожу.', 'Ich bin fertig und komme raus.', 'Jestem gotowy/a, wychodzę.'),
  qc_where: q('Neredesiniz?', 'Where are you?', 'Где вы?', 'Wo sind Sie?', 'Gdzie jesteś?'),
  qc_thanks: q('Teşekkürler!', 'Thank you!', 'Спасибо!', 'Danke!', 'Dziękuję!'),
};

export function quickText(key: string, lang: Lang): string | undefined {
  const x = DRIVER_QUICK[key] ?? CUSTOMER_QUICK[key];
  return x ? x[lang] || x.en : undefined;
}

/** Okuyan kişinin dilinde mesaj metni */
export const msgText = (m: ChatMsg, lang: Lang) => (m.qr && quickText(m.qr, lang)) || m.text;

export const translateLink = (text: string, to: Lang) =>
  `https://translate.google.com/?sl=auto&tl=${to}&text=${encodeURIComponent(text)}&op=translate`;

export function unreadCount(chat: Chat | undefined, me: 'driver' | 'customer') {
  if (!chat) return 0;
  const since = chat.read[me] ?? '';
  return chat.messages.filter((m) => m.from !== me && m.at > since).length;
}
