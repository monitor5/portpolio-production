import './style.css';
import { publications as originalPublications } from './data.js';
import { photos } from './media.js';
import { DEFAULT_LOCALE, SUPPORTED_LOCALES, getContent, localizeHref, normalizeLocale, resolveLocale, translate } from './i18n.js';

const app = document.querySelector('#app');
const arrow = '<span aria-hidden="true">↗</span>';
const chevron = '<span aria-hidden="true">›</span>';
const languageNames = { en: 'English', ko: '한국어', ja: '日本語' };
const localeStorageKey = 'portfolio-locale';
const e = value => String(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
let locale = DEFAULT_LOCALE;
let projects = [];
let hardware = [];
let publications = [];
let cleanup = () => {};

const t = (key, values) => translate(locale, key, values);
const tx = (key, values) => e(t(key, values));
const lines = key => t(key).split('\n').map(e).join('<br>');
const href = path => e(localizeHref(path, locale, location.href));
const routeLink = (path, html, cls = '') => `<a href="${href(path)}" data-route class="${cls}">${html}</a>`;
const external = (url, text, cls = '') => `<a href="${e(url)}" target="_blank" rel="noopener noreferrer" class="${cls}">${e(text)} ${arrow}<span class="sr-only">${tx('a11y.newTab')}</span></a>`;
const label = (n, text) => `<div class="section-label"><span aria-hidden="true">${e(n)}</span><span>${e(text)}</span></div>`;

function savedLocale() {
  try { return localStorage.getItem(localeStorageKey); } catch { return null; }
}
function persistLocale(value) {
  try { localStorage.setItem(localeStorageKey, value); } catch { /* Language still works when storage is unavailable. */ }
}
function localeFromLocation() {
  return resolveLocale({ urlValue: new URL(location.href).searchParams.get('lang'), storedValue: savedLocale() });
}

function languagePicker() {
  return `<details class="language-picker"><summary aria-label="${tx('a11y.language')}: ${e(languageNames[locale])}"><span>${locale.toUpperCase()}</span><span class="language-chevron" aria-hidden="true">⌄</span></summary><ul aria-label="${tx('a11y.languageList')}">${SUPPORTED_LOCALES.map(value => `<li><a href="${e(localizeHref(location.href, value, location.href))}" data-locale="${value}" aria-label="${e(languageNames[value])}" lang="${value}" hreflang="${value}" ${value === locale ? 'aria-current="true"' : ''}>${e(languageNames[value])}${value === locale ? '<span aria-hidden="true">✓</span>' : ''}</a></li>`).join('')}</ul></details>`;
}
function header(path) {
  const active = path.startsWith('/projects') ? 'projects' : path.startsWith('/lab') ? 'lab' : path.startsWith('/ai') ? 'ai' : 'story';
  const links = [['story', '/', 'nav.overview'], ['projects', '/projects', 'nav.projects'], ['lab', '/lab', 'nav.hardware'], ['ai', '/ai', 'nav.ai']];
  const dark = document.documentElement.dataset.theme === 'dark';
  return `<header class="site-header"><div class="header-inner">${routeLink('/', `<span class="brand-name">${tx('profile.name')}<span class="brand-period">.</span></span>`, 'brand')}<nav id="primary-nav" aria-label="${tx('a11y.nav')}">${links.map(([id, url, key]) => `<a href="${href(url)}" data-route ${active === id ? 'aria-current="page"' : ''}>${tx(key)}</a>`).join('')}${routeLink('/#about', tx('nav.about'))}</nav><div class="header-actions">${external('https://github.com/monitor5', 'GitHub', 'header-github')}${languagePicker()}<button class="theme-button" type="button" aria-label="${tx(dark ? 'a11y.light' : 'a11y.dark')}" aria-pressed="${dark}"><span aria-hidden="true">◐</span></button><button class="menu-button" aria-label="${tx('a11y.openMenu')}" aria-expanded="false" aria-controls="primary-nav"><span class="menu-mark" aria-hidden="true"><i></i><i></i></span></button></div></div></header>`;
}
function footer() {
  return `<footer id="contact" class="site-footer"><div class="container"><div class="footer-main"><p class="eyebrow">${tx('footer.label')}</p><h2>${lines('footer.title')}</h2><p>${lines('footer.description')}</p>${external('https://github.com/monitor5', t('action.connect'), 'button-primary')}</div><div class="footer-bottom"><span>${tx('profile.education')}</span><span>© ${new Date().getFullYear()} monitor5</span>${routeLink('/', `${tx('action.top')} ↑`)}</div></div></footer>`;
}
function phoneStage(cls = '') {
  return `<div class="galmegi-stage ${cls}"><div class="screens"><img class="screen screen-main" src="/assets/travel-home-latest.webp" alt="${tx('media.mapAlt')}" width="780" height="1678" loading="lazy"><img class="screen screen-ai" src="/assets/indoor-ai-location.webp" alt="${tx('media.aiAlt')}" width="780" height="1678" loading="lazy"></div><span class="stage-caption">${tx('media.caption')}</span></div>`;
}
function projectRow(p, i) {
  return routeLink(`/projects/${p.id}`, `<span class="row-number">${String(i + 1).padStart(2, '0')}</span><div class="project-row-title"><h3>${e(p.title)}</h3><p>${e(p.summary)}</p></div><span class="row-type">${e(p.type)}</span><span class="row-arrow" aria-hidden="true">↗</span>`, 'project-row');
}
function publicationDetails(p) {
  const text = e(p.detail);
  const originalJournal = e(translate('ko', 'publication.journal'));
  return locale === 'ko' ? text : text.replace(originalJournal, `<span lang="ko">${originalJournal}</span>`);
}
function publicationRow(p) {
  return routeLink(`/ai/${p.id}`, `<span class="publication-year">${e(p.year)}<span>${e(p.type)}</span></span><div><h3>${e(p.title)}</h3><p>${publicationDetails(p)} · ${e(p.role)}</p></div><span class="row-arrow" aria-hidden="true">›</span>`, 'publication-row');
}
function labCard(h) {
  const photo = photos[h.id];
  return routeLink(`/lab/${h.id}`, `${photo ? `<div class="lab-photo"><img src="${e(photo)}" alt="${tx('a11y.hardwarePhoto', { name: h.name })}" loading="lazy"></div>` : ''}<div class="lab-card-content"><span class="lab-index">${e(h.name)}</span><h3 class="lab-story-title">${e(h.title)}</h3><p class="lab-story-excerpt">${e(h.intro)}</p><div class="lab-card-bottom"><span class="lab-story-meta">${e(h.label)}</span><span class="lab-story-cta">${tx('action.story')} ${chevron}</span></div></div>`, `lab-card lab-story-card ${photo ? 'has-photo' : ''} lab-${h.id}`);
}
function originsSection() {
  return `<section id="origins" class="origins-section" aria-labelledby="origins-title"><div class="container">
    <div class="section-heading reveal"><p class="eyebrow">${tx('origins.label')}</p><h2 id="origins-title">${lines('origins.title')}</h2><p>${lines('origins.description')}</p></div>
    <article id="origin-mirror" class="origin-feature reveal"><div><p class="eyebrow">${tx('origins.mirrorPeriod')}</p><h3>${lines('origins.mirrorTitle')}</h3></div><div class="origin-feature-copy"><p>${tx('origins.mirrorBody')}</p>${routeLink('/lab/smart-mirror', `${tx('origins.mirrorLink')} ${chevron}`, 'button-text')}</div></article>
    <div class="origin-grid">${['vr', 'language', 'drone'].map(key => `<article id="origin-${key}" class="origin-note reveal"><p class="eyebrow">${tx(`origins.${key}Period`)}</p><h3>${tx(`origins.${key}Title`)}</h3><p>${tx(`origins.${key}Body`)}</p></article>`).join('')}</div>
  </div></section>`;
}
function experienceSection() {
  return `<section id="experience" class="experience-panel reveal" aria-labelledby="experience-title"><div class="experience-date"><p class="eyebrow">${tx('experience.label')}</p><time datetime="2022">2022</time></div><div class="experience-content"><p class="experience-organization">${tx('experience.organization')}</p><h3 id="experience-title">${tx('experience.title')}</h3><p>${tx('experience.body')}</p><ul class="experience-topics">${['kakao', 'database', 'backend'].map(key => `<li>${tx(`experience.${key}`)}</li>`).join('')}</ul></div></section>`;
}
function home() {
  const galmegi = projects.find(p => p.id === 'galmegi');
  const book = publications.find(p => p.id === 'book');
  return `<main id="main">
    <section id="intro" class="hero">
      <div class="container hero-content"><p class="hero-name">${tx('profile.name')} · ${tx('profile.role')}</p><h1>${tx('hero.line1')}<br><span class="gradient-text">${tx('hero.line2')}</span></h1><p class="hero-description">${lines('hero.description')}</p><div class="hero-actions"><a class="button-primary" href="${href('#selected-work')}">${tx('action.projects')}</a>${routeLink('/lab', `${tx('action.hardware')} ${chevron}`, 'button-text')}</div></div>
    </section>
    <section id="selected-work" class="selected-work"><div class="container"><div class="section-heading reveal"><p class="eyebrow">${tx('home.workLabel')}</p><h2>${tx('home.workTitle')}</h2><p>${tx('home.workDescription')}</p></div>
      <article class="featured-project reveal"><div class="feature-summary"><h3>${e(galmegi.title)}</h3><p class="feature-tagline">${tx('home.galmegiTagline')}</p><p class="feature-description">${lines('home.galmegiDescription')}</p><div class="feature-links">${routeLink('/projects/galmegi', `${tx('action.more')} ${chevron}`, 'button-text')}${external('https://galmegi.com', t('action.service'), 'button-text')}</div></div>${routeLink('/projects/galmegi', phoneStage(), 'stage-link')}<div class="feature-bottom"><div><span>${tx('home.roleLabel')}</span><p>${tx('home.role')}</p></div><div><span>${tx('home.periodLabel')}</span><p>${tx('home.period')}</p></div><div><span>${tx('home.statusLabel')}</span><p>${tx('home.status')}</p></div></div></article>
      <div class="project-spotlights reveal">${routeLink('/ai/book', `<div class="spotlight-book-copy"><span class="eyebrow">${tx('home.appliedLabel')}</span><h3>${e(book.title)}</h3><p>${lines('home.bookDescription')}</p><span class="spotlight-action">${tx('action.book')} ${chevron}</span></div><div class="spotlight-book-image"><img src="/assets/llm-defense-cover.jpg" alt="${tx('a11y.bookCover')}" width="545" height="800" loading="lazy"></div>`, 'spotlight-card spotlight-book')}${routeLink('/projects/tapo', `<span class="eyebrow">${tx('home.backendLabel')}</span><h3>${lines('home.tapoTitle')}</h3><p>${tx('home.tapoDescription')}</p><span class="spotlight-action">${tx('action.project')} ${chevron}</span>`, 'spotlight-card spotlight-server')}</div><div class="section-tail">${routeLink('/projects', `${tx('action.allProjects')} ${chevron}`, 'button-text')}</div>
    </div></section>
    <section id="hardware-story" class="home-lab"><div class="container"><div class="section-heading reveal"><p class="eyebrow">${tx('home.labLabel')}</p><h2>${tx('home.labTitle')}</h2><p>${lines('home.labDescription')}</p></div><div class="lab-feature-grid reveal">${hardware.slice(0, 3).map(labCard).join('')}</div><div class="lab-more reveal"><p>${tx('home.labMore')}</p>${routeLink('/lab', `${tx('action.hardware')} ${chevron}`, 'button-text')}</div></div></section>
    ${originsSection()}
    <section id="research" class="research-section"><div class="container"><div class="section-heading reveal"><p class="eyebrow">${tx('home.researchLabel')}</p><h2>${lines('home.researchTitle')}</h2><p>${lines('home.researchDescription')}</p></div><div class="publication-cards reveal">${publications.map(p => routeLink(`/ai/${p.id}`, `<span class="publication-kicker">${e(p.year)} · ${tx(p.id === 'paper' ? 'publication.paperType' : 'publication.bookType')}</span><h3>${e(p.title)}</h3><p>${tx(p.id === 'paper' ? 'publication.journal' : 'publication.publisher')}</p><span class="spotlight-action">${tx(p.id === 'paper' ? 'action.paper' : 'action.book')} ${chevron}</span>`, `publication-card publication-${p.id}`)).join('')}</div><div class="section-tail">${routeLink('/ai', `${tx('action.research')} ${chevron}`, 'button-text')}</div></div></section>
    <section id="about" class="about-section"><div class="container"><div class="about-panel ${photos.portrait ? 'has-portrait' : ''} reveal">${photos.portrait ? `<div class="portrait"><img src="${e(photos.portrait)}" alt="${tx('a11y.portrait')}" loading="lazy"></div>` : ''}<div class="about-content"><p class="eyebrow">${tx('home.aboutLabel')}</p><h2>${lines('home.aboutTitle')}</h2><p>${tx('home.aboutP1')}</p><p>${tx('home.aboutP2')}</p><p>${tx('home.aboutP3')}</p>${external('https://github.com/monitor5', t('action.github'), 'button-text')}</div></div>${experienceSection()}</div></section>
  </main>`;
}
function splitHeading(key) {
  const [first, ...rest] = t(key).split('\n');
  return `${e(first)}${rest.length ? `<br><em>${e(rest.join(' '))}</em>` : ''}`;
}
function projectsPage() {
  return `<main id="main" class="archive-page light-section"><div class="container"><div id="page-intro" class="archive-hero">${label('01', t('nav.projects'))}<h1>${splitHeading('projects.title')}</h1><p>${lines('projects.description')}</p></div><div class="filter-bar" data-scroll-key="filters" role="group" aria-label="${tx('projects.filterLabel')}"><button type="button" data-filter="all" aria-pressed="true">${tx('projects.all')} <span>${projects.length}</span></button><button type="button" data-filter="product" aria-pressed="false">${tx('projects.product')}</button><button type="button" data-filter="ai" aria-pressed="false">${tx('projects.ai')}</button><button type="button" data-filter="backend" aria-pressed="false">${tx('projects.backend')}</button></div><div id="project-list" class="archive-projects">${projects.map((p, i) => `<div data-category="${e((p.categories || [p.category]).join(' '))}">${projectRow(p, i)}</div>`).join('')}</div><p class="filter-count sr-only" aria-live="polite"></p><div class="archive-feature">${routeLink('/projects/galmegi', phoneStage(), 'stage-link')}</div></div></main>`;
}
function labPage() {
  return `<main id="main" class="lab-page"><div class="container"><div id="page-intro" class="archive-hero">${label('02', t('nav.hardware'))}<h1>${splitHeading('lab.title')}</h1><p>${lines('lab.description')}</p></div><div class="lab-manifesto"><p>${tx('lab.quote')}</p><span>${tx('lab.quoteNote')}</span></div><div id="hardware-list" class="lab-archive-grid">${hardware.map(labCard).join('')}</div><div class="lab-bridge"><span>${tx('lab.bridgeLabel')}</span><h2>${lines('lab.bridgeTitle')}</h2><p>${lines('lab.bridgeDescription')}</p>${routeLink('/projects/tapo', `${tx('action.tapo')} ${arrow}`, 'text-link')}</div></div></main>`;
}
function aiPage() {
  return `<main id="main" class="ai-page light-section"><div class="container"><div id="page-intro" class="archive-hero">${label('03', t('nav.ai'))}<h1>${splitHeading('ai.title')}</h1><p>${lines('ai.description')}</p></div><div class="ai-principles">${['apply', 'examine', 'share'].map(key => `<div><span>${tx(`ai.${key}Label`)}</span><h2>${tx(`ai.${key}Title`)}</h2><p>${tx(`ai.${key}Description`)}</p></div>`).join('')}</div><section id="publications"><div class="section-heading">${label('A', t('home.researchLabel'))}<h2>${tx('ai.publications')}</h2></div><div class="publication-list">${publications.map(publicationRow).join('')}</div></section><section id="applied-ai"><div class="section-heading ai-project-heading">${label('B', t('home.appliedLabel'))}<h2>${tx('ai.projects')}</h2></div>${projects.filter(p => p.category === 'ai' || p.id === 'galmegi').map(projectRow).join('')}</section></div></main>`;
}
function articleLayout({ eyebrow, title, lead, facts = [], body, back, backText, kind = 'light', next, originalTitle, leadLanguage }) {
  return `<main id="main" class="article-page ${kind === 'light' ? 'light-section' : ''}"><div class="container">${routeLink(back, `← ${e(backText)}`, 'article-back')}<header id="page-intro" class="article-header"><span class="eyebrow">${e(eyebrow)}</span><h1>${e(title)}</h1>${originalTitle ? `<p class="original-title">${tx('publication.originalTitle')}: <span lang="ko">${e(originalTitle)}</span></p>` : ''}${lead ? `<p${leadLanguage ? ` lang="${leadLanguage}"` : ''}>${e(lead)}</p>` : ''}</header>${facts.length ? `<dl class="article-facts">${facts.map(([key, value]) => `<div><dt>${e(key)}</dt><dd>${e(value)}</dd></div>`).join('')}</dl>` : ''}${body}${next ? `<div class="article-next"><span>${tx('detail.continue')}</span>${routeLink(next.url, `${e(next.title)} ${arrow}`)}</div>` : ''}</div></main>`;
}
function projectPage(p) {
  const image = p.id === 'galmegi' ? phoneStage('article-stage') : '';
  const architecture = p.id === 'galmegi' ? `<div class="system-map" aria-label="${tx('system.a11y')}"><span class="eyebrow">${tx('system.label')}</span><div class="system-flow"><div>${tx('system.client')}<small>React · Kotlin WebView</small></div><span aria-hidden="true">→</span><div>${tx('system.backend')}<small>Spring Boot · Java</small></div><span aria-hidden="true">→</span><div>${tx('system.data')}<small>MySQL · ETL · LLM</small></div></div><p>${tx('system.note')}</p></div>` : '';
  const body = `${image}<div class="article-content"><aside class="article-aside"><span>${tx('detail.inProject')}</span>${p.sections.map(([title], i) => `<a href="${href(`#part-${i}`)}">${e(title)}</a>`).join('')}<div class="stack-list">${p.stack.map(item => `<span>${e(item)}</span>`).join('')}</div></aside><div class="article-prose">${p.sections.map(([title, paragraph], i) => `<section id="part-${i}"><span class="part-number">${String(i + 1).padStart(2, '0')}</span><h2>${e(title)}</h2><p>${e(paragraph)}</p></section>`).join('')}${architecture}${!p.verifiedRole ? `<p class="source-note">${tx('detail.sourceNote')}</p>` : ''}<div class="article-links">${p.links.map(([text, url]) => external(url, text, 'solid-link')).join('')}</div></div></div>`;
  return articleLayout({ eyebrow: p.type, title: p.title, lead: p.intro, facts: p.facts, body, back: '/projects', backText: t('detail.projectBack'), next: { url: '/lab', title: t('detail.hardwareNext') } });
}
function hardwarePage(h) {
  const photo = photos[h.id];
  const body = `${photo ? `<figure class="hardware-detail-photo"><img src="${e(photo)}" alt="${tx('a11y.hardwarePhoto', { name: h.name })}"><figcaption>${e(h.name)} · ${e(h.label)}</figcaption></figure>` : `<div class="hardware-context"><span>${e(h.name)}</span><span>${e(h.label)}</span></div>`}<div class="article-content"><aside class="article-aside"><span>${tx('detail.hardwareLog')}</span><p>${e(h.name)}</p><p>${e(h.label)}</p></aside><div class="article-prose">${h.sections.map(([title, paragraph], i) => `<section id="part-${i}"><span class="part-number">${String(i + 1).padStart(2, '0')}</span><h2>${e(title)}</h2><p>${e(paragraph)}</p></section>`).join('')}${h.related ? routeLink(`/projects/${h.related}`, `${tx('detail.relatedTapo')} ${arrow}`, 'solid-link') : ''}</div></div>`;
  const next = hardware[(hardware.indexOf(h) + 1) % hardware.length];
  return articleLayout({ eyebrow: h.kind, title: h.title, lead: h.intro, body, back: '/lab', backText: t('detail.hardwareBack'), kind: 'dark', next: { url: `/lab/${next.id}`, title: next.title } });
}
function publicationPage(p) {
  const original = originalPublications.find(item => item.id === p.id);
  const body = `${p.id === 'book' ? `<figure class="book-cover-figure"><img src="/assets/llm-defense-cover.jpg" alt="${tx('a11y.bookCover')}" width="545" height="800"><figcaption>${tx('publication.coverCredit')}</figcaption></figure>` : ''}<div class="article-content"><aside class="article-aside"><span>${e(p.type)}</span><p>${e(p.role)}</p></aside><div class="article-prose">${locale !== 'ko' ? `<p class="translation-note">${tx(p.id === 'paper' ? 'publication.paperLanguageNote' : 'publication.bookLanguageNote')}</p>` : ''}<section id="research-question"><h2>${tx('publication.question')}</h2><p>${e(p.description)}</p></section><section id="bibliography"><h2>${tx('publication.bibliography')}</h2><dl class="bibliography"><div><dt>${tx('publication.titleLabel')}</dt><dd>${e(p.title)}</dd></div>${locale !== 'ko' ? `<div><dt>${tx('publication.originalTitle')}</dt><dd lang="ko">${e(original.title)}</dd></div>` : ''}<div><dt>${tx('publication.authorsLabel')}</dt><dd lang="ko">${e(original.authors)}</dd></div><div><dt>${tx('publication.editionLabel')}</dt><dd>${publicationDetails(p)}</dd></div>${p.id === 'paper' ? '<div><dt>DOI</dt><dd>10.23425/defsec.2024.6.1.302</dd></div>' : '<div><dt>ISBN</dt><dd>9791143025302</dd></div>'}</dl></section>${external(p.url, t(p.id === 'paper' ? 'publication.readKci' : 'publication.readPublisher'), 'solid-link')}</div></div>`;
  return articleLayout({ eyebrow: `${p.year} / ${p.type}`, title: p.title, lead: p.subtitle === p.title ? p.description : p.subtitle, originalTitle: locale === 'ko' ? null : original.title, leadLanguage: p.id === 'paper' && p.subtitle !== p.title ? 'en' : null, body, back: '/ai', backText: t('detail.aiBack'), next: { url: '/projects/galmegi', title: t('detail.aiNext') } });
}
function notFound() {
  return `<main id="main" class="not-found container"><span class="eyebrow">404</span><h1>${lines('error.title')}</h1>${routeLink('/', `${tx('error.back')} ${arrow}`, 'solid-link')}</main>`;
}
function currentPath() { return location.pathname.replace(/\/$/, '') || '/'; }
function metadata(title, description) {
  document.documentElement.lang = locale;
  document.documentElement.dataset.locale = locale;
  document.title = title;
  document.querySelector('meta[name="description"]').setAttribute('content', description);
  const values = { 'og:title': title, 'og:description': description, 'og:locale': { en: 'en_US', ko: 'ko_KR', ja: 'ja_JP' }[locale] };
  for (const [property, content] of Object.entries(values)) {
    let element = document.querySelector(`meta[property="${property}"]`);
    if (!element) { element = document.createElement('meta'); element.setAttribute('property', property); document.head.append(element); }
    element.setAttribute('content', content);
  }
  const alternateBase = new URL(location.href);
  alternateBase.hash = '';
  document.querySelectorAll('link[data-language-alternate]').forEach(element => element.remove());
  for (const language of [...SUPPORTED_LOCALES, 'x-default']) {
    const alternate = document.createElement('link');
    alternate.rel = 'alternate';
    alternate.hreflang = language;
    alternate.dataset.languageAlternate = '';
    alternate.href = localizeHref(alternateBase.href, language === 'x-default' ? DEFAULT_LOCALE : language, alternateBase.href);
    document.head.append(alternate);
  }
  document.querySelector('.skip-link').textContent = t('a11y.skip');
  document.querySelector('.skip-link').href = localizeHref('#main', locale, location.href);
}
function render({ scroll = true } = {}) {
  cleanup();
  ({ projects, hardware, publications } = getContent(locale));
  const path = currentPath();
  let page;
  let title = t('meta.homeTitle');
  let description = t('meta.description');
  if (path === '/') page = home();
  else if (path === '/projects') { page = projectsPage(); title = t('meta.title', { title: t('nav.projects') }); }
  else if (path === '/lab') { page = labPage(); title = t('meta.title', { title: t('nav.hardware') }); }
  else if (path === '/ai') { page = aiPage(); title = t('meta.title', { title: t('nav.ai') }); }
  else {
    const [group, id, extra] = path.slice(1).split('/');
    const list = { projects, lab: hardware, ai: publications }[group];
    const item = !extra && list?.find(item => item.id === id);
    if (item) {
      page = group === 'projects' ? projectPage(item) : group === 'lab' ? hardwarePage(item) : publicationPage(item);
      title = t('meta.title', { title: item.title });
      description = item.intro || item.description;
    } else { page = notFound(); title = t('meta.title', { title: t('error.pageTitle') }); }
  }
  metadata(title, description);
  document.documentElement.dataset.page = path === '/' ? 'home' : path.startsWith('/lab') ? 'lab' : 'content';
  app.innerHTML = header(path) + page + footer();
  syncTheme();
  document.querySelector('.theme-button').addEventListener('click', () => setTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'));
  const menu = document.querySelector('.menu-button');
  document.querySelector('.language-picker').addEventListener('toggle', event => {
    if (event.currentTarget.open) {
      menu.setAttribute('aria-expanded', 'false');
      menu.setAttribute('aria-label', t('a11y.openMenu'));
      document.querySelector('.site-header').classList.remove('menu-open');
    }
  });
  menu.addEventListener('click', () => {
    const open = menu.getAttribute('aria-expanded') !== 'true';
    menu.setAttribute('aria-expanded', String(open));
    menu.setAttribute('aria-label', t(open ? 'a11y.closeMenu' : 'a11y.openMenu'));
    document.querySelector('.site-header').classList.toggle('menu-open', open);
  });
  const applyFilter = value => {
    document.querySelectorAll('[data-filter]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.filter === value)));
    let count = 0;
    document.querySelectorAll('[data-category]').forEach(row => { row.hidden = value !== 'all' && !row.dataset.category.split(' ').includes(value); if (!row.hidden) count++; });
    const status = document.querySelector('.filter-count');
    const countKey = new Intl.PluralRules(locale).select(count) === 'one' ? 'projects.countOne' : 'projects.count';
    if (status) status.textContent = t(countKey, { count: new Intl.NumberFormat(locale).format(count) });
  };
  document.querySelectorAll('[data-filter]').forEach(button => button.addEventListener('click', () => {
    history.replaceState({ ...history.state, filter: button.dataset.filter }, '', location.href);
    applyFilter(button.dataset.filter);
  }));
  if (path === '/projects') applyFilter(['product', 'ai', 'backend'].includes(history.state?.filter) ? history.state.filter : 'all');
  const observer = new IntersectionObserver(entries => {
    for (const entry of entries) if (entry.isIntersecting) { entry.target.classList.add('is-visible'); observer.unobserve(entry.target); }
  }, { threshold: 0.08 });
  document.querySelectorAll('.reveal').forEach(element => observer.observe(element));
  const onScroll = () => document.querySelector('.site-header')?.classList.toggle('scrolled', scrollY > 20);
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
  cleanup = () => { observer.disconnect(); window.removeEventListener('scroll', onScroll); };
  if (scroll) window.scrollTo({ top: 0, behavior: 'instant' });
}
function syncTheme() {
  const dark = document.documentElement.dataset.theme === 'dark';
  const control = document.querySelector('.theme-button');
  control?.setAttribute('aria-label', t(dark ? 'a11y.light' : 'a11y.dark'));
  control?.setAttribute('aria-pressed', String(dark));
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#000000' : '#fbfbfd');
}
function setTheme(theme) {
  document.documentElement.dataset.theme = theme;
  try { localStorage.setItem('portfolio-theme', theme); } catch { /* Ephemeral theme remains usable. */ }
  syncTheme();
}
function scrollToHash() {
  const id = location.hash.slice(1);
  if (id) requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView({ behavior: 'instant' }));
}
function saveScroll() { history.replaceState({ ...history.state, scrollY }, '', location.href); }
function readingPosition() {
  const candidates = [...document.querySelectorAll('#main [id], #main [data-scroll-key]')].filter(element => {
    const bounds = element.getBoundingClientRect();
    return bounds.width > 0 && bounds.top <= 110;
  });
  const anchor = candidates.at(-1);
  return { y: scrollY, id: anchor?.id, key: anchor?.dataset.scrollKey, offset: anchor?.getBoundingClientRect().top };
}
function restoreReadingPosition(position) {
  requestAnimationFrame(() => {
    const anchor = position.id ? document.getElementById(position.id) : position.key ? document.querySelector(`[data-scroll-key="${CSS.escape(position.key)}"]`) : null;
    const top = anchor ? scrollY + anchor.getBoundingClientRect().top - position.offset : position.y;
    window.scrollTo({ top, behavior: 'instant' });
  });
}
function setLocale(value) {
  const next = normalizeLocale(value);
  if (!next) return;
  const position = readingPosition();
  locale = next;
  persistLocale(locale);
  history.replaceState({ ...history.state }, '', localizeHref(location.href, locale, location.href));
  render({ scroll: false });
  restoreReadingPosition(position);
  document.querySelector('.language-picker summary')?.focus({ preventScroll: true });
}
function plainClick(event) { return !event.defaultPrevented && event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey; }
document.addEventListener('click', event => {
  const language = event.target.closest('a[data-locale]');
  if (language && plainClick(event)) { event.preventDefault(); setLocale(language.dataset.locale); return; }
  const link = event.target.closest('a[data-route]');
  if (link && plainClick(event)) {
    event.preventDefault();
    saveScroll();
    history.pushState({ scrollY: 0 }, '', link.href);
    locale = localeFromLocation();
    render();
    scrollToHash();
    const main = document.querySelector('#main');
    main.setAttribute('tabindex', '-1');
    main.focus({ preventScroll: true });
    return;
  }
  if (!event.target.closest('.language-picker')) document.querySelector('.language-picker')?.removeAttribute('open');
});
document.addEventListener('keydown', event => {
  if (event.key !== 'Escape') return;
  const picker = document.querySelector('.language-picker[open]');
  if (picker) { picker.removeAttribute('open'); picker.querySelector('summary').focus(); return; }
  const button = document.querySelector('.menu-button');
  if (button?.getAttribute('aria-expanded') === 'true') { button.click(); button.focus(); }
});
window.addEventListener('popstate', () => {
  locale = localeFromLocation();
  render({ scroll: false });
  if (location.hash) scrollToHash();
  else requestAnimationFrame(() => window.scrollTo({ top: history.state?.scrollY || 0, behavior: 'instant' }));
});
history.scrollRestoration = 'manual';
let initialTheme = 'light';
try { initialTheme = localStorage.getItem('portfolio-theme') === 'dark' ? 'dark' : 'light'; } catch { /* Default to light. */ }
document.documentElement.dataset.theme = initialTheme;
locale = localeFromLocation();
if (normalizeLocale(new URL(location.href).searchParams.get('lang'))) persistLocale(locale);
render({ scroll: !location.hash });
scrollToHash();
