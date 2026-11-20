import { useEffect } from 'react';

/** Tarayıcıda sayfa başlığı ve açıklamasını günceller (sayfalar arası geçişte). */
export function useSeo(title: string, description?: string) {
  useEffect(() => {
    document.title = title;
    if (description) {
      let m = document.querySelector<HTMLMetaElement>('meta[name="description"]');
      if (!m) {
        m = document.createElement('meta');
        m.name = 'description';
        document.head.appendChild(m);
      }
      m.content = description;
    }
  }, [title, description]);
}
