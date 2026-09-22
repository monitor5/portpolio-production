#!/usr/bin/env python3
"""Verify and atomically activate a public Vite build on the portfolio host."""
import argparse
from contextlib import contextmanager
import datetime as dt
import fcntl
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import re
import shutil
import tarfile
import tempfile
from urllib.request import urlopen
import uuid


SHA256 = re.compile(r'[0-9a-f]{64}')
PUBLIC_EXTENSIONS = {'.js', '.css', '.webp', '.jpg', '.jpeg', '.png', '.avif', '.svg', '.woff', '.woff2'}


def digest(data):
    return hashlib.sha256(data).hexdigest()


def public_path(name):
    if not isinstance(name, str) or not name:
        raise ValueError('Invalid public file path')
    path = PurePosixPath(name)
    if (path.is_absolute() or '..' in path.parts or str(path) != name or '\\' in name
            or any(ord(character) < 32 or ord(character) == 127 for character in name)):
        raise ValueError('Unsafe public file path')
    if name not in ('index.html', 'favicon.svg'):
        if not name.startswith('assets/') or path.suffix.lower() not in PUBLIC_EXTENSIONS:
            raise ValueError('File is outside the public asset allowlist')
    return path


def build_time(report):
    if not isinstance(report.get('builtAt'), str):
        raise ValueError('The build report needs a timestamp')
    try:
        value = dt.datetime.fromisoformat(report['builtAt'].replace('Z', '+00:00'))
    except ValueError as error:
        raise ValueError('Invalid build timestamp') from error
    if value.tzinfo is None:
        value = value.replace(tzinfo=dt.timezone.utc)
    return value.astimezone(dt.timezone.utc)


def read_build(archive, report_path):
    report = json.loads(report_path.read_text())
    if not isinstance(report, dict) or not isinstance(report.get('archiveSha256'), str):
        raise ValueError('Invalid build report')
    if not SHA256.fullmatch(report['archiveSha256']):
        raise ValueError('Invalid archive checksum')
    build_time(report)
    entries = report.get('files')
    if not isinstance(entries, list) or not entries:
        raise ValueError('The build report needs a file manifest')
    expected = {}
    for item in entries:
        if not isinstance(item, dict):
            raise ValueError('Invalid file manifest entry')
        name = item.get('path')
        public_path(name)
        if name in expected:
            raise ValueError('Duplicate file in build report')
        if type(item.get('sizeBytes')) is not int or item['sizeBytes'] < 0:
            raise ValueError('Invalid file size in build report')
        if not isinstance(item.get('sha256'), str) or not SHA256.fullmatch(item['sha256']):
            raise ValueError('Invalid file checksum in build report')
        expected[name] = item
    if digest(archive.read_bytes()) != report['archiveSha256']:
        raise ValueError('Archive checksum does not match the build report')
    files = {}
    with tarfile.open(archive, 'r:gz') as bundle:
        for member in bundle.getmembers():
            path = PurePosixPath(member.name)
            if path.is_absolute() or '..' in path.parts:
                raise ValueError('Unsafe archive path')
            if member.isdir():
                continue
            if not member.isfile():
                raise ValueError('Only regular public files are allowed')
            name = str(path)
            public_path(name)
            if name in files or name not in expected:
                raise ValueError('Unexpected or duplicate file in archive')
            if member.size != expected[name]['sizeBytes']:
                raise ValueError('File size does not match the build report')
            data = bundle.extractfile(member).read()
            if len(data) != expected[name]['sizeBytes'] or digest(data) != expected[name]['sha256']:
                raise ValueError('File checksum does not match the build report')
            files[name] = data
    if set(files) != set(expected) or 'index.html' not in files:
        raise ValueError('The build is incomplete')
    return report, files


def directory(path, mode=None):
    if path.is_symlink():
        raise ValueError('Refusing a symbolic link as a release directory')
    path.mkdir(exist_ok=True)
    if not path.is_dir():
        raise ValueError('Expected a release directory')
    if mode is not None:
        path.chmod(mode)


