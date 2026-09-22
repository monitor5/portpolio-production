"""Exercise the public deployment gate using real local HTTP requests."""
from contextlib import contextmanager
import hashlib
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
from pathlib import Path
import subprocess
import sys
import tempfile
from threading import Thread
import unittest
from urllib.parse import parse_qs, unquote, urlsplit


SCRIPT = Path(__file__).resolve().parents[1] / 'ops' / 'verify-public.py'
JS = 'assets/index-a1b2c3d4.js'
CSS = 'assets/index-e5f6a7b8.css'
INDEX = f'<html><head><script src="/{JS}"></script><link rel="stylesheet" href="/{CSS}"></head></html>'.encode()
FILES = {JS: b'console.log("deployed");', CSS: b'body {color: black}', 'assets/image #1.svg': b'<svg/>', 'index.html': INDEX}
REPORT = {
    'commit': 'a' * 40,
    'archiveSha256': 'b' * 64,
    'files': [{'path': name, 'sizeBytes': len(data), 'sha256': hashlib.sha256(data).hexdigest()} for name, data in FILES.items()],
}


@contextmanager
def serve(transform=None):
    requests = []

    class Handler(BaseHTTPRequestHandler):
        def do_GET(self):
            requests.append(self.path)
            path = unquote(urlsplit(self.path).path).lstrip('/')
            body = FILES.get(path, INDEX)
            content_type = 'text/html' if body == INDEX else 'application/octet-stream'
            if path == 'healthz':
                body, content_type = b'ok\n', 'text/plain'
            status = 200
            if transform:
                status, content_type, body = transform(self.path, status, content_type, body, requests)
            self.send_response(status)
            self.send_header('Content-Type', content_type)
            self.send_header('Content-Length', str(len(body)))
            self.end_headers()
            self.wfile.write(body)

        def log_message(self, *args):
            pass

    server = ThreadingHTTPServer(('127.0.0.1', 0), Handler)
    thread = Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        yield f'http://127.0.0.1:{server.server_port}', requests
    finally:
        server.shutdown()
        server.server_close()
        thread.join()


class VerifyPublicTests(unittest.TestCase):
    def run_verifier(self, url, attempts=1, report=None):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'deployment-build-report.json'
            path.write_text(json.dumps(REPORT if report is None else report))
            return subprocess.run(
                [sys.executable, str(SCRIPT), str(path), '--url', url, '--attempts', str(attempts), '--delay', '0'],
                text=True, capture_output=True, timeout=15,
            )

    def test_success_checks_every_asset_and_localized_spa_despite_analytics(self):
        def analytics(path, status, kind, body, requests):
            if kind == 'text/html':
                body = body.replace(b'</head>', b'<script src="https://static.cloudflareinsights.com/beacon.min.js"></script></head>')
            return status, kind, body

        with serve(analytics) as (url, requests):
            result = self.run_verifier(url)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(json.loads(result.stdout)['checks'], len(requests))
        self.assertEqual(len(requests), 21)
        self.assertTrue(any('image%20%231.svg' in path for path in requests))
        for path in requests:
            self.assertEqual(parse_qs(urlsplit(path).query)['release'], [REPORT['commit']])
        for route in ('/', '/projects', '/lab/smart-mirror', '/ai/book'):
            for language in ('en', 'ko', 'ja'):
                self.assertTrue(any(urlsplit(path).path == route and parse_qs(urlsplit(path).query).get('lang') == [language] for path in requests))

    def test_same_size_corrupt_asset_fails_checksum(self):
        def corrupt(path, status, kind, body, requests):
            return status, kind, b'x' * len(body) if urlsplit(path).path == '/' + JS else body

        with serve(corrupt) as (url, _):
            result = self.run_verifier(url)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('differs from the build report', result.stderr)

    def test_wrong_bundle_references_cannot_pass_via_comments(self):
        def stale(path, status, kind, body, requests):
            if kind == 'text/html':
                body = b'<html><script src="/assets/old.js"></script><!--' + INDEX + b'--></html>'
            return status, kind, body

        with serve(stale) as (url, _):
            result = self.run_verifier(url)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('expected JavaScript and CSS bundles', result.stderr)

    def test_bad_health_response_fails(self):
        def unhealthy(path, status, kind, body, requests):
            return status, kind, b'ok' if urlsplit(path).path == '/healthz' else body

        with serve(unhealthy) as (url, _):
            result = self.run_verifier(url)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('/healthz', result.stderr)

    def test_retries_entire_pass_after_http_failure_and_uses_archive_fallback(self):
        def transient(path, status, kind, body, requests):
            return (503, kind, b'unavailable') if len(requests) == 2 else (status, kind, body)

        report = {key: value for key, value in REPORT.items() if key != 'commit'}
        with serve(transient) as (url, requests):
            result = self.run_verifier(url, attempts=2, report=report)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(json.loads(result.stdout)['attempt'], 2)
        self.assertEqual(requests[0], requests[2])
        self.assertEqual(parse_qs(urlsplit(requests[0]).query)['release'], [report['archiveSha256']])

    def test_permanent_http_failure_exhausts_attempts(self):
        with serve(lambda path, status, kind, body, requests: (404, kind, b'missing')) as (url, requests):
            result = self.run_verifier(url, attempts=2)
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(len(requests), 2)
        self.assertIn('2/2', result.stderr)


if __name__ == '__main__':
    unittest.main()
