"""Exercise release validation and activation against a real local HTTP origin."""
from contextlib import contextmanager
import hashlib
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import importlib.util
import io
import json
import os
from pathlib import Path
import select
import subprocess
import sys
import tarfile
import tempfile
import threading
import unittest


SCRIPT = Path(__file__).resolve().parents[1] / 'ops' / 'update-release.py'
SPEC = importlib.util.spec_from_file_location('deployment', SCRIPT)
deployment = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(deployment)


class DeploymentTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.base = Path(self.temporary.name)
        self.root = self.base / 'host'
        self.archive = self.base / 'build.tar.gz'
        self.report_path = self.base / 'report.json'
        self.files = {'index.html': b'<!doctype html><title>Current build</title>', 'assets/app.js': b'console.log("build")'}
        self.report = self.bundle()

    def bundle(self, members=None):
        with tarfile.open(self.archive, 'w:gz') as archive:
            for name, data in (members if members is not None else self.files.items()):
                if isinstance(data, tarfile.TarInfo):
                    archive.addfile(data)
                else:
                    member = tarfile.TarInfo(name)
                    member.size = len(data)
                    archive.addfile(member, io.BytesIO(data))
        report = {
            'builtAt': '2026-09-23T00:00:00Z',
            'archiveSha256': hashlib.sha256(self.archive.read_bytes()).hexdigest(),
            'files': [{'path': name, 'sizeBytes': len(data), 'sha256': hashlib.sha256(data).hexdigest()}
                      for name, data in self.files.items()],
        }
        self.report_path.write_text(json.dumps(report))
        return report

    def save_report(self):
        self.report_path.write_text(json.dumps(self.report))

    def release_name(self):
        return '20260923T000000Z-' + self.report['archiveSha256'][:8]

    def existing_release(self):
        site = self.root / 'site'
        old = site / 'releases' / 'old'
        old.mkdir(parents=True)
        (old / 'index.html').write_bytes(b'Old release')
        (site / 'current').symlink_to('releases/old')
        return site

    @contextmanager
    def origin(self, fail=False, mismatch=False):
        root = self.root

        class Handler(BaseHTTPRequestHandler):
            def do_GET(self):
                if fail:
                    self.send_response(503)
                    self.end_headers()
                    return
                try:
                    body = (root / 'site' / 'current' / 'index.html').read_bytes()
                except FileNotFoundError:
                    self.send_response(404)
                    self.end_headers()
                    return
                self.send_response(200)
                self.end_headers()
                self.wfile.write(b'Unrelated origin response' if mismatch else body)

            def log_message(self, *args):
                pass

        server = ThreadingHTTPServer(('127.0.0.1', 0), Handler)
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        try:
            yield 'http://127.0.0.1:%s/' % server.server_port
        finally:
            server.shutdown()
            server.server_close()
            thread.join()

    def cli(self, *options):
        return subprocess.run([sys.executable, str(SCRIPT), str(self.archive), str(self.report_path),
                               '--root', str(self.root), *options], capture_output=True, text=True)

    def test_accepts_legacy_report_without_commit(self):
        report, files = deployment.read_build(self.archive, self.report_path)
        self.assertEqual(files, self.files)
        self.assertEqual(report, self.report)
        result = self.cli('--verify-only')
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertFalse(self.root.exists(), 'Verification must not touch the deployment root')

    def test_expected_commit_accepts_matching_and_rejects_missing_or_other_commit(self):
        commit = 'a' * 40
        missing = self.cli('--verify-only', '--expected-commit', commit)
        self.assertNotEqual(missing.returncode, 0)
        self.report['commit'] = commit
        self.save_report()
        matching = self.cli('--verify-only', '--expected-commit', commit)
        self.assertEqual(matching.returncode, 0, matching.stderr)
        self.assertNotEqual(self.cli('--verify-only', '--expected-commit', 'b' * 40).returncode, 0)

    def test_rejects_archive_checksum_mismatch(self):
        with self.archive.open('ab') as archive:
            archive.write(b'changed')
        with self.assertRaisesRegex(ValueError, 'Archive checksum'):
            deployment.read_build(self.archive, self.report_path)

    def test_rejects_file_checksum_mismatch(self):
        self.report['files'][0]['sha256'] = '0' * 64
        self.save_report()
        with self.assertRaisesRegex(ValueError, 'File checksum'):
            deployment.read_build(self.archive, self.report_path)

    def test_rejects_duplicate_manifest_paths(self):
        self.report['files'].append(dict(self.report['files'][0]))
        self.save_report()
        with self.assertRaisesRegex(ValueError, 'Duplicate file'):
            deployment.read_build(self.archive, self.report_path)

    def test_rejects_malformed_manifest(self):
        for field, value in [('path', '../index.html'), ('path', '/index.html'), ('path', 'assets/../index.html'),
                             ('path', 'assets/bad\x00.js'),
                             ('sizeBytes', True), ('sizeBytes', -1), ('sha256', 'bad')]:
            with self.subTest(field=field, value=value):
                self.report = self.bundle()
                self.report['files'][0][field] = value
                self.save_report()
                with self.assertRaises(ValueError):
                    deployment.read_build(self.archive, self.report_path)

    def test_rejects_archive_traversal(self):
        self.bundle([*self.files.items(), ('../outside.js', b'unsafe')])
        with self.assertRaisesRegex(ValueError, 'Unsafe archive path'):
            deployment.read_build(self.archive, self.report_path)
        self.assertFalse((self.base / 'outside.js').exists())

    def test_rejects_archive_symbolic_and_hard_links(self):
        for link_type in (tarfile.SYMTYPE, tarfile.LNKTYPE):
            with self.subTest(link_type=link_type):
                member = tarfile.TarInfo('assets/link.js')
                member.type = link_type
                member.linkname = 'index.html'
                self.bundle([*self.files.items(), ('assets/link.js', member)])
                with self.assertRaisesRegex(ValueError, 'Only regular'):
                    deployment.read_build(self.archive, self.report_path)

    def test_rejects_duplicate_archive_members(self):
        self.bundle([*self.files.items(), ('index.html', self.files['index.html'])])
        with self.assertRaisesRegex(ValueError, 'duplicate file in archive'):
            deployment.read_build(self.archive, self.report_path)

    def test_successful_http_activation_preserves_previous_release(self):
        site = self.existing_release()
        with self.origin() as url:
            result = self.cli('--health-url', url)
            self.assertEqual(result.returncode, 0, result.stderr)
            activated = json.loads(result.stdout)
            self.assertTrue(activated['activated'])
            self.assertEqual(os.readlink(site / 'current'), 'releases/' + activated['release'])
            self.assertEqual(os.readlink(site / 'previous'), 'releases/old')
            self.assertEqual((site / 'current' / 'index.html').read_bytes(), self.files['index.html'])
            again = self.cli('--health-url', url)
            self.assertEqual(again.returncode, 0, again.stderr)
            self.assertEqual(os.readlink(site / 'previous'), 'releases/old')
        self.assertFalse(list((site / 'releases').glob('.release-*')))

    def test_failed_health_check_rolls_back_existing_release(self):
        site = self.existing_release()
        (site / 'previous').symlink_to('releases/older')
        with self.origin(fail=True) as url:
            result = self.cli('--health-url', url)
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(os.readlink(site / 'current'), 'releases/old')
        self.assertEqual(os.readlink(site / 'previous'), 'releases/older')
        self.assertEqual((site / 'current' / 'index.html').read_bytes(), b'Old release')

    def test_failed_first_activation_removes_current_link(self):
        with self.origin(fail=True) as url:
            result = self.cli('--health-url', url)
        self.assertNotEqual(result.returncode, 0)
        self.assertFalse((self.root / 'site' / 'current').is_symlink())

    def test_http_200_with_wrong_build_rolls_back(self):
        site = self.existing_release()
        with self.origin(mismatch=True) as url:
            result = self.cli('--health-url', url)
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(os.readlink(site / 'current'), 'releases/old')

    def test_rejects_preexisting_release_symlinks_and_extra_files(self):
        for hazard in ('release-link', 'file-link', 'extra-file'):
            with self.subTest(hazard=hazard), tempfile.TemporaryDirectory(dir=self.base) as temporary:
                parent = Path(temporary)
                target = parent / 'release'
                outside = parent / 'outside'
                outside.mkdir()
                (outside / 'index.html').write_bytes(self.files['index.html'])
                if hazard == 'release-link':
                    target.symlink_to(outside)
                else:
                    target.mkdir()
                    (target / 'assets').mkdir()
                    (target / 'assets' / 'app.js').write_bytes(self.files['assets/app.js'])
                    if hazard == 'file-link':
                        (target / 'index.html').symlink_to(outside / 'index.html')
                    else:
                        (target / 'index.html').write_bytes(self.files['index.html'])
                        (target / 'unexpected.txt').write_text('private data')
                with self.assertRaises(ValueError):
                    deployment.prepare_release(target, self.files)

    def test_rejects_symbolic_link_site_directory(self):
        self.root.mkdir()
        outside = self.base / 'outside'
        outside.mkdir()
        (self.root / 'site').symlink_to(outside)
        with self.assertRaisesRegex(ValueError, 'symbolic link'):
            deployment.activate(self.root, self.release_name(), self.files, 'http://127.0.0.1:1/')
        self.assertEqual(list(outside.iterdir()), [])

    def test_nested_public_files_are_readable_with_restrictive_umask(self):
        target = self.base / 'release'
        files = {'index.html': b'index', 'assets/fonts/nested/font.woff2': b'font'}
        old_umask = os.umask(0o077)
        try:
            deployment.prepare_release(target, files)
        finally:
            os.umask(old_umask)
        for name in ['', 'assets', 'assets/fonts', 'assets/fonts/nested']:
            self.assertEqual((target / name).stat().st_mode & 0o777, 0o755)
        for name in files:
            self.assertEqual((target / name).stat().st_mode & 0o777, 0o644)

    def test_deployment_lock_serializes_separate_processes(self):
        code = (
            'import pathlib, runpy, sys\n'
            'module = runpy.run_path(sys.argv[1])\n'
            'print("ready", flush=True)\n'
            'with module["deployment_lock"](pathlib.Path(sys.argv[2])):\n'
            '    print("acquired", flush=True)\n'
        )
        with deployment.deployment_lock(self.root):
            process = subprocess.Popen([sys.executable, '-c', code, str(SCRIPT), str(self.root)],
                                       stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
            self.addCleanup(lambda: process.kill() if process.poll() is None else None)
            self.assertEqual(process.stdout.readline().strip(), 'ready')
            readable, _, _ = select.select([process.stdout], [], [], 0.2)
            self.assertEqual(readable, [], 'A second deployment must wait for the first deployment lock')
        output, error = process.communicate(timeout=5)
        self.assertEqual(process.returncode, 0, error)
        self.assertEqual(output.strip(), 'acquired')


if __name__ == '__main__':
    unittest.main()
