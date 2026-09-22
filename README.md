# U Hyun Kim — Portfolio

김우현의 AI·백엔드 개발, 하드웨어·홈랩 경험과 연구·출판 활동을 소개하는 포트폴리오입니다.

**Production: [daus.uk](https://daus.uk)** · Private repository: `monitor5/portpolio-production`

세로 스크롤로 소개와 대표 작업을 읽고, Projects·Lab·AI의 개별 페이지에서 구현과 실험 이야기를 확인할 수 있습니다. 영어가 기본 언어이며 한국어·일본어, 라이트·다크 모드를 지원합니다.

## 로컬 개발

Node.js 24 LTS를 사용합니다 (`.nvmrc`).

```sh
npm ci
npm run dev
```

개발 서버: [localhost:4387](http://127.0.0.1:4387/)

```sh
npm test
npm run build
npm run preview
```

## 구성

| 경로 | 내용 |
| --- | --- |
| `src/main.js` | 페이지 렌더링과 탐색 |
| `src/style.css` | 반응형 디자인과 테마 |
| `src/data.js` | 프로젝트·장비·출판 데이터 |
| `src/i18n.js`, `src/locales/` | 언어 선택과 EN·KO·JA 번역 |
| `src/media.js`, `public/assets/` | 사진 연결과 공개 이미지 |
| `tests/` | 다국어 콘텐츠와 탐색 검증 |
| `ops/` | Nginx, Docker Compose, 릴리스·터널 토큰 설치 도구 |
| `docs/` | 기획·콘텐츠·사진 가이드와 운영 문서 |

언어를 지정한 링크는 `?lang=en`, `?lang=ko`, `?lang=ja`로 공유합니다. 콘텐츠를 변경할 때는 세 언어를 함께 수정하고 테스트·빌드를 확인합니다.

## 배포

NAS의 Nginx 컨테이너가 정적 빌드를 제공하고, 별도 Cloudflare Tunnel 컨테이너가 `daus.uk`에 연결합니다. 배포 상태와 실행·업데이트·복원 방법은 [배포 문서](docs/deployment.md)에 있습니다.

GitHub Actions는 PR과 `main` push에서 테스트·빌드·배포 도구 검증을 실행하고, 공개 빌드만 릴리스 아티팩트로 보관합니다. 자동 배포를 활성화하면 `main` 검증 성공 후 NAS에 전송하고, 원점 검증 실패 시 이전 릴리스로 복원합니다. 공개 HTTPS 경로와 정적 자산도 확인합니다.

**현재 CI는 활성화, CD는 NAS SSH 연결과 전용 공개키 설치 대기 상태입니다.** 연결을 확인한 뒤 저장소 변수 `DEPLOY_ENABLED=true`로 활성화합니다. 설정과 재실행 방법은 [CI/CD 운영 문서](docs/ci-cd.md)에 있습니다. 터널 토큰은 NAS의 별도 파일에 보관하며 저장소에 포함하지 않습니다.

## 참고 문서

- [다국어 지원](docs/i18n.md)
- [디자인 방향](docs/apple-direction.md)
- [사진 촬영·제공 가이드](docs/photo-brief.md)
- [사이트 기획](docs/portfolio-plan.md)
- [하드웨어·홈랩 이야기](docs/hardware-story.md)
- [추가 콘텐츠 수집 항목](docs/content-intake.md)

`notes/private/`의 로컬 조사 기록, `.cache/`, 의존성, 빌드 결과물과 인증 파일은 Git 추적에서 제외합니다. `docs/`의 이전 시안과 초안은 기획 이력이며 현재 구현은 소스를 기준으로 확인합니다.
