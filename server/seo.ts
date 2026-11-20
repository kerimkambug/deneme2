/**
 * Arama motorları ve yapay zekâ botları için sayfa ön-işleme.
 * Botların çoğu (ChatGPT, Claude, Perplexity tarayıcıları) JavaScript çalıştırmaz; bu yüzden
 * her herkese açık sayfanın içeriği HTML olarak da gönderilir. Tarayıcıda React yüklenince bu içeriğin yerini alır.
 */
import type { Request } from 'express';
import { LANGS, type Lang } from '../src/types';
import type { Config } from './db';
import { businessLd, faqLd, homeTexts, langUrl, llmsTxt, publicRoutes, routeBySlug, routeLd, routeOffers, routeSlug, routeTexts, tx } from '../src/lib/seo';

const esc = (t: unknown) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const ld = (o: unknown) => `<script type="application/ld+json">${JSON.stringify(o).replace(/</g, '\\u003c')}</script>`;

export function baseUrl(req: Request) {
  const env = process.env.SITE_URL?.trim().replace(/\/+$/, '');
  if (env) return env;
  const proto = String(req.headers['x-forwarded-proto'] ?? req.protocol).split(',')[0];
  return `${proto}://${req.headers['x-forwarded-host'] ?? req.headers.host}`;
}

export function reqLang(req: Request): Lang {
  const q = String(req.query.lang ?? '');
  return (LANGS as readonly string[]).includes(q) ? (q as Lang) : 'tr';
}

const PRIVATE = /^\/(panel|surucu|hesap|takip)(\/|$)/;

interface Page {
  title: string;
  description: string;
  /** Dil parametresi olmadan yol */
  path: string;
  body: string;
  jsonld: unknown[];
  index: boolean;
}

function contactBlock(c: Config, lang: Lang) {
  const s = c.settings;
  const items = [
    s.phone && `<li>Tel: <a href="tel:${esc(s.phone.replace(/\s/g, ''))}">${esc(s.phone)}</a></li>`,
    s.whatsapp && `<li>WhatsApp: <a href="https://wa.me/${esc(s.whatsapp)}">+${esc(s.whatsapp)}</a></li>`,
    s.email && `<li>E-mail: <a href="mailto:${esc(s.email)}">${esc(s.email)}</a></li>`,
    s.address && `<li>${esc(s.address)}</li>`,
    s.licenseNo && `<li>${esc(s.licenseNo)}</li>`,
  ].filter(Boolean);
  return `<section><h2>${tx('contactH', lang)}</h2><ul>${items.join('')}</ul></section>`;
}

function routesList(c: Config, base: string, lang: Lang, skipId?: string) {
  const items = publicRoutes(c)
    .filter((r) => r.id !== skipId)
    .map((r) => {
      const t = routeTexts(c, r, lang);
      return `<li><a href="${esc(langUrl(base, `/transfer/${routeSlug(c, r)}`, lang))}">${esc(t.h1)}</a> · ${r.distanceKm} km · ~${r.durationMin} min · ${esc(tx('from', lang, { p: t.offers[0].price }))}</li>`;
    });
  return items.length ? `<section><h2>${tx('routesH', lang)}</h2><ul>${items.join('')}</ul></section>` : '';
}