@contextmanager
def deployment_lock(root):
    # The deployment root is configured by the operator, never by the archive.
    if root.is_symlink():
        raise ValueError('Deployment root must not be a symbolic link')
    root.mkdir(parents=True, exist_ok=True)
    descriptor = os.open(root / '.deploy.lock', os.O_CREAT | os.O_RDWR | os.O_NOFOLLOW, 0o600)
    try:
        fcntl.flock(descriptor, fcntl.LOCK_EX)
        yield
    finally:
        os.close(descriptor)


def release_directories(files):
    return {parent for name in files for parent in PurePosixPath(name).parents if str(parent) != '.'}


def prepare_release(target, files):
    directories = release_directories(files)
    if target.is_symlink():
        raise ValueError('Release must not be a symbolic link')
    if target.exists():
        if not target.is_dir():
            raise ValueError('Release must be a directory')
        seen = set()
        for entry in target.rglob('*'):
            name = entry.relative_to(target).as_posix()
            if entry.is_symlink():
                raise ValueError('Existing release contains a symbolic link')
            if entry.is_dir() and PurePosixPath(name) in directories:
                continue
            if not entry.is_file() or name not in files or entry.read_bytes() != files[name]:
                raise ValueError('Existing immutable release differs from this build')
            seen.add(name)
        if seen != set(files):
            raise ValueError('Existing immutable release is incomplete')
        # Normalize every ancestor, including nested assets under restrictive umasks.
        for path in [target, *(target / str(name) for name in directories)]:
            path.chmod(0o755)
        for name in files:
            (target / name).chmod(0o644)
        return

    staging = Path(tempfile.mkdtemp(prefix='.release-', dir=target.parent))
    try:
        for name in sorted(directories, key=lambda value: len(value.parts)):
            directory(staging / str(name), 0o755)
        for name, data in files.items():
            destination = staging / name
            destination.write_bytes(data)
            destination.chmod(0o644)
        staging.chmod(0o755)
        os.rename(staging, target)
    finally:
        if staging.exists():
            shutil.rmtree(staging)


def read_link(site, name):
    path = site / name
    if path.is_symlink():
        return os.readlink(path)
    if path.exists():
        raise ValueError(name + ' release must be a symbolic link')
    return None


def switch_link(site, name, target):
    temporary = site / ('.' + name + '-' + uuid.uuid4().hex + '.next')
    try:
        temporary.symlink_to(target)
        os.replace(temporary, site / name)
    finally:
        if temporary.is_symlink():
            temporary.unlink()


def activate(root, release, files, health_url):
    with deployment_lock(root):
        site = root / 'site'
        directory(site, 0o755)
        directory(site / 'releases', 0o755)
        old_target = read_link(site, 'current')
        read_link(site, 'previous')
        prepare_release(site / 'releases' / release, files)
        new_target = 'releases/' + release
        switch_link(site, 'current', new_target)
        try:
            with urlopen(health_url, timeout=10) as response:
                if response.status != 200 or digest(response.read()) != digest(files['index.html']):
                    raise ValueError('HTTP response does not match the new release')
            if old_target and old_target != new_target:
                switch_link(site, 'previous', old_target)
        except BaseException:
            if old_target is not None:
                switch_link(site, 'current', old_target)
            else:
                (site / 'current').unlink()
            raise


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('archive', type=Path)
    parser.add_argument('report', type=Path)
    parser.add_argument('--root', type=Path, default=Path('/volume1/docker/monitor5-portfolio'))
    parser.add_argument('--health-url', default='http://127.0.0.1:4387/')
    parser.add_argument('--verify-only', action='store_true')
    parser.add_argument('--expected-commit', help='Require the build report to match this source commit')
    args = parser.parse_args()
    report, files = read_build(args.archive, args.report)
    if args.expected_commit is not None and report.get('commit') != args.expected_commit:
        raise ValueError('Build report does not match the expected source commit')
    stamp = build_time(report).strftime('%Y%m%dT%H%M%SZ')
    release = stamp + '-' + report['archiveSha256'][:8]
    if args.verify_only:
        print(json.dumps({'verified': True, 'release': release, 'files': len(files)}))
        return
    activate(args.root, release, files, args.health_url)
    print(json.dumps({'activated': True, 'release': release, 'files': len(files)}))


if __name__ == '__main__':
    main()
