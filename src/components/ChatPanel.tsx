import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Languages, Loader2, Lock, Send, ShieldCheck } from 'lucide-react';
import { loadChat, markChatRead, sendChat, useChat } from '../data/store';
import { CHAT_MAX, CUSTOMER_QUICK, DRIVER_QUICK, chatOpen, msgText, translateLink } from '../lib/chat';
import { STRINGS } from '../lib/i18n';
import type { Booking, Lang } from '../types';

type As = 'customer' | 'driver' | 'admin';

/**
 * Rezervasyona bağlı şoför–yolcu sohbeti.
 * customer/driver yazabilir; admin yalnızca okur.
 */
export function ChatPanel({ b, as, lang, height = 320 }: { b: Booking; as: As; lang: Lang; height?: number }) {
  const cs = useChat(b.id);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const list = useRef<HTMLDivElement>(null);
  const t = (k: keyof typeof STRINGS) => STRINGS[k][lang];
  const open = cs ? cs.open : chatOpen(b.status, b.driverId);
  const msgs = cs?.chat.messages ?? [];
  const me = as === 'admin' ? null : as;
  const quick = as === 'driver' ? DRIVER_QUICK : CUSTOMER_QUICK;

  useEffect(() => {
    void loadChat(as, b).catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [b.id, as]);

  // Yeni mesajda en alta kay ve okundu işaretle
  useEffect(() => {
    list.current?.scrollTo({ top: list.current.scrollHeight });
    const last = msgs[msgs.length - 1];
    if (me && last && last.from !== me && (cs?.chat.read[me] ?? '') < last.at) void markChatRead(me, b);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [msgs.length]);

  const send = async (body: { text?: string; qr?: string }) => {
    if (!me || busy) return;
    setBusy(true);
    setErr('');
    try {
      const display = body.qr ? quick[body.qr][as === 'customer' ? b.lang : 'tr'] : undefined;
      await sendChat(me, b, { ...body, display });
      if (body.text) setText('');
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (text.trim()) void send({ text: text.trim() });
  };

  const time = (iso: string) => new Date(iso).toLocaleTimeString(lang, { hour: '2-digit', minute: '2-digit' });

  return (
    <div className={`chat chat-${as}`}>
      <div className="chat-list" ref={list} style={{ maxHeight: height }}>
        {msgs.length === 0 && <p className="chat-empty">{as === 'customer' ? t('chatEmpty') : 'Henüz mesaj yok.'}</p>}
        {msgs.map((m) => {
          const mine = me ? m.from === me : m.from === 'driver';
          const body = msgText(m, lang);
          return (
            <div key={m.id} className={`bubble ${mine ? 'mine' : 'theirs'}`}>
              {as === 'admin' && <small className="who">{m.from === 'driver' ? 'Şoför' : 'Yolcu'}</small>}
              <p>{body}</p>
              <span className="meta">
                {time(m.at)}
                {!mine && !m.qr && me && (
                  <a href={translateLink(m.text, lang)} target="_blank" rel="noopener noreferrer"><Languages size={11} /> {as === 'customer' ? t('chatTranslate') : 'Çevir'}</a>
                )}
              </span>
            </div>
          );
        })}
      </div>

      {as === 'admin' ? (
        <p className="chat-note"><ShieldCheck size={14} /> Yalnızca görüntüleme. {open ? 'Sohbet açık.' : 'Sohbet kapalı.'}</p>
      ) : !open ? (
        <p className="chat-note closed"><Lock size={14} /> {as === 'customer' ? t('chatClosed') : 'Sohbet kapalı (iş bitti veya şoför değişti).'}</p>
      ) : (
        <>
          <div className="chat-quick">
            {Object.entries(quick).map(([k, v]) => (
              <button key={k} type="button" disabled={busy} onClick={() => send({ qr: k })}>{v[lang] || v.en}</button>
            ))}
          </div>
          <form className="chat-input" onSubmit={submit}>
            <input value={text} maxLength={CHAT_MAX} onChange={(e) => setText(e.target.value)} placeholder={as === 'customer' ? t('chatPlaceholder') : 'Mesaj yazın…'} aria-label={as === 'customer' ? t('chatPlaceholder') : 'Mesaj'} />
            <button disabled={busy || !text.trim()} aria-label={as === 'customer' ? t('chatSend') : 'Gönder'}>
              {busy ? <Loader2 size={18} className="spin" /> : <Send size={18} />}
            </button>
          </form>
          {err && <p className="err">{err}</p>}
          <p className="chat-note"><ShieldCheck size={13} /> {as === 'customer' ? t('chatMonitored') : 'Mesajlar firma tarafından görülebilir.'}</p>
        </>
      )}
    </div>
  );
}
