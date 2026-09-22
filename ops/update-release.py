#!/usr/bin/env python3
"""Verify and atomically activate a public Vite build on the portfolio host."""
import argparse
import datetime as dt
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import tarfile
from urllib.request import urlopen


def digest(data):
    return hashlib.sha256(data).hexdigest()


def read_build(archive, report_path):
    report = json.loads(report_path.read_text())
    if digest(archive.read_bytes()) != report['archiveSha256']:
        raise ValueError('Archive checksum does not match the build report')
    expected = {item['path']: item for item in report['files']}
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
            if name in files or name not in expected:
                raise ValueError('Unexpected or duplicate file in archive')
            if name not in ('index.html', 'favicon.svg'):
                if not name.startswith('assets/') or path.suffix.lower() not in {
                    '.js', '.css', '.webp', '.jpg', '.jpeg', '.png', '.avif', '.svg', '.woff', '.woff2'
                }:
                    raise ValueError('File is outside the public asset allowlist')
            data = bundle.extractfile(member).read()
            if len(data) != expected[name]['sizeBytes'] or digest(data) != expected[name]['sha256']:
                raise ValueError('File checksum does not match the build report')
            files[name] = data
    if set(files) != set(expected) or 'index.html' not in files:
        raise ValueError('The build is incomplete')
    return report, files


def switch_link(site, name, target):
    temporary = site / (name + '.next')
    if temporary.is_symlink():
        temporary.unlink()
    elif temporary.exists():
        raise ValueError('Refusing to overwrite an unexpected path')
    temporary.symlink_to(target)
    os.replace(temporary, site / name)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('archive', type=Path)
    parser.add_argument('report', type=Path)
    parser.add_argument('--root', type=Path, default=Path('/volume1/docker/monitor5-portfolio'))
    parser.add_argument('--health-url', default='http://127.0.0.1:4387/')
    parser.add_argument('--verify-only', action='store_true')
    args = parser.parse_args()
    report, files = read_build(args.archive, args.report)
    stamp = dt.datetime.fromisoformat(report['builtAt'].replace('Z', '+00:00')).strftime('%Y%m%dT%H%M%SZ')
    release = stamp + '-' + report['archiveSha256'][:8]
    if args.verify_only:
        print(json.dumps({'verified': True, 'release': release, 'files': len(files)}))
        return

    site = args.root / 'site'
    target = site / 'releases' / release
    target.mkdir(parents=True, exist_ok=True)
    for directory in (site, site / 'releases', target):
        directory.chmod(0o755)
    for name, data in files.items():
        destination = target / name
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.parent.chmod(0o755)
        if destination.exists() and destination.read_bytes() != data:
            raise ValueError('Existing immutable release differs from this build')
        if not destination.exists():
            destination.write_bytes(data)
        destination.chmod(0o644)

    current = site / 'current'
    if current.exists() and not current.is_symlink():
        raise ValueError('Current release must be a symbolic link')
    old_target = os.readlink(current) if current.is_symlink() else None
    new_target = 'releases/' + release
    switch_link(site, 'current', new_target)
    try:
        with urlopen(args.health_url, timeout=10) as response:
            if response.status != 200 or digest(response.read()) != digest(files['index.html']):
                raise ValueError('HTTP response does not match the new release')
    except Exception:
        if old_target is not None:
            switch_link(site, 'current', old_target)
        else:
            current.unlink()
        raise
    if old_target and old_target != new_target:
        switch_link(site, 'previous', old_target)
    print(json.dumps({'activated': True, 'release': release, 'files': len(files)}))


if __name__ == '__main__':
    main()
