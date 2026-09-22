#!/usr/bin/env python3
"""Install this deployment's Cloudflare token without executing pasted commands."""

import base64
import binascii
import getpass
import json
import os
from pathlib import Path
import re
import secrets
import shlex
import stat
import sys
import warnings


ROOT = Path("/volume1/docker/monitor5-portfolio")
ACCOUNT_ID = "06062fb4f115ec7c888eaa0ccf11fb2c"
TUNNEL_ID = "3715cd9a-b363-4828-8fd1-3dc6657c43cd"
TOKEN_NAME = "cloudflared-token"
TOKEN_PATTERN = re.compile(r"[A-Za-z0-9+/_-]+={0,2}\Z")
MAX_INPUT = 32768


class InstallError(Exception):
    """A safe-to-display error containing no pasted input."""


def parse_token(pasted: str) -> str:
    """Extract and validate a raw token or an official Docker install command."""
    if not pasted or len(pasted) > MAX_INPUT:
        raise InstallError("Input is empty or too long.")
    value = pasted.strip()
    if TOKEN_PATTERN.fullmatch(value):
        token = value
    else:
        try:
            words = shlex.split(value)
        except ValueError:
            raise InstallError("The copied command is malformed.") from None
        if words[:2] != ["docker", "run"]:
            raise InstallError("Paste the raw token or Cloudflare's docker run command.")
        if not any(
            word == "cloudflare/cloudflared"
            or word.startswith("cloudflare/cloudflared:")
            or word.startswith("cloudflare/cloudflared@sha256:")
            for word in words
        ):
            raise InstallError("The copied command does not use the Cloudflare image.")
        candidates = []
        for index, word in enumerate(words):
            if word == "--token":
                if index + 1 >= len(words):
                    raise InstallError("The copied command is missing its token.")
                candidates.append(words[index + 1])
            elif word.startswith("--token="):
                candidates.append(word.partition("=")[2])
        if len(candidates) != 1:
            raise InstallError("The copied command must contain exactly one token.")
        token = candidates[0]
    if not TOKEN_PATTERN.fullmatch(token):
        raise InstallError("The token format is invalid.")
    try:
        decoded = base64.b64decode(
            token + "=" * (-len(token) % 4), altchars=b"-_", validate=True
        )
        payload = json.loads(decoded)
    except (binascii.Error, ValueError, UnicodeDecodeError):
        raise InstallError("The token is not valid encoded JSON.") from None
    if not isinstance(payload, dict):
        raise InstallError("The token payload is invalid.")
    if payload.get("a") != ACCOUNT_ID or payload.get("t") != TUNNEL_ID:
        raise InstallError("This token belongs to a different account or tunnel.")
    if not isinstance(payload.get("s"), str) or not payload["s"]:
        raise InstallError("The token has no tunnel secret.")
    return token


def existing_matches(directory: int, token: bytes) -> bool:
    """Check an existing credential without following links or exposing its value."""
    try:
        fd = os.open(TOKEN_NAME, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK, dir_fd=directory)
    except FileNotFoundError:
        return False
    except OSError:
        raise InstallError("The token destination cannot be opened safely.") from None
    with os.fdopen(fd, "rb") as current:
        info = os.fstat(current.fileno())
        if not stat.S_ISREG(info.st_mode) or info.st_nlink != 1:
            raise InstallError("The token destination must be a regular file without links.")
        if (info.st_uid, info.st_gid, stat.S_IMODE(info.st_mode)) != (65532, 65532, 0o400):
            raise InstallError("An existing token file has unexpected ownership or permissions.")
        if not secrets.compare_digest(current.read(MAX_INPUT + 1).strip(), token):
            raise InstallError("A different credential already exists; it was not overwritten.")
    return True


def install(token: str) -> bool:
    """Return True for a new atomic installation, False for an identical credential."""
    if os.geteuid() != 0:
        raise InstallError("Run this installer with sudo.")
    data = token.encode("ascii")
    root_fd = os.open(ROOT, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW)
    directory = None
    temporary = None
    try:
        try:
            os.mkdir("secrets", 0o700, dir_fd=root_fd)
        except FileExistsError:
            pass
        directory = os.open(
            "secrets", os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW, dir_fd=root_fd
        )
        info = os.fstat(directory)
        if info.st_uid != 0 or info.st_gid != 0:
            raise InstallError("The secrets directory must be owned by root:root.")
        os.fchmod(directory, 0o700)
        if existing_matches(directory, data):
            return False
        temporary = ".token-" + secrets.token_hex(16)
        fd = os.open(
            temporary, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW,
            0o600, dir_fd=directory,
        )
        with os.fdopen(fd, "wb") as output:
            output.write(data + b"\n")
            output.flush()
            os.fchown(output.fileno(), 65532, 65532)
            os.fchmod(output.fileno(), 0o400)
            os.fsync(output.fileno())
        try:
            # An exclusive hard-link creation publishes the complete file atomically.
            # Unlike replace(), it cannot overwrite a credential created concurrently.
            os.link(temporary, TOKEN_NAME, src_dir_fd=directory, dst_dir_fd=directory)
        except FileExistsError:
            if existing_matches(directory, data):
                return False
            raise InstallError("The token destination changed; nothing was overwritten.") from None
        os.unlink(temporary, dir_fd=directory)
        temporary = None
        os.fsync(directory)
        return True
    finally:
        if temporary is not None and directory is not None:
            os.unlink(temporary, dir_fd=directory)
        if directory is not None:
            os.close(directory)
        os.close(root_fd)


def main() -> int:
    try:
        if len(sys.argv) != 1:
            raise InstallError("This installer accepts no arguments; paste at the hidden prompt.")
        if os.geteuid() != 0:
            raise InstallError("Run this installer with sudo.")
        # Refuse getpass's fallback to echoed input when no controlling TTY exists.
        with warnings.catch_warnings():
            warnings.simplefilter("error", getpass.GetPassWarning)
            pasted = getpass.getpass("Cloudflare token or docker command (hidden): ")
        created = install(parse_token(pasted))
        print("Token installed." if created else "The same token is already installed.")
        return 0
    except (InstallError, getpass.GetPassWarning) as error:
        print(f"Installation refused: {error}", file=sys.stderr)
    except (EOFError, KeyboardInterrupt):
        print("\nInstallation cancelled.", file=sys.stderr)
    except OSError:
        print("Installation failed: check the deployment directory and permissions.", file=sys.stderr)
    return 1


if __name__ == "__main__":
    sys.exit(main())
