# daus.uk 배포

2026-09-22. 대상은 사용자가 지정한 NAS이며 Cloudflare Tunnel로 공개한다.

## 현재 서버 구성

- SSH: `remotedaus.iptime.org:1199`, 사용자 `uhyun`. 비밀번호는 문서·소스에 저장하지 않는다.
- NAS: UGREEN NASync / Debian 12, LAN `192.168.0.245`.
- 애플리케이션: `/volume1/docker/monitor5-portfolio`.
- 웹 컨테이너: `monitor5-portfolio`, Nginx, 비루트 사용자, 읽기 전용 파일 시스템.
- 원점 확인 주소: NAS 내부의 `http://127.0.0.1:4387/`.
- 터널 내부 서비스 주소: `http://portfolio:8080`.
- 컨테이너 네트워크: `monitor5-portfolio_default`.

기존 NAS 관리 웹과 Proxmox 접속, 공유기 포트포워딩은 변경하지 않는다. 호스트의 Nginx 설정에도 새 공개 서버 블록을 설치하지 않았다.

## 배포 파일

- `ops/nginx.conf`: SPA 경로, 캐시 정책, 상태 확인.
- `ops/compose.yaml`: 웹 컨테이너. Nginx 이미지는 검증된 digest로 고정.
- `ops/compose.tunnel.yaml`: Cloudflare 연결 컨테이너. 공개 포트를 열지 않는다.
- `ops/install-tunnel-token.py`: 숨김 입력으로 토큰을 검증하고 서버의 비밀정보 파일에 설치한다.
- `ops/update-release.py`: 빌드 체크섬 검증, 새 릴리스 활성화, 실패 시 이전 링크 복원.

빌드에 포함된 것은 `dist/`의 HTML·JS·CSS·favicon·이미지뿐이다. 조사 메모, 소스 문서, 소스맵, 로그인 정보는 업로드하지 않는다.

## 릴리스

현재 배포 릴리스: `20260922T104907Z-42455cde` (2026-09-22 19:50 KST 확인).

고교 개발 경험과 스마트미러 상세, 소개 문구, 2022년 성남시청소년재단 일경험 수련을 한국어·영어·일본어로 반영했다. 복원용 이전 릴리스는 `20260922T011758Z-32de34ac`이며 `site/previous`가 가리킨다.

빌드 아카이브 SHA-256:

```text
42455cde1e925a3edd5194253b6fdc8f3e80621e9ab7eabce97874cccdc1bf6f
```

`site/current`는 `site/releases/<release>`를 가리킨다. 정적 파일 교체에는 웹 컨테이너 재시작이 필요하지 않다. 웹 설정이나 이미지 변경에는 설정 검증 후 해당 컨테이너만 재시작한다.

이번 아카이브와 파일별 검증 보고서는 서버의 `incoming/20260922T104907Z-42455cde/`에 보관한다. 서버에서 체크섬을 검증한 뒤 링크를 교체했고, 원점 HTTP 응답이 새 빌드의 index와 일치함을 확인했다.

NAS의 기본 umask가 제한적이므로, 공개 site 디렉터리는 0755, 공개 파일과 Nginx 설정은 0644로 명시한다. `incoming/`과 터널 비밀정보 폴더는 공개하지 않는다.

## Cloudflare

- 계정에서 생성한 터널: `portfolio-daus-uk`.
- 터널 ID: `3715cd9a-b363-4828-8fd1-3dc6657c43cd`.
- 공개 호스트: `daus.uk`.
- 서비스: HTTP, `portfolio:8080`.
- 토큰 파일: 서버의 `secrets/cloudflared-token`만 사용. 소유자 `65532:65532`, 권한 0400.
- 토큰을 Compose 환경변수나 명령행 인수에 직접 넣지 않는다.

서버에 설치 스크립트를 전송한 뒤, NAS의 SSH 터미널에서 먼저 실행한다:

```sh
sudo python3 /volume1/docker/monitor5-portfolio/install-tunnel-token.py
```

`Cloudflare token or docker command (hidden):` 프롬프트에 복사한 토큰 또는 Cloudflare의 `docker run ... --token ...` 명령 전체를 붙여 넣고 Enter를 누른다. 입력은 화면에 표시되지 않는다. 스크립트는 붙여 넣은 명령을 실행하지 않고, 지정한 계정과 터널의 토큰만 추출해 저장한다. 기존 토큰과 다르면 덮어쓰지 않고 종료한다.

설치 성공 후 연결 시작:

```sh
sudo docker compose -p monitor5-portfolio \
  -f /volume1/docker/monitor5-portfolio/compose.yaml \
  -f /volume1/docker/monitor5-portfolio/compose.tunnel.yaml up -d
```

Cloudflare의 공개 호스트 설정으로 DNS를 터널에 연결한다. 직접 IP를 가리키는 임시 CNAME이나 공유기의 80/443 재지정은 이 방식에 필요하지 않다.

## 업데이트와 복원

로컬에서 `npm test`, `npm run build`를 실행하고 공개 빌드만 묶는다. 아카이브와 파일별 SHA-256 보고서를 함께 전송한다.

UGREEN의 SFTP는 가상 경로를 사용하므로 실제 파일 시스템 경로로 전송할 때는 `scp -O -P 1199`를 사용한다. 인증은 SSH 프롬프트 또는 사용자의 기존 SSH 키를 이용한다.

서버에서:

```sh
python3 update-release.py incoming/portfolio-deploy.tar.gz \
  incoming/deployment-build-report.json
```

새 릴리스 검증에 실패하면 스크립트가 기존 `current` 링크로 돌아간다. 수동 복원은 검증한 기존 릴리스에 대한 심볼릭 링크를 만든 뒤 `current`로 원자적으로 교체한다.

## 확인 상태

- 빌드 및 테스트 9개 통과.
- 업로드된 공개 파일 7개의 체크섬 일치.
- NAS의 웹 컨테이너가 healthy.
- 홈과 EN/KO/JA 상세 경로가 200으로 응답하고 빌드 index의 SHA-256과 일치.
- 2026-09-22 11:09 KST: Cloudflare Tunnel 연결 완료. `http://daus.uk`와 `https://daus.uk` 정상 응답.
- 공개 사이트의 대표 상세 경로 및 정적 파일 7개가 배포 빌드 SHA-256과 일치.
- 실제 브라우저에서 영어 기본 화면 및 한국어·일본어 전환 확인.
- 웹과 터널 컨테이너는 `restart: unless-stopped`로 구성.
- NAS 호스트에 시도된 APT cloudflared 설치는 기존 picom/vim 의존성 문제로 실패했다. 운영 터널은 Docker 이미지로 실행하므로 호스트 패키지 복구는 수행하지 않았다.
- 2026-09-22 19:50 KST: 새 콘텐츠 릴리스 활성화 후 웹 컨테이너 healthy, 터널 실행 상태를 확인했다. 운영 브라우저에서 고교 경험·일경험 수련 본문과 스마트미러 상세 이동이 정상이며 콘솔 오류가 없다.
- 이번 릴리스의 HTTPS 공개 검증 14개 통과: 정적 자산 6개는 크기·SHA-256이 빌드와 일치하고, 홈 및 EN/KO/JA 홈·스마트미러 상세는 모두 200이다. 공개 HTML은 Cloudflare가 추가한 `static.cloudflareinsights.com` 스크립트 한 개와 그 직후 개행을 제외하면 원본 index와 바이트 단위로 일치한다. `/healthz`도 200과 `ok`로 응답한다.
