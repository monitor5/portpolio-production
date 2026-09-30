# NAS 수리 중 임시 이전과 복귀

개인 도메인 `daus.uk`를 유지하면서 NAS 수리 동안 Galmegi 개발팀 서버를 사용하고, NAS 복귀를 검증한 뒤 임시 서비스를 내린다. 기존 `galmegi.com`과 `dev.galmegi.com`은 별도 사이트로 계속 운영한다.

## 현재 진행 상태 — 2026-09-30

| 단계 | 상태 |
| --- | --- |
| 임시 서버 `13.209.179.165` SSH 확인 | 완료 |
| sudo 없는 `portfolio-deploy` 계정과 제한된 전용 공개키 | 완료 |
| `/opt/monitor5-portfolio` 릴리스·수신 폴더 | 완료 |
| 별도 Nginx loopback 원점 `127.0.0.1:4387` | 설치·설정 검증·reload 완료 |
| 최초 릴리스·원점 검사 | `20260930T004953Z-42455cde`, 검사 24개 통과 |
| 기존 Galmegi 서비스 보존 확인 | 기존 Nginx 설정 블록 5개 동일, API·개발 사이트 정상 |
| GitHub production 변수·호스트 키 | 임시 서버로 갱신 완료, 전용 개인키 유지 |
| `daus.uk` TLS 인증서·HTTPS 가상 호스트 | 설치·활성화 완료, 체인·호스트명·키 일치 검증 |
| Cloudflare SSL 운용 | 기존 자동 설정과 현재 Full 유지, 별도 strict 규칙 비활성 |
| DNS 전환 | `daus.uk` A → `13.209.179.165`, proxied, TTL Auto |
| 공개 검증 | HTTPS·자산·원점 식별 24개 통과 |
| GitHub 자동 배포 | `DEPLOY_ENABLED=true`, [첫 배포 성공](https://github.com/monitor5/portpolio-production/actions/runs/36659672747) |

**공개 도메인 전환과 새 원점 검증까지 완료했다.** `/healthz`에서 `X-Portfolio-Origin: galmegi-temporary`, `Cache-Control: no-store`, `CF-Cache-Status: DYNAMIC`을 확인했다. 같은 정적 파일을 서비스하는 기존 NAS와 구분하기 위해 원점 식별 값을 계속 검증한다. 기존 CNAME은 변경 직전 Cloudflare에서 확인해 보존했고 다른 DNS 레코드는 변경하지 않았다.

2026-09-30 커밋 `9d4fafc`의 첫 GitHub CD에서 테스트·빌드·SSH 전송·활성화·공개 HTTPS 검사 24개가 모두 성공했다. 이후 활성 커밋은 최신 성공한 Actions와 서버의 `site/current`로 확인한다.

인증서는 기존 CSR로 발급한 `daus.uk` 전용 90일 Origin CA 인증서다. 만료는 **2026-12-29 11:13 KST (02:13 UTC)**이며 NAS 복귀가 지연되면 만료 전에 갱신한다. 사용자가 임시 운영 동안 Full 유지를 선택했으므로 `daus.uk portfolio strict TLS` 규칙은 비활성 상태로 둔다.

## 임시 서버로 전환

1. CD를 `false`로 유지하고 실행 중인 배포가 없는지 확인한다. 전환에 사용할 최신 `main`의 검증된 아티팩트와 보고서를 정하고 임시 원점에 활성화한다. 현재 릴리스는 서버의 `site/current`로 확인한다.
2. Cloudflare에 로그인해 `daus.uk`의 실제 DNS 레코드·프록시 여부·SSL 모드·터널 설정을 기록한다. 기존 NAS 터널 주소 기록은 아래와 같지만 **변경 전에 대시보드에서 실제 레코드를 재확인한다.**

   ```text
   CNAME daus.uk → 3715cd9a-b363-4828-8fd1-3dc6657c43cd.cfargotunnel.com
   Proxy: enabled
   ```

3. 설치한 인증서와 `ops/nginx.domain.conf`를 확인한다. 이후 설정 변경도 기존 Galmegi 설정을 보존하고 `nginx -t` 성공 후 reload한다. `daus.uk` SNI를 지정한 원점 HTTPS 연결과 인증서 검증을 유지한다.
4. DNS 프록시와 Cloudflare의 기존 자동 SSL 설정·현재 Full 모드를 유지한다. 별도 strict 규칙을 활성화하지 않는다. Origin CA는 Cloudflare와 원점 사이의 인증서이므로 프록시를 유지한다. [Cloudflare Origin CA 안내](https://developers.cloudflare.com/ssl/origin-configuration/origin-ca/)
5. 인증서·원점 검사 후 `daus.uk` DNS를 임시 서버 `13.209.179.165`의 proxied A 레코드로 전환한다. 같은 이름의 기존 레코드를 확인해 충돌 없이 변경하고 다른 도메인·메일 레코드는 보존한다. [Cloudflare DNS 레코드 관리](https://developers.cloudflare.com/dns/manage-dns-records/how-to/create-dns-records/)
6. 전송한 아티팩트의 보고서로 공개 도메인을 검증한다.

   ```sh
   python3 ops/verify-public.py .cache/release/deployment-build-report.json \
     --url https://daus.uk --expected-origin galmegi-temporary
   ```

7. GitHub `production` 변수 `DEPLOY_ORIGIN=galmegi-temporary`를 반드시 설정하고 값이 일치하는지 확인한다. 이 값이 비어 있으면 CI의 원점 식별 검사가 생략된다. 공개 검증까지 성공한 뒤에만 `DEPLOY_ENABLED=true`로 바꾸고 최신 `main`을 수동 실행한다. GitHub CD의 전송·공개 검증이 모두 성공하면 README와 운영 문서에 완료 시각·커밋·Actions 실행을 기록한다. NAS 터널과 기존 릴리스는 복귀를 위해 보존한다.

공개 검증 실패 시 CD를 계속 끄고 DNS·TLS·원점 식별 값을 확인한다. 기존 NAS가 정상 응답하는 것을 확인한 경우에만 기록한 DNS로 되돌릴 수 있다. 수리 중인 NAS로 무조건 되돌리지 않는다.

## NAS 수리 후 복귀

1. `DEPLOY_ENABLED=false`로 바꾸고 진행 중인 배포가 끝날 때까지 기다린다. 복귀에 사용할 최신 `main` 아티팩트와 보고서를 정해 임시 서버와 NAS가 같은 빌드를 제공하도록 준비한다.
2. NAS SSH 주소·포트·신뢰할 호스트 키를 다시 확인한다. 기존 값은 `remotedaus.iptime.org:1199`, 사용자 `uhyun`, 배포 루트 `/volume1/docker/monitor5-portfolio`이다. 전용 배포 공개키와 쓰기 권한을 확인하고 NAS 터널이 정상 연결되는지 점검한다.
3. NAS에 최신 `ops/nginx.conf`를 적용해 `/healthz`가 `X-Portfolio-Origin: nas`를 반환하도록 한다. 해당 컨테이너 설정을 검증하고 필요한 경우 웹 컨테이너만 재시작한다. 같은 검증 아티팩트를 NAS에 전송해 `--expected-commit`으로 활성화한다.
4. NAS 내부에서 HTML·정적 자산·상태 확인·원점 헤더를 검증한다. 해당 서버의 작업 폴더에 검증 도구와 동일한 보고서를 준비한 뒤 실행한다.

   ```sh
   python3 verify-public.py deployment-build-report.json \
     --url http://127.0.0.1:4387 --expected-origin nas
   ```

5. Cloudflare에서 현재 레코드와 기존 NAS 터널을 다시 확인한다. 터널이 준비되면 `daus.uk`를 기존 proxied CNAME `3715cd9a-b363-4828-8fd1-3dc6657c43cd.cfargotunnel.com`으로 복귀시킨다. 이 주소는 보존된 기록이므로 실제 터널과 일치하는지 확인한 뒤 사용한다.
6. GitHub `production`의 `DEPLOY_HOST`·`DEPLOY_PORT`·`DEPLOY_USER`·`DEPLOY_ROOT`를 확인한 NAS 값으로 복원하고 `SSH_KNOWN_HOSTS`도 신뢰한 NAS 키로 바꾼다. `DEPLOY_URL=https://daus.uk`, `DEPLOY_ORIGIN=nas`로 설정한다. CD는 아직 끈 상태를 유지한다.
7. 같은 보고서로 `https://daus.uk`를 `--expected-origin nas`와 함께 검증한다. 공개 검증이 성공하면 CD를 켜고 최신 `main`의 첫 NAS 배포가 성공하는지 확인한다.
8. 복귀 완료 시각·커밋·원점 검사·Actions 실행을 문서에 기록한다. NAS 운영을 확인한 뒤 임시 서버의 포트폴리오 가상 호스트를 비활성화하고 설정 검증 후 Nginx를 reload한다. 전용 배포 계정·키·임시 인증서·릴리스를 정리해 임시 서비스를 종료한다. 비활성 상태의 전용 strict 규칙도 정리하되 기존 Cloudflare SSL 설정과 Galmegi의 서비스 설정·데이터는 보존한다.

복귀 도중 문제가 생기면 CD를 끄고 검증된 임시 원점으로 DNS와 GitHub 대상 설정을 함께 복원한다. DNS의 대상과 `DEPLOY_ORIGIN`이 일치하고 공개 검증까지 성공해야 CD를 다시 켠다.
