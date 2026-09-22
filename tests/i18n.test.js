import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DEFAULT_LOCALE,
  SUPPORTED_LOCALES,
  getContent,
  localizeHref,
  normalizeLocale,
  resolveLocale,
  translate,
} from '../src/i18n.js';
import { messages } from '../src/locales/messages.js';
import * as source from '../src/data.js';

const collections = ['projects', 'hardware', 'publications'];
const parameterPattern = /\{([A-Za-z_][A-Za-z0-9_]*)\}/g;
const parameters = (message) => [...new Set(
  [...message.matchAll(parameterPattern)].map((match) => match[1]),
)].sort();

function inspectStrings(value, visit, path = '') {
  if (typeof value === 'string') return visit(value, path);
  if (Array.isArray(value)) {
    value.forEach((child, index) => inspectStrings(child, visit, `${path}[${index}]`));
    return;
  }
  if (value && typeof value === 'object') {
    Object.entries(value).forEach(([key, child]) => {
      inspectStrings(child, visit, path ? `${path}.${key}` : key);
    });
  }
}

function assertSameShape(actual, expected, path) {
  if (Array.isArray(expected)) {
    assert.ok(Array.isArray(actual), `${path} must remain an array`);
    assert.equal(actual.length, expected.length, `${path} must preserve all entries`);
    expected.forEach((child, index) => assertSameShape(actual[index], child, `${path}[${index}]`));
  } else if (expected && typeof expected === 'object') {
    assert.ok(actual && typeof actual === 'object' && !Array.isArray(actual), `${path} must remain an object`);
    assert.deepEqual(Object.keys(actual).sort(), Object.keys(expected).sort(), `${path} fields must match`);
    Object.entries(expected).forEach(([key, child]) => assertSameShape(actual[key], child, `${path}.${key}`));
  } else {
    assert.equal(typeof actual, typeof expected, `${path} must preserve its value type`);
  }
}

test('English is the default and locale resolution honors URL, saved choice, then default', () => {
  assert.deepEqual(SUPPORTED_LOCALES, ['en', 'ko', 'ja']);
  assert.equal(DEFAULT_LOCALE, 'en');
  assert.equal(resolveLocale(), 'en');
  assert.equal(resolveLocale({}), 'en');
  assert.equal(resolveLocale({ urlValue: 'ja', storedValue: 'ko' }), 'ja');
  assert.equal(resolveLocale({ urlValue: 'en', storedValue: 'ja' }), 'en');
  assert.equal(resolveLocale({ urlValue: 'fr', storedValue: 'ko' }), 'ko');
  assert.equal(resolveLocale({ storedValue: 'ja-JP' }), 'ja');
  assert.equal(resolveLocale({ urlValue: 'KO-kr', storedValue: 'ja' }), 'ko');
  assert.equal(resolveLocale({ urlValue: '', storedValue: 'unsupported' }), 'en');
});

test('locale normalization accepts supported primary language tags without false matches', () => {
  for (const [input, expected] of [
    ['en', 'en'], ['EN', 'en'], ['en-US', 'en'],
    ['ko', 'ko'], ['KO-kr', 'ko'], ['ja-JP', 'ja'],
  ]) assert.equal(normalizeLocale(input), expected, String(input));

  for (const input of [undefined, null, '', 'fr', 'zh-CN', 'english', 'korean', 'japanese', 42, {}]) {
    assert.equal(normalizeLocale(input), null, `Unsupported locale: ${String(input)}`);
  }
});

test('internal navigation preserves the route, filters, anchors, and a single language choice', () => {
  for (const locale of SUPPORTED_LOCALES) {
    const href = localizeHref('/projects?filter=ai&lang=ko&tag=server&tag=data#bium', locale);
    assert.ok(href.startsWith('/'), 'Internal links should remain origin-independent');
    const target = new URL(href, 'https://portfolio.local/');
    assert.equal(target.pathname, '/projects');
    assert.equal(target.searchParams.get('filter'), 'ai');
    assert.deepEqual(target.searchParams.getAll('tag'), ['server', 'data']);
    assert.deepEqual(target.searchParams.getAll('lang'), [locale]);
    assert.equal(target.hash, '#bium');
  }

  const anchor = new URL(localizeHref('#about', 'ja', 'https://portfolio.local/?filter=all'), 'https://portfolio.local/');
  assert.equal(anchor.pathname, '/');
  assert.equal(anchor.searchParams.get('filter'), 'all');
  assert.equal(anchor.searchParams.get('lang'), 'ja');
  assert.equal(anchor.hash, '#about');

  const sameOrigin = new URL(localizeHref('https://portfolio.local/lab/epyc?mode=detail#story', 'ko'), 'https://portfolio.local/');
  assert.equal(sameOrigin.pathname, '/lab/epyc');
  assert.equal(sameOrigin.searchParams.get('mode'), 'detail');
  assert.equal(sameOrigin.searchParams.get('lang'), 'ko');
  assert.equal(sameOrigin.hash, '#story');
});

