"""Verify the public release boundary and compatibility with the deployment consumer."""

import importlib.util
import json
import os
from pathlib import Path
import subprocess
import sys
import tarfile
import tempfile
import unittest
from unittest import mock


SCRIPT = Path(__file__).resolve().parents[1] / 'ops' / 'package-release.py'
SPEC = importlib.util.spec_from_file_location('package_release', SCRIPT)
package = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(package)


class PackageReleaseTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name)
        self.dist = self.root / 'dist'
        self.output = self.root / 'release'
        (self.dist / 'assets').mkdir(parents=True)
        (self.dist / 'index.html').write_bytes(b'<html>Portfolio</html>')
        (self.dist / 'favicon.svg').write_bytes(b'<svg/>')
        (self.dist / 'assets' / 'app.js').write_bytes(b'console.log("portfolio");')

    def test_package_is_reproducible_and_accepted_by_consumer(self):
        with mock.patch.dict(os.environ, {'SOURCE_DATE_EPOCH': '1700000000'}):
            first_report = package.package_build(self.dist, self.output, 'A' * 40)
            first_archive = (self.output / 'portfolio-deploy.tar.gz').read_bytes()
            for path in self.dist.rglob('*'):
                os.utime(path, (1800000000, 1800000000))
                if path.is_file():
                    path.chmod(0o600)
            second_output = self.root / 'second-release'
            second_report = package.package_build(self.dist, second_output, 'A' * 40)
        self.assertEqual(first_report, second_report)
        self.assertEqual(first_archive, (second_output / 'portfolio-deploy.tar.gz').read_bytes())
        self.assertEqual(first_report['builtAt'], '2023-11-14T22:13:20Z')
        self.assertEqual(first_report['commit'], 'a' * 40)
        report, files = package.verify_build(
            self.output / 'portfolio-deploy.tar.gz', self.output / 'deployment-build-report.json'
        )
        self.assertEqual(report, first_report)
        self.assertEqual(files['index.html'], b'<html>Portfolio</html>')
        with tarfile.open(self.output / 'portfolio-deploy.tar.gz') as bundle:
            members = bundle.getmembers()
            self.assertEqual([item.name for item in members], sorted(files))
            for member in members:
                self.assertTrue(member.isfile())
                self.assertEqual((member.mtime, member.uid, member.gid, member.mode), (0, 0, 0, 0o644))
                self.assertEqual((member.uname, member.gname), ('', ''))

    def test_rejects_nonpublic_files_including_source_maps(self):
        for name in ('assets/app.js.map', '.env', 'src/main.js', 'assets/private.json'):
            with self.subTest(name=name):
                path = self.dist / name
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_text('not public', encoding='utf-8')
                with self.assertRaises(ValueError):
                    package.package_build(self.dist, self.output)
                path.unlink()
                if path.parent.name == 'src':
                    path.parent.rmdir()
        self.assertFalse(self.output.exists())

    def test_rejects_file_and_directory_symlinks(self):
        for target in (self.dist / 'index.html', self.dist / 'assets', self.root / 'missing'):
            with self.subTest(target=target):
                link = self.dist / 'assets' / 'linked.js'
                link.symlink_to(target)
                with self.assertRaisesRegex(ValueError, 'Symlinks'):
                    package.package_build(self.dist, self.output)
                link.unlink()

    def test_rejects_symlinked_build_directory(self):
        link = self.root / 'linked-dist'
        link.symlink_to(self.dist, target_is_directory=True)
        with self.assertRaisesRegex(ValueError, 'symlink'):
            package.package_build(link, self.output)

    def test_missing_index_does_not_replace_previous_release(self):
        package.package_build(self.dist, self.output)
        archive_before = (self.output / 'portfolio-deploy.tar.gz').read_bytes()
        report_before = (self.output / 'deployment-build-report.json').read_bytes()
        (self.dist / 'index.html').unlink()
        with self.assertRaisesRegex(ValueError, 'index.html'):
            package.package_build(self.dist, self.output)
        self.assertEqual((self.output / 'portfolio-deploy.tar.gz').read_bytes(), archive_before)
        self.assertEqual((self.output / 'deployment-build-report.json').read_bytes(), report_before)

    def test_invalid_commit_or_timestamp_is_rejected(self):
        for commit in ('abc123', 'g' * 40, 'a' * 41, 'a' * 40 + '\n'):
            with self.subTest(commit=commit), self.assertRaisesRegex(ValueError, 'Commit'):
                package.package_build(self.dist, self.output, commit)
        for timestamp in ('-1', 'tomorrow', '1.5', '9' * 100):
            with self.subTest(timestamp=timestamp):
                with mock.patch.dict(os.environ, {'SOURCE_DATE_EPOCH': timestamp}):
                    with self.assertRaisesRegex(ValueError, 'SOURCE_DATE_EPOCH'):
                        package.package_build(self.dist, self.output)

    def test_rejects_output_inside_public_build(self):
        with self.assertRaisesRegex(ValueError, 'outside'):
            package.package_build(self.dist, self.dist / 'release')

    def test_cli_defaults_and_optional_commit(self):
        result = subprocess.run(
            [sys.executable, str(SCRIPT)], cwd=self.root, capture_output=True, text=True, check=True
        )
        summary = json.loads(result.stdout)
        self.assertEqual(summary['archive'], '.cache/release/portfolio-deploy.tar.gz')
        report_path = self.root / summary['report']
        report = json.loads(report_path.read_text())
        self.assertNotIn('commit', report)
        self.assertEqual(summary['files'], 3)


if __name__ == '__main__':
    unittest.main()
