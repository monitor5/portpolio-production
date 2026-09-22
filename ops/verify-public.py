#!/usr/bin/env python3
"""Verify a deployed SPA and every public asset against its build report."""
import argparse
import hashlib
from http.client import HTTPException
from html.parser import HTMLParser
import json
import math
from pathlib import Path, PurePosixPath
import re
import sys
import time
from urllib.error import URLError
from urllib.parse import quote, urlencode, urljoin, urlsplit, urlunsplit
from urllib.request import Request, urlopen


ROUTES = ('/', '/projects', '/lab/smart-mirror', '/ai/book')
TIMEOUT = 10
HTML_LIMIT = 1024 * 1024


class BundleReferences(HTMLParser):
    def __init__(self):
        super().__init__()
        self.references = set()
        self.has_html = False

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        self.has_html |= tag == 'html'
        if tag == 'script' and attrs.get('src'):
            self.references.add(attrs['src'])
        if tag == 'link' and 'stylesheet' in attrs.get('rel', '').split() and attrs.get('href'):
            self.references.add(attrs['href'])


def read_report(path):
    report = json.loads(path.read_text(encoding='utf-8'))
    if not isinstance(report.get('archiveSha256'), str) or not re.fullmatch(r'[a-f0-9]{64}', report['archiveSha256']):
        raise ValueError('Report must contain an archive SHA-256')
    files = {}
    for item in report.get('files', []):
        name = item.get('path', '')
        if not isinstance(name, str) or not name or '\\' in name or any(ord(c) < 32 for c in name):
            raise ValueError('Invalid file path in report')
        public_path = PurePosixPath(name)
        if name == '.' or public_path.is_absolute() or '..' in public_path.parts or str(public_path) != name or name in files:
            raise ValueError('Unsafe or duplicate file path in report')
        if type(item.get('sizeBytes')) is not int or item['sizeBytes'] < 0:
            raise ValueError('Invalid file size in report')
        if not isinstance(item.get('sha256'), str) or not re.fullmatch(r'[a-f0-9]{64}', item['sha256']):
            raise ValueError('Invalid file SHA-256 in report')
        files[name] = item
    if 'index.html' not in files:
        raise ValueError('Report does not include index.html')
    bundles = {name for name in files if re.fullmatch(r'assets/index-[\w-]+\.(js|css)', name)}
    if not any(name.endswith('.js') for name in bundles) or not any(name.endswith('.css') for name in bundles):
        raise ValueError('Report must include JavaScript and CSS bundles')
    return report, files, bundles


def make_url(base, path, token, language=None):
    query = {'release': token}
    if language:
        query['lang'] = language
    return base.rstrip('/') + '/' + quote(path.lstrip('/'), safe='/') + '?' + urlencode(query)


def fetch(url, limit):
    # Cloudflare rejects urllib's default agent (1010); identify this checker.
    request = Request(url, headers={
        'User-Agent': 'Mozilla/5.0 (compatible; Portfolio-Deploy-Verification/1.0)',
        'Cache-Control': 'no-cache',
        'Accept-Encoding': 'identity',
    })
    with urlopen(request, timeout=TIMEOUT) as response:
        if response.status != 200:
            raise ValueError(f'{url}: expected HTTP 200, received {response.status}')
        data = response.read(limit + 1)
        if len(data) > limit:
            raise ValueError(f'{url}: response exceeds expected size limit')
        return data, response.headers.get_content_type()


def without_query(url):
    parts = urlsplit(url)
    return urlunsplit((parts.scheme, parts.netloc, parts.path, '', ''))


def verify_once(base, report, files, bundles):
    token = report.get('commit') or report['archiveSha256']
    checked = 0
    for name, item in files.items():
        if name == 'index.html':
            continue
        data, _ = fetch(make_url(base, name, token), item['sizeBytes'])
        if len(data) != item['sizeBytes'] or hashlib.sha256(data).hexdigest() != item['sha256']:
            raise ValueError(f'{name}: public content differs from the build report')
        checked += 1

    expected = {without_query(make_url(base, name, token)) for name in bundles}
    pages = [(route, language) for route in ROUTES for language in (None, 'en', 'ko', 'ja')]
    pages.append(('/index.html', None))
    for route, language in pages:
        url = make_url(base, route, token, language)
        data, content_type = fetch(url, HTML_LIMIT)
        parser = BundleReferences()
        parser.feed(data.decode('utf-8'))
        actual = {without_query(urljoin(url, reference)) for reference in parser.references}
        if content_type != 'text/html' or not parser.has_html or not expected.issubset(actual):
            raise ValueError(f'{url}: HTML does not reference the expected JavaScript and CSS bundles')
        checked += 1

    health, _ = fetch(make_url(base, '/healthz', token), 3)
    if health != b'ok\n':
        raise ValueError('/healthz: expected exactly ok followed by a newline')
    return checked + 1


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('report', type=Path, nargs='?', default=Path('deployment-build-report.json'))
    parser.add_argument('--url', default='https://daus.uk')
    parser.add_argument('--attempts', type=int, default=6)
    parser.add_argument('--delay', type=float, default=5)
    args = parser.parse_args()
    parts = urlsplit(args.url)
    if parts.scheme not in ('http', 'https') or not parts.netloc or parts.query or parts.fragment:
        parser.error('--url must be an HTTP(S) base URL without a query or fragment')
    if args.attempts < 1 or not math.isfinite(args.delay) or args.delay < 0:
        parser.error('--attempts must be positive and --delay must be finite and nonnegative')
    try:
        report, files, bundles = read_report(args.report)
        for attempt in range(1, args.attempts + 1):
            try:
                checked = verify_once(args.url, report, files, bundles)
                print(json.dumps({'verified': True, 'url': args.url, 'checks': checked, 'attempt': attempt}))
                return 0
            except (OSError, URLError, HTTPException, ValueError) as error:
                print(f'Public verification {attempt}/{args.attempts}: {error}', file=sys.stderr)
                if attempt < args.attempts:
                    time.sleep(args.delay)
        return 1
    except (OSError, ValueError, TypeError, AttributeError) as error:
        print(f'Invalid build report: {error}', file=sys.stderr)
        return 1


if __name__ == '__main__':
    sys.exit(main())
