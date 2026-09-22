#!/usr/bin/env python3
"""Package a verified public Vite build for the portfolio deployment host."""

import argparse
import datetime as dt
import gzip
import hashlib
import importlib.util
import io
import json
import os
from pathlib import Path
import re
import stat
import tarfile
import tempfile


PUBLIC_EXTENSIONS = {
    '.js', '.css', '.webp', '.jpg', '.jpeg', '.png', '.avif', '.svg', '.woff', '.woff2'
}


def digest(data):
    return hashlib.sha256(data).hexdigest()


def validate_commit(value):
    if not re.fullmatch(r'[0-9a-fA-F]{40}', value):
        raise ValueError('Commit must be a full 40-character hexadecimal Git SHA')
    return value.lower()


def build_timestamp():
    """SOURCE_DATE_EPOCH makes the report reproducible as well as the archive."""
    epoch = os.environ.get('SOURCE_DATE_EPOCH')
    if epoch is None:
        instant = dt.datetime.now(dt.timezone.utc)
    else:
        if not re.fullmatch(r'[0-9]+', epoch):
            raise ValueError('SOURCE_DATE_EPOCH must be a non-negative Unix timestamp')
        try:
            instant = dt.datetime.fromtimestamp(int(epoch), dt.timezone.utc)
        except (ValueError, OverflowError, OSError) as exc:
            raise ValueError('SOURCE_DATE_EPOCH is outside the supported date range') from exc
    return instant.isoformat(timespec='seconds').replace('+00:00', 'Z')


def collect_public_files(dist):
    if dist.is_symlink() or not dist.is_dir():
        raise ValueError('Build directory must be an existing directory, not a symlink')
    files = {}
    for path in sorted(dist.rglob('*')):
        name = path.relative_to(dist).as_posix()
        mode = path.lstat().st_mode
        if stat.S_ISLNK(mode):
            raise ValueError(f'Symlinks are not allowed in the build: {name}')
        if stat.S_ISDIR(mode):
            if name != 'assets' and not name.startswith('assets/'):
                raise ValueError(f'Directory is outside the public asset allowlist: {name}')
            continue
        if not stat.S_ISREG(mode):
            raise ValueError(f'Only regular public files are allowed: {name}')
        if '\\' in name or (
            name not in ('index.html', 'favicon.svg')
            and (not name.startswith('assets/') or path.suffix.lower() not in PUBLIC_EXTENSIONS)
        ):
            raise ValueError(f'File is outside the public asset allowlist: {name}')
        files[name] = path.read_bytes()
    if 'index.html' not in files:
        raise ValueError('The build is incomplete: index.html is missing')
    return files


def write_archive(path, files):
    # Do not include filesystem timestamps, ownership, modes, or the output filename.
    with path.open('wb') as raw:
        with gzip.GzipFile(filename='', fileobj=raw, mode='wb', mtime=0) as compressed:
            with tarfile.open(fileobj=compressed, mode='w', format=tarfile.PAX_FORMAT) as bundle:
                for name, data in files.items():
                    member = tarfile.TarInfo(name)
                    member.size = len(data)
                    member.mode = 0o644
                    member.mtime = 0
                    member.uid = member.gid = 0
                    member.uname = member.gname = ''
                    bundle.addfile(member, io.BytesIO(data))


def verify_build(archive, report_path):
    # Use the deployment consumer itself so the producer cannot silently drift.
    spec = importlib.util.spec_from_file_location(
        'portfolio_update_release', Path(__file__).with_name('update-release.py')
    )
    updater = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(updater)
    return updater.read_build(archive, report_path)


def package_build(dist, output, commit=None):
    dist, output = Path(dist), Path(output)
    if commit is not None:
        commit = validate_commit(commit)
    if output.resolve().is_relative_to(dist.resolve()):
        raise ValueError('Output directory must be outside the public build directory')
    files = collect_public_files(dist)
    built_at = build_timestamp()
    output.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix='.package-', dir=output) as staging:
        staging = Path(staging)
        archive = staging / 'portfolio-deploy.tar.gz'
        report_path = staging / 'deployment-build-report.json'
        write_archive(archive, files)
        report = {
            'builtAt': built_at,
            'archiveSha256': digest(archive.read_bytes()),
            'files': [
                {'path': name, 'sizeBytes': len(data), 'sha256': digest(data)}
                for name, data in files.items()
            ],
        }
        if commit is not None:
            report['commit'] = commit
        report_path.write_text(json.dumps(report, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')
        verify_build(archive, report_path)
        os.replace(archive, output / archive.name)
        os.replace(report_path, output / report_path.name)
    return report


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--dist', type=Path, default=Path('dist'))
    parser.add_argument('--output', type=Path, default=Path('.cache/release'))
    parser.add_argument('--commit', help='Full 40-character Git commit SHA')
    args = parser.parse_args()
    try:
        report = package_build(args.dist, args.output, args.commit)
    except (ValueError, OSError, tarfile.TarError) as exc:
        parser.exit(1, f'Packaging failed: {exc}\n')
    print(json.dumps({
        'archive': str(args.output / 'portfolio-deploy.tar.gz'),
        'report': str(args.output / 'deployment-build-report.json'),
        'archiveSha256': report['archiveSha256'],
        'files': len(report['files']),
    }))


if __name__ == '__main__':
    main()
