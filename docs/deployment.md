# daus.uk 배포

## 현재 상태 — 2026-09-30

NAS 수리 동안 Galmegi 개발팀 서버에 임시 원점을 준비했다. 개인 도메인은 `daus.uk`를 유지하고 수리 후 NAS로 복귀한다. **임시 원점 설치·검증은 완료했지만 Cloudflare 로그인·TLS 인증서·DNS 전환은 대기 중이다. 공개 도메인은 기존 NAS 연결을 유지한다.** CD도 `DEPLOY_ENABLED=false`이다. 전환과 복귀는 [이전 절차](migration.md), 자동화는 [CI/CD 문서](ci-cd.md)를 참고한다.

| 항목 | Galmegi 임시 원점 | NAS 복귀 대상 |
| --- | --- | --- |
| SSH | `13.209.179.165:22` | `remotedaus.iptime.org:1199` — 복귀 전 재확인 |
| 배포 계정 | `portfolio-deploy`, sudo 권한 없음 | 기존 `uhyun` — 인증·권한 재확인 |
| 배포 루트 | `/opt/monitor5-portfolio` | `/volume1/docker/monitor5-portfolio` |
| 웹 서버 | 호스트 Nginx의 별도 사이트 | 비루트 Nginx 컨테이너 |
| 원점 | `http://127.0.0.1:4387/` | `http://127.0.0.1:4387/` |
| 공개 연결 | `daus.uk` 전용 TLS 가상 호스트 준비 중 | 기존 Cloudflare Tunnel |
| `/healthz` 원점 헤더 | `X-Portfolio-Origin: galmegi-temporary` | 최신 설정 적용 후 `X-Portfolio-Origin: nas` |

임시 서버에는 전용 계정·`site/`·`incoming/`과 `restrict` 옵션의 배포 공개키를 설치했다. `ops/nginx.shared.conf`를 별도 사이트로 추가하고 Nginx 설정 검증·reload를 마쳤다. 변경 전후 기존 설정 블록 5개는 동일하며, 기존 `galmegi.com` API와 `dev.galmegi.com`의 정상 응답을 확인했다.

최초 검증 릴리스는 `20260930T004953Z-42455cde`이며 소스 커밋은 `59ad657`이다. 원점 경로·자산·식별 헤더 검사 24개를 통과했다. 이후 실제 활성 릴리스는 서버의 `site/current`와 해당 빌드 보고서로 확인한다. `daus.uk` 전용 인증서 개인키와 CSR은 준비했으나 인증서는 아직 발급하지 않았고 공개 TLS 가상 호스트도 활성화하지 않았다.

임시 서버의 인증서 경로는 `/etc/nginx/ssl/daus.uk/`이다. `private.pem`은 root 소유·0600으로 보관하고, `origin.csr`로 발급받은 인증서는 `origin.pem`에 설치한다. 개인키를 서버 밖으로 복사할 필요가 없다.

## 배포 파일과 릴리스

| 파일 | 용도 |
| --- | --- |
| `ops/nginx.shared.conf` | 임시 서버의 독립적인 loopback 정적 원점 |
| `ops/nginx.domain.conf` | 인증서 준비 후 설치할 `daus.uk` 전용 HTTP·HTTPS 가상 호스트 |
| `ops/nginx.conf` | NAS 컨테이너의 SPA·캐시·상태 확인 설정 |
| `ops/compose.yaml`, `ops/compose.tunnel.yaml` | NAS 웹·Cloudflare Tunnel 컨테이너 |
| `ops/install-tunnel-token.py` | NAS 터널 토큰의 숨김 입력·설치 |
| `ops/package-release.py` | 공개 파일 아카이브와 체크섬·커밋 보고서 생성 |
| `ops/update-release.py` | 체크섬 검증·원자적 활성화·원점 실패 시 복원 |
| `ops/deploy.sh` | CI 아티팩트의 SSH 전송과 활성화 |
| `ops/verify-public.py` | 공개 경로·정적 자산·원점 식별 검증 |