test('external sites and contact links are not rewritten by language navigation', () => {
  for (const href of [
    'https://github.com/monitor5?tab=repositories#work',
    'https://dev.galmegi.com/#travel',
    'https://www.kci.go.kr/kciportal/landing/article.kci?arti_id=ART003094955',
    '//github.com/monitor5',
    'mailto:hello@example.com?subject=Portfolio',
    'tel:+821012345678',
  ]) {
    for (const locale of SUPPORTED_LOCALES) assert.equal(localizeHref(href, locale), href);
  }
});

test('all languages have complete nonempty UI messages and matching interpolation parameters', () => {
  const englishKeys = Object.keys(messages.en).sort();
  assert.ok(englishKeys.length > 0, 'The UI message catalog must not be empty');
  assert.deepEqual(Object.keys(messages).sort(), [...SUPPORTED_LOCALES].sort());

  for (const locale of SUPPORTED_LOCALES) {
    assert.deepEqual(Object.keys(messages[locale]).sort(), englishKeys, `${locale} message keys`);
    for (const key of englishKeys) {
      const message = messages[locale][key];
      assert.equal(typeof message, 'string', `${locale}.${key} must be a string`);
      assert.ok(message.trim(), `${locale}.${key} must not be blank`);
      assert.deepEqual(parameters(message), parameters(messages.en[key]), `${locale}.${key} interpolation parameters`);
      const values = Object.fromEntries(parameters(message).map((name) => [name, `value-for-${name}`]));
      const expected = message.replace(parameterPattern, (_, name) => values[name]);
      assert.equal(translate(locale, key, values), expected, `${locale}.${key} translation`);
    }
  }
});

test('missing messages and interpolation values are surfaced instead of silently leaking into the page', () => {
  for (const locale of SUPPORTED_LOCALES) {
    assert.throws(() => translate(locale, '__missing_translation_key__'));
    assert.throws(() => translate(locale, 'toString'));
    for (const [key, message] of Object.entries(messages[locale])) {
      const names = parameters(message);
      if (!names.length) continue;
      const incompleteValues = Object.fromEntries(names.slice(1).map((name) => [name, 'value']));
      assert.throws(() => translate(locale, key, incompleteValues), `${locale}.${key} requires ${names[0]}`);
    }
  }
});

test('localized detail pages retain every project, hardware story, publication, section, and link', () => {
  for (const locale of SUPPORTED_LOCALES) {
    const content = getContent(locale);
    for (const collection of collections) {
      assert.deepEqual(content[collection].map(({ id }) => id), source[collection].map(({ id }) => id), `${locale}.${collection} IDs`);
      assertSameShape(content[collection], source[collection], `${locale}.${collection}`);
      inspectStrings(content[collection], (value, path) => {
        assert.ok(value.trim(), `${locale}.${path} must not be blank`);
      }, collection);
    }
    assert.ok(content.projects.some(({ id }) => id === 'bium'), `BIUM must remain available in ${locale}`);
  }
});

test('translations preserve factual identifiers, technologies, durations, and source URLs', () => {
  for (const locale of SUPPORTED_LOCALES) {
    const content = getContent(locale);
    for (const collection of collections) {
      source[collection].forEach((original, index) => {
        const translated = content[collection][index];
        for (const key of ['id', 'category', 'categories', 'color', 'stack', 'related', 'verifiedRole', 'year', 'url']) {
          if (key in original) assert.deepEqual(translated[key], original[key], `${locale}.${original.id}.${key}`);
        }
        if (/^\d+$/.test(original.number ?? '')) {
          assert.equal(translated.number, original.number, `${locale}.${original.id} duration or quantity`);
        }
        if (original.links) {
          assert.deepEqual(translated.links.map(([, url]) => url), original.links.map(([, url]) => url), `${locale}.${original.id} factual links`);
        }
      });
    }
  }
});

test('English UI and content contain no untranslated Korean prose outside original bibliography names', () => {
  inspectStrings(messages.en, (value, path) => {
    assert.doesNotMatch(value, /[\uac00-\ud7a3]/u, `English UI message ${path}`);
  });
  const content = getContent('en');
  for (const collection of collections) {
    content[collection].forEach((entry) => {
      inspectStrings(entry, (value, path) => {
        if (collection === 'publications' && /^(?:authors|title|originalTitle|originalSubtitle)$/.test(path)) return;
        assert.doesNotMatch(value, /[\uac00-\ud7a3]/u, `English content ${collection}.${entry.id}.${path}`);
      });
    });
  }
});
