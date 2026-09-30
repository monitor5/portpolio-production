# GitHub Actions CI/CD

워크플로: [Portfolio CI/CD](https://github.com/monitor5/portpolio-production/actions/workflows/ci-cd.yml)

## 현재 상태 — 2026-09-30

NAS 수리 동안 Galmegi 개발팀 서버를 임시 배포 대상으로 사용하고 개인 도메인 `daus.uk`를 유지한다. 전용 배포 계정·정적 원점·TLS 인증서·HTTPS 가상 호스트를 설치하고 proxied A 레코드를 `13.209.179.165`로 전환했다. **공개 검증 24개 통과 후 `DEPLOY_ENABLED=true`로 CD를 활성화했으며, `main` 커밋 `9d4fafc`의 [첫 GitHub 배포](https://github.com/monitor5/portpolio-production/actions/runs/36659672747)가 성공했다.** 테스트·빌드, SSH 전송·활성화, 공개 HTTPS 검증 24개까지 완료했다. 사용자의 결정에 따라 임시 운영 동안 Cloudflare의 기존 자동 SSL 설정과 현재 Full 모드를 유지한다. 전환 기록·NAS 복귀는 [이전 절차](migration.md)를 따른다.

GitHub `production` 환경은 `main` 브랜치로 제한한다. 등록된 임시 대상 설정은 다음과 같다.

| 구분 | 이름 | 값 또는 용도 |
| --- | --- | --- |
| 저장소 변수 | `DEPLOY_ENABLED` | `true` |
| production 변수 | `DEPLOY_HOST` | `13.209.179.165` |
| production 변수 | `DEPLOY_PORT` | `22` |
| production 변수 | `DEPLOY_USER` | `portfolio-deploy` |
| production 변수 | `DEPLOY_ROOT` | `/opt/monitor5-portfolio` |
| production 변수 | `DEPLOY_URL` | `https://daus.uk` |
| production 변수 | `DEPLOY_ORIGIN` | `galmegi-temporary` |
| production secret | `SSH_PRIVATE_KEY` | 기존 포트폴리오 배포 전용 Ed25519 개인키 유지 |
| production secret | `SSH_KNOWN_HOSTS` | 확인한 임시 서버 SSH 호스트 키로 갱신 |

배포 전용 키 이름은 `portfolio_actions_ed25519`이다. 서버의 전용 계정은 sudo 권한 없이 포트폴리오 릴리스만 갱신하며 공개키에는 `restrict` 옵션을 적용했다. 개인키·호스트 인증 자료의 내용은 문서에 기록하지 않는다. `SSH_KNOWN_HOSTS`는 신뢰한 서버 키로 등록하며 배포 중 얻은 `ssh-keyscan` 결과를 자동 신뢰하지 않는다.

2026-09-23 첫 GitHub CI에서는 애플리케이션 9개와 배포 도구 31개, 총 40개 테스트와 빌드·패키징·아티팩트 업로드가 성공했다. 2026-09-30에는 원점 식별 검증을 포함해 애플리케이션 9개와 Python 34개, 총 43개 테스트가 로컬·GitHub에서 통과했다. 로컬 actionlint·shellcheck도 통과했다.

## 실행 흐름

1. PR, `main` push, 수동 실행에서 Node.js 24와 `npm ci`로 고정 의존성을 설치한다.
2. 애플리케이션·배포·복원 테스트를 실행하고 Vite로 빌드한다.
3. 허용된 공개 파일만 묶고 파일별 크기·SHA-256·소스 커밋을 보고서에 기록한다. 검증한 아카이브와 보고서는 `portfolio-<commit>` 아티팩트로 14일간 보관한다.
4. `DEPLOY_ENABLED=true`인 `main` 실행만 `production` 환경에서 배포한다. PR에는 배포 비밀정보를 전달하지 않는다. 배포 직전 최신 `main`과 다른 커밋은 건너뛴다.
5. 서버에서 체크섬·소스 커밋을 재검증하고 새 릴리스를 원자적으로 활성화한다. 서버 파일 잠금과 Actions 동시 실행 제한으로 배포가 겹치지 않게 한다.
6. 원점 HTML이 새 빌드와 다르면 이전 릴리스로 복원한다. 공개 HTTPS 경로·번들 참조·정적 자산 체크섬·`/healthz`와 `X-Portfolio-Origin`을 확인한다.

원점 식별 값은 임시 서버에서 `galmegi-temporary`, NAS에서 `nas`이다. 동일한 빌드가 두 서버에 있어도 잘못된 원점으로 연결된 상태는 공개 검증에서 실패한다. 검증기는 Cloudflare 호환을 위해 용도를 명시한 User-Agent를 사용한다.

공개 HTTPS 검증 실패는 Actions 실패로 표시한다. Cloudflare·외부 네트워크 장애와 빌드 문제를 구별하기 위해 이 단계에서는 자동 복원을 수행하지 않는다. 원점 검증 실패 시의 자동 복원과 구분한다. 새 push가 진행 중인 배포를 강제 취소하지 않으며, Actions는 전체 커밋 SHA로 고정하고 기본 토큰 권한은 `contents: read`로 제한한다.

## 수동 검증과 실행

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

패키징은 소스맵·문서·심볼릭 링크와 허용 목록 밖 파일을 거부한다. `SOURCE_DATE_EPOCH`를 지정하면 보고서 시각도 재현할 수 있다. 임시 원점으로 도메인을 전환한 뒤 같은 빌드 보고서로 검증한다.

```sh
python3 ops/verify-public.py .cache/release/deployment-build-report.json \
  --url https://daus.uk --expected-origin galmegi-temporary
```

서버 인증·쓰기 권한·원점·공개 도메인 검증까지 모두 성공한 뒤 활성화한다. GitHub 호스팅 실행기에서도 서버 SSH 주소에 도달할 수 있어야 한다.

```sh
gh variable set DEPLOY_ENABLED --body true --repo monitor5/portpolio-production
gh workflow run ci-cd.yml --ref main --repo monitor5/portpolio-production
gh run list --workflow ci-cd.yml --repo monitor5/portpolio-production
```

대상 서버를 다시 전환하면 첫 CD의 전송·공개 검증 성공까지 확인하고 운영 문서를 갱신한다. CI/CD는 Nginx 설정·TLS 인증서·DNS·Compose 이미지·터널 토큰을 자동 변경하지 않는다. 서버 `incoming/<commit>-<run>-<attempt>/`와 `site/releases/`는 운영자가 `current`, `previous`를 보존하면서 정리한다.

## 중지와 복원

```sh
gh variable set DEPLOY_ENABLED --body false --repo monitor5/portpolio-production
```

CI는 계속 실행되며 이미 실행 중인 배포는 중단되지 않는다. 서버나 DNS를 전환하기 전 진행 중인 배포가 끝났는지도 확인한다.

코드 복원은 정상 버전으로 되돌리는 새 커밋을 `main`에 push한다. 긴급 릴리스 복원은 [배포 문서](deployment.md), 서버 자체의 전환은 [이전 절차](migration.md)를 따른다. 수동 릴리스 변경도 배포 루트의 `.deploy.lock`에 배타적 잠금을 사용한다.