배포에는 허용된 HTML·JS·CSS·favicon·이미지·폰트만 포함한다. 조사 메모·소스 문서·소스맵·인증 정보는 제외한다. `site/current`는 `site/releases/<release>`를 가리키며 정적 릴리스 교체에 웹 서버 재시작은 필요하지 않다. 디렉터리는 0755, 공개 파일은 0644로 설정한다. `incoming/`과 비밀정보는 웹 루트 밖에 둔다.

자동 배포는 Nginx 설정과 DNS를 변경하지 않는다. 임시 서버의 웹 설정 변경은 기존 사이트를 보존하면서 별도 설정만 설치하고 `nginx -t` 성공 후 reload한다. NAS의 설정·이미지 변경은 해당 컨테이너만 검증·재시작한다.

## 수동 업데이트와 복원

검증한 빌드 아카이브·보고서·`update-release.py`를 같은 작업 폴더에 전송한 뒤 대상 서버에서 실행한다. 임시 서버의 예시는 다음과 같다. `COMMIT_SHA`는 해당 아티팩트의 전체 소스 커밋으로 지정한다.

```sh
python3 update-release.py portfolio-deploy.tar.gz deployment-build-report.json \
  --root /opt/monitor5-portfolio --expected-commit "$COMMIT_SHA"
```

NAS에서는 `--root /volume1/docker/monitor5-portfolio`를 사용한다. UGREEN SFTP의 가상 경로 때문에 실제 NAS 경로로 전송할 때는 `scp -O -P 1199`를 사용한다.

검증 실패 시 updater가 기존 `current` 링크로 복원한다. 긴급 수동 복원은 먼저 CD를 끄고 진행 중인 배포 종료를 확인한 뒤, 배포 루트의 `.deploy.lock`에 배타적 잠금을 잡고 검증된 이전 릴리스로 `current`를 원자적으로 교체한다. 원점·공개 검증을 마친 후 CD를 다시 켠다. 서버를 바꾸는 복원은 [NAS 복귀 절차](migration.md#nas-수리-후-복귀)를 따른다.

## NAS 운영 기록 — 2026-09-22~23

아래는 기존 NAS에서 확인한 운영 이력이며 현재 수리 상태를 보증하지 않는다.

- UGREEN NASync / Debian 12, 당시 LAN `192.168.0.245`.
- 웹 컨테이너 `monitor5-portfolio`, 읽기 전용 파일 시스템, 네트워크 `monitor5-portfolio_default`.
- 터널 `portfolio-daus-uk`, ID `3715cd9a-b363-4828-8fd1-3dc6657c43cd`, 서비스 `http://portfolio:8080`.
- 웹·터널 컨테이너는 `restart: unless-stopped`로 구성했다. NAS 관리 웹·Proxmox·공유기 포트포워딩은 변경하지 않았다.
- 2026-09-22 19:50 KST 릴리스 `20260922T104907Z-42455cde`를 검증했다. 당시 이전 릴리스는 `20260922T011758Z-32de34ac`이다.
- 해당 빌드 SHA-256은 `42455cde1e925a3edd5194253b6fdc8f3e80621e9ab7eabce97874cccdc1bf6f`이다. 공개 파일 7개와 다국어 경로·브라우저 동작을 확인했다.
- 2026-09-23 CI/CD 도입 시 NAS SSH 연결이 거부되어 GitHub CD는 활성화하지 않았다. 공개 사이트의 24개 검사는 통과했다.

터널 토큰은 NAS의 `secrets/cloudflared-token`에만 보관한다. 소유자는 `65532:65532`, 권한은 0400이며 Compose 환경변수·명령행·저장소에 넣지 않는다. 설치가 필요하면 NAS에서 다음을 실행하고 숨김 프롬프트에 토큰을 입력한다. 기존 토큰과 다르면 설치 도구가 덮어쓰지 않고 종료한다.

```sh
sudo python3 /volume1/docker/monitor5-portfolio/install-tunnel-token.py
sudo docker compose -p monitor5-portfolio \
  -f /volume1/docker/monitor5-portfolio/compose.yaml \
  -f /volume1/docker/monitor5-portfolio/compose.tunnel.yaml up -d
```

기존 터널과 NAS 릴리스는 복귀용으로 보존한다. 수리 후 연결·인증·원점·최신 빌드를 다시 검증한 다음 DNS를 돌린다.