function homePage(c: Config, base: string, lang: Lang): Page {
  const s = c.settings;
  const h = homeTexts(c, lang);
  const faqs = s.faqs.map((f) => ({ q: f.q[lang] || f.q.tr, a: f.a[lang] || f.a.tr }));
  const vehicles = c.vehicles
    .filter((v) => v.active)
    .map((v) => `<li><b>${esc(v.name)}</b> (${esc(v.category[lang] || v.category.tr)}): ${v.pax} ${lang === 'tr' ? 'kişi' : 'pax'}, ${v.luggage} ${lang === 'tr' ? 'bavul' : 'bags'}. ${esc(v.description[lang] || v.description.tr)}</li>`);
  const services = s.services.map((x) => `<li><b>${esc(x.title[lang] || x.title.tr)}</b>: ${esc(x.desc[lang] || x.desc.tr)}</li>`);
  const body = [
    `<h1>${esc(h.h1)}</h1>`,
    `<p>${esc(h.description)}</p>`,
    `<p><a href="${esc(langUrl(base, '/rezervasyon', lang))}">${tx('book', lang)}</a></p>`,
    `<section><p>${esc(s.aboutText[lang] || s.aboutText.tr)}</p></section>`,
    services.length ? `<section><ul>${services.join('')}</ul></section>` : '',
    routesList(c, base, lang),
    vehicles.length ? `<section><h2>${tx('vehiclesH', lang)}</h2><ul>${vehicles.join('')}</ul></section>` : '',
    faqs.length ? `<section><h2>${tx('faqH', lang)}</h2>${faqs.map((f) => `<h3>${esc(f.q)}</h3><p>${esc(f.a)}</p>`).join('')}</section>` : '',
    contactBlock(c, lang),
  ].join('');
  return { title: h.title, description: h.description, path: '/', body, jsonld: [businessLd(c, base, lang), { '@context': 'https://schema.org', '@type': 'WebSite', name: s.companyName, url: `${base}/`, inLanguage: [...LANGS] }, ...(faqs.length ? [faqLd(faqs)] : [])], index: true };
}

function routePage(c: Config, base: string, lang: Lang, slug: string): Page | null {
  const r = routeBySlug(c, slug);
  if (!r || !routeOffers(c, r).length) return null;
  const t = routeTexts(c, r, lang);
  const body = [
    `<nav><a href="${esc(langUrl(base, '/', lang))}">${tx('home', lang)}</a> › ${esc(t.h1)}</nav>`,
    `<h1>${esc(t.h1)}</h1>`,
    `<p>${esc(t.description)}</p>`,
    `<table><tbody>${t.offers.map((o) => `<tr><td>${esc(o.vehicle.name)}</td><td>${o.vehicle.pax} / ${o.vehicle.luggage}</td><td>${o.price} €</td></tr>`).join('')}</tbody></table>`,
    `<p><a href="${esc(`${base}/rezervasyon?from=${r.from}&to=${r.to}`)}">${tx('book', lang)}</a></p>`,
    `<section>${t.faq.map((f) => `<h2>${esc(f.q)}</h2><p>${esc(f.a)}</p>`).join('')}</section>`,
    routesList(c, base, lang, r.id),
    contactBlock(c, lang),
  ].join('');
  return { title: t.title, description: t.description, path: `/transfer/${slug}`, body, jsonld: [businessLd(c, base, lang), ...routeLd(c, r, base, lang)], index: true };
}

function simplePage(c: Config, base: string, lang: Lang, path: string, h1: string): Page {
  const h = homeTexts(c, lang);
  return { title: `${h1} | ${c.settings.companyName}`, description: h.description, path, body: `<h1>${esc(h1)}</h1>${routesList(c, base, lang)}${contactBlock(c, lang)}`, jsonld: [businessLd(c, base, lang)], index: true };
}

