#!/usr/bin/env bash
# Transfer only the verified static release and the activation tool to the NAS.
set -euo pipefail

: "${SSH_PRIVATE_KEY:?Set the production SSH_PRIVATE_KEY secret}"
: "${SSH_KNOWN_HOSTS:?Set the production SSH_KNOWN_HOSTS secret}"
: "${DEPLOY_HOST:?Set the production DEPLOY_HOST variable}"
: "${DEPLOY_PORT:?Set the production DEPLOY_PORT variable}"
: "${DEPLOY_USER:?Set the production DEPLOY_USER variable}"
: "${DEPLOY_ROOT:?Set the production DEPLOY_ROOT variable}"
: "${GITHUB_SHA:?A full source commit is required}"
: "${GITHUB_RUN_ID:?A workflow run ID is required}"
: "${GITHUB_RUN_ATTEMPT:?A workflow run attempt is required}"

# These fields also form the remote shell command; accept no shell metacharacters.
[[ "$DEPLOY_HOST" =~ ^[a-zA-Z0-9][a-zA-Z0-9.-]*$ ]]
[[ "$DEPLOY_USER" =~ ^[a-zA-Z_][a-zA-Z0-9_-]*$ ]]
[[ "$DEPLOY_PORT" =~ ^[0-9]{1,5}$ ]]
(( 10#$DEPLOY_PORT >= 1 && 10#$DEPLOY_PORT <= 65535 ))
[[ "$DEPLOY_ROOT" =~ ^/[a-zA-Z0-9_/-]+$ && "$DEPLOY_ROOT" != / ]]
[[ "$GITHUB_SHA" =~ ^[a-f0-9]{40}$ ]]
[[ "$GITHUB_RUN_ID" =~ ^[0-9]+$ && "$GITHUB_RUN_ATTEMPT" =~ ^[0-9]+$ ]]

release_dir=.cache/release
python3 ops/update-release.py \
  "$release_dir/portfolio-deploy.tar.gz" "$release_dir/deployment-build-report.json" \
  --verify-only --expected-commit "$GITHUB_SHA"

umask 077
ssh_directory=$(mktemp -d)
trap 'rm -rf -- "$ssh_directory"' EXIT
printf '%s\n' "$SSH_PRIVATE_KEY" > "$ssh_directory/key"
printf '%s\n' "$SSH_KNOWN_HOSTS" > "$ssh_directory/known_hosts"
unset SSH_PRIVATE_KEY SSH_KNOWN_HOSTS
ssh-keygen -y -P '' -f "$ssh_directory/key" > /dev/null

ssh_options=(
  -i "$ssh_directory/key"
  -o IdentitiesOnly=yes
  -o BatchMode=yes
  -o StrictHostKeyChecking=yes
  -o "UserKnownHostsFile=$ssh_directory/known_hosts"
  -o ConnectTimeout=15
  -o ServerAliveInterval=15
  -o ServerAliveCountMax=3
)
destination="$DEPLOY_USER@$DEPLOY_HOST"
incoming="$DEPLOY_ROOT/incoming/$GITHUB_SHA-$GITHUB_RUN_ID-$GITHUB_RUN_ATTEMPT"

ssh "${ssh_options[@]}" -p "$DEPLOY_PORT" "$destination" \
  "umask 077; mkdir -p '$incoming'"
# UGREEN SFTP virtualizes paths; legacy SCP honors the NAS filesystem path.
scp -O "${ssh_options[@]}" -P "$DEPLOY_PORT" \
  "$release_dir/portfolio-deploy.tar.gz" \
  "$release_dir/deployment-build-report.json" \
  ops/update-release.py "$destination:$incoming/"
ssh "${ssh_options[@]}" -p "$DEPLOY_PORT" "$destination" \
  "python3 '$incoming/update-release.py' '$incoming/portfolio-deploy.tar.gz' '$incoming/deployment-build-report.json' --root '$DEPLOY_ROOT' --expected-commit '$GITHUB_SHA'"
