/**
 * Tarayıcının confirm/prompt/alert pencereleri yerine sitenin kendi
 * tasarımına uygun, Promise döndüren diyaloglar.
 */
interface Opts {
  title?: string;
  okText?: string;
  cancelText?: string;
  danger?: boolean;
  input?: { value: string; inputMode?: string; suffix?: string };
  hideCancel?: boolean;
}

function open(message: string, o: Opts): Promise<string | null> {
  return new Promise((resolve) => {
    const prevFocus = document.activeElement as HTMLElement | null;
    const bg = document.createElement('div');
    bg.className = 'dlg-bg';
    const box = document.createElement('div');
    box.className = 'dlg';
    box.setAttribute('role', 'alertdialog');
    box.setAttribute('aria-modal', 'true');
    if (o.title) {
      const h = document.createElement('h3');
      h.textContent = o.title;
      box.appendChild(h);
    }
    const p = document.createElement('p');
    p.textContent = message;
    box.appendChild(p);
    let input: HTMLInputElement | null = null;
    if (o.input) {
      const wrap = document.createElement('div');
      wrap.className = 'dlg-in';
      input = document.createElement('input');
      input.value = o.input.value;
      if (o.input.inputMode) input.inputMode = o.input.inputMode;
      wrap.appendChild(input);
      if (o.input.suffix) {
        const s = document.createElement('span');
        s.textContent = o.input.suffix;
        wrap.appendChild(s);
      }
      box.appendChild(wrap);
    }
    const acts = document.createElement('div');
    acts.className = 'dlg-acts';
    const cancel = document.createElement('button');
    cancel.className = 'abtn abtn-ghost';
    cancel.textContent = o.cancelText ?? 'Vazgeç';
    const ok = document.createElement('button');
    ok.className = `abtn ${o.danger ? 'abtn-dangerfill' : 'abtn-primary'}`;
    ok.textContent = o.okText ?? 'Tamam';
    if (!o.hideCancel) acts.appendChild(cancel);
    acts.appendChild(ok);
    box.appendChild(acts);
    bg.appendChild(box);
    document.body.appendChild(bg);

    const done = (v: string | null) => {
      document.removeEventListener('keydown', onKey, true);
      bg.classList.add('out');
      setTimeout(() => bg.remove(), 160);
      prevFocus?.focus?.();
      resolve(v);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        done(null);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        done(input ? input.value : '1');
      }
    };
    document.addEventListener('keydown', onKey, true);
    cancel.onclick = () => done(null);
    ok.onclick = () => done(input ? input.value : '1');
    bg.onmousedown = (e) => e.target === bg && done(null);
    setTimeout(() => (input ? (input.focus(), input.select()) : ok.focus()), 30);
  });
}

export const ask = (message: string, o: Omit<Opts, 'input'> = {}) =>
  open(message, { okText: 'Evet', ...o }).then((v) => v !== null);

export const askText = (message: string, value = '', o: Omit<Opts, 'input'> & { inputMode?: string; suffix?: string } = {}) =>
  open(message, { ...o, input: { value, inputMode: o.inputMode, suffix: o.suffix } });

export const notify = (message: string, title?: string) => {
  void open(message, { title, hideCancel: true, okText: 'Tamam' });
};