/** index.html içine başlık, meta etiketleri, yapılandırılmış veri ve içerik yerleştirir. */
export function renderHtml(html: string, c: Config, req: Request) {
  const base = baseUrl(req);
  const lang = reqLang(req);
  const p = req.path.replace(/\/+$/, '') || '/';
  if (PRIVATE.test(p)) {
    return { status: 200, html: html.replace('</head>', '<meta name="robots" content="noindex, nofollow" /></head>') };
  }
  const m = p.match(/^\/transfer\/([a-z0-9-]+)$/);
  let page: Page | null =
    p === '/' ? homePage(c, base, lang)
    : m ? routePage(c, base, lang, m[1])
    : p === '/rezervasyon' ? simplePage(c, base, lang, p, tx('bookTitle', lang))
    : p === '/gizlilik' ? simplePage(c, base, lang, p, tx('privacyTitle', lang))
    : null;
  let status = 200;
  if (!page) {
    status = 404;
    page = { ...homePage(c, base, lang), index: false };
  }
  const canonical = langUrl(base, page.path, lang);
  const og = /^https?:\/\//.test(c.settings.heroImage) ? c.settings.heroImage : `${base}/icon-512.png`;
  const head = [
    `<meta name="description" content="${esc(page.description)}" />`,
    page.index ? `<link rel="canonical" href="${esc(canonical)}" />` : '<meta name="robots" content="noindex" />',
    ...(page.index ? LANGS.map((l) => `<link rel="alternate" hreflang="${l}" href="${esc(langUrl(base, page!.path, l))}" />`) : []),
    page.index ? `<link rel="alternate" hreflang="x-default" href="${esc(langUrl(base, page.path, 'tr'))}" />` : '',
    `<meta property="og:type" content="website" />`,
    `<meta property="og:site_name" content="${esc(c.settings.companyName)}" />`,
    `<meta property="og:title" content="${esc(page.title)}" />`,
    `<meta property="og:description" content="${esc(page.description)}" />`,
    `<meta property="og:url" content="${esc(canonical)}" />`,
    `<meta property="og:image" content="${esc(og)}" />`,
    `<meta property="og:locale" content="${{ tr: 'tr_TR', en: 'en_GB', ru: 'ru_RU', de: 'de_DE', pl: 'pl_PL' }[lang]}" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<link rel="alternate" type="text/markdown" title="LLM summary" href="${esc(base)}/llms.txt" />`,
    ...page.jsonld.map(ld),
    '<style>.seo-pre{max-width:820px;margin:0 auto;padding:32px 18px;font:16px/1.6 system-ui,sans-serif;color:#222}.seo-pre a{color:#8a6d2f}.seo-pre table{border-collapse:collapse}.seo-pre td{padding:4px 12px 4px 0}</style>',
  ].join('\n    ');
  const out = html
    .replace(/<html lang="[^"]*">/, `<html lang="${lang}">`)
    .replace(/<title>.*?<\/title>/s, `<title>${esc(page.title)}</title>`)
    .replace(/\s*<meta name="description"[^>]*>/, '')
    .replace(/\s*<meta property="og:[^>]*>/g, '')
    .replace('</head>', `    ${head}\n  </head>`)
    .replace('<div id="root"></div>', `<div id="root"><main class="seo-pre">${page.body}</main></div>`);
  return { status, html: out };
}

export function robotsTxt(base: string) {
  const rules = ['Allow: /', 'Disallow: /panel', 'Disallow: /surucu', 'Disallow: /hesap', 'Disallow: /takip', 'Disallow: /api/'];
  // Yapay zekâ arama botlarına açıkça izin ver (site önerilerde görünsün)
  const bots = ['*', 'Googlebot', 'Bingbot', 'YandexBot', 'GPTBot', 'OAI-SearchBot', 'ChatGPT-User', 'ClaudeBot', 'Claude-SearchBot', 'Claude-User', 'PerplexityBot', 'Perplexity-User', 'Google-Extended', 'Applebot', 'Applebot-Extended'];
  return `${bots.map((b) => `User-agent: ${b}\n${rules.join('\n')}`).join('\n\n')}\n\nSitemap: ${base}/sitemap.xml\n`;
}

export function sitemapXml(c: Config, base: string) {
  const paths = ['/', '/rezervasyon', ...publicRoutes(c).map((r) => `/transfer/${routeSlug(c, r)}`), '/gizlilik'];
  const url = (p: string) =>
    LANGS.map(
      (l) =>
        `  <url>\n    <loc>${esc(langUrl(base, p, l))}</loc>\n${LANGS.map((x) => `    <xhtml:link rel="alternate" hreflang="${x}" href="${esc(langUrl(base, p, x))}"/>`).join('\n')}\n    <xhtml:link rel="alternate" hreflang="x-default" href="${esc(langUrl(base, p, 'tr'))}"/>\n  </url>`,
    ).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${paths.map(url).join('\n')}\n</urlset>\n`;
}

export { llmsTxt };
