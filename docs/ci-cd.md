# GitHub Actions CI/CD

워크플로: [Portfolio CI/CD](https://github.com/monitor5/portpolio-production/actions/workflows/ci-cd.yml)

## 실행 흐름

1. PR, `main` push, 수동 실행에서 Node.js 24와 `npm ci`로 고정 의존성을 설치한다.
2. 다국어 애플리케이션 테스트와 Python 배포·복원 테스트를 실행한다.
3. Vite 빌드에서 허용된 공개 파일만 묶고, 파일별 크기·SHA-256과 소스 커밋을 보고서에 기록한다.
4. 검증한 아카이브와 보고서를 `portfolio-<commit>` 아티팩트로 14일간 보관한다.
5. `DEPLOY_ENABLED=true`일 때만 `main` 빌드를 `production` 환경에서 NAS로 전송한다. PR에는 배포 비밀정보를 전달하지 않는다.
6. 서버에서 체크섬·소스 커밋을 재검증하고, 새 릴리스를 원자적으로 활성화한다. NAS 파일 잠금과 Actions 동시 실행 제한으로 배포가 겹치지 않게 한다.
7. 원점 HTML이 새 빌드와 다르면 이전 릴리스로 복원한다. 이후 공개 HTTPS 경로, 번들 참조, 정적 자산 체크섬과 `/healthz`를 검증한다.

공개 HTTPS 검증 실패는 Actions 실패로 표시한다. Cloudflare·외부 네트워크 장애와 빌드 문제를 구별하기 위해 이 단계에서는 자동으로 이전 빌드를 활성화하지 않는다. 원점 검증 실패 시의 자동 복원과 구분한다.

오래된 실행을 재실행해도 배포 시작 시점의 `main` 최신 커밋과 다르면 건너뛴다. 배포가 진행 중일 때는 새 push로 해당 실행을 강제 취소하지 않는다. Actions는 전체 커밋 SHA로 고정하며 기본 토큰 권한은 `contents: read`이다.

## 현재 설정과 남은 활성화 절차

2026-09-23 KST 기준 GitHub `production` 환경, `main` 브랜치 제한, 아래 변수와 비밀정보를 등록했다. `DEPLOY_ENABLED=false`이므로 CI는 실행되지만 CD는 명시적으로 건너뛴다.

기존 SSH 주소 `remotedaus.iptime.org:1199`는 연결을 거부했고, 현재 Mac에서는 NAS 내부 주소 `192.168.0.245`에도 연결되지 않았다. 공개 `https://daus.uk`는 200으로 응답했다. **서버 접속과 배포용 공개키 설치는 아직 확인되지 않았다.**

첫 GitHub Actions CI에서 애플리케이션 9개와 배포 도구 31개 테스트, 빌드·패키징·아티팩트 업로드가 성공했다. 기존 공개 사이트도 새 검증 도구의 24개 검사를 통과했다. Cloudflare가 기본 Python User-Agent를 거부하므로 검증기는 용도를 명시한 별도 User-Agent를 사용한다. 이 확인은 새 CD 전송 성공을 의미하지 않는다.

| 구분 | 이름 | 값 또는 용도 |
| --- | --- | --- |
| 저장소 변수 | `DEPLOY_ENABLED` | 준비 전 `false`, 준비 완료 후 `true` |
| production 변수 | `DEPLOY_HOST` | `remotedaus.iptime.org` |
| production 변수 | `DEPLOY_PORT` | `1199` |
| production 변수 | `DEPLOY_USER` | `uhyun` |
| production 변수 | `DEPLOY_ROOT` | `/volume1/docker/monitor5-portfolio` |
| production 변수 | `DEPLOY_URL` | `https://daus.uk` |
| production secret | `SSH_PRIVATE_KEY` | 포트폴리오 배포 전용 Ed25519 개인키 |
| production secret | `SSH_KNOWN_HOSTS` | 이 Mac에 기존 등록되어 있던 NAS 호스트 키 |

전용 키는 이 Mac의 `~/.ssh/portfolio_actions_ed25519`에 생성했고 개인키는 `production` secret에 등록했다. 공개키는 `~/.ssh/portfolio_actions_ed25519.pub`와 로컬 `.cache/cicd/deploy-key.pub`에 있다. 키와 캐시 파일은 Git에 포함하지 않는다.

활성화 순서:

1. 실제 NAS SSH 주소·포트를 확인하고 필요한 경우 `production` 변수를 수정한다.
2. NAS의 배포 계정 `~/.ssh/authorized_keys`에 전용 공개키를 추가한다. 키 앞에 `restrict` 옵션을 붙이면 포트 포워딩·에이전트 포워딩·PTY 사용을 차단할 수 있다. `.ssh`는 0700, `authorized_keys`는 0600으로 설정한다. 배포 계정은 기존 `site/`, `incoming/`에 쓰기 권한이 필요하며 배포 중 sudo나 Docker 권한은 사용하지 않는다.
3. 등록된 호스트 키가 실제 NAS와 일치하는지 신뢰할 수 있는 NAS 콘솔에서 확인한다. 호스트명이 바뀌면 `SSH_KNOWN_HOSTS`의 호스트 표기도 수정한다. 워크플로는 실행 중 얻은 `ssh-keyscan` 결과를 무조건 신뢰하지 않는다.
4. 아래 명령으로 비대화형 인증과 쓰기 권한을 확인한다.

```sh
ssh -i ~/.ssh/portfolio_actions_ed25519 -o IdentitiesOnly=yes \
  -o BatchMode=yes -o StrictHostKeyChecking=yes \
  -p 1199 uhyun@remotedaus.iptime.org \
  'python3 --version; test -w /volume1/docker/monitor5-portfolio/site && test -w /volume1/docker/monitor5-portfolio/incoming'
```

5. SSH 준비가 끝나면 활성화하고 실행한다.

```sh
gh variable set DEPLOY_ENABLED --body true --repo monitor5/portpolio-production
gh workflow run ci-cd.yml --ref main --repo monitor5/portpolio-production
gh run list --workflow ci-cd.yml --repo monitor5/portpolio-production
```

GitHub 호스팅 실행기에서도 NAS SSH 주소·포트에 도달할 수 있어야 한다. GitHub Actions에서 첫 배포와 공개 검증까지 성공했는지 확인한 뒤 README와 이 문서의 대기 상태를 갱신한다.

## 수동 검증과 아티팩트

```sh
npm ci
npm test
python3 -m unittest discover -s tests -p 'test_*.py' -v
npm run build
python3 ops/package-release.py --commit "$(git rev-parse HEAD)"
python3 ops/update-release.py .cache/release/portfolio-deploy.tar.gz \
  .cache/release/deployment-build-report.json --verify-only \
  --expected-commit "$(git rev-parse HEAD)"
```

`ops/package-release.py`는 소스맵·문서·심볼릭 링크와 허용 목록 밖 파일을 거부한다. `SOURCE_DATE_EPOCH`를 지정하면 보고서 시각도 재현할 수 있다. 공개 검증은 배포 후에 실행한다.

```sh
python3 ops/verify-public.py .cache/release/deployment-build-report.json \
  --url https://daus.uk
```

CI/CD는 Nginx 설정, Compose 이미지, Cloudflare Tunnel 토큰을 자동 변경하지 않는다. 해당 운영 설정 변경은 별도 적용·검증이 필요하다. 서버 `incoming/<commit>-<run>-<attempt>/`와 `site/releases/`는 자동 삭제하지 않으며 운영자가 `current`, `previous`를 보존하면서 정리한다.

## 중지와 복원

자동 배포 중지: `gh variable set DEPLOY_ENABLED --body false --repo monitor5/portpolio-production`. CI는 계속 실행된다. 이미 실행 중인 배포는 이 변수 변경으로 중단되지 않는다.

코드 복원은 정상 버전으로 되돌리는 새 커밋을 `main`에 push하는 방법을 권장한다. 긴급 NAS 수동 복원은 [배포 문서](deployment.md)를 따른다. 수동 작업도 배포 루트의 `.deploy.lock` 파일에 대한 배타적 잠금을 사용해 CI/CD와 겹치지 않게 한다.
