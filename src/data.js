export const publications = [
  { id: 'paper', type: 'KCI PAPER', year: '2024', title: '국방 분야에서의 LLM 활용 문제점과 해결 전략', subtitle: 'Analyzing and Addressing Challenges of LLM Applications in Defense', detail: '국방과 보안 · 6(1) · 302–328', role: '공동저자', authors: '이소울 · 이성호 · 유희철 · 박상수 · 김우현', url: 'https://www.kci.go.kr/kciportal/landing/article.kci?arti_id=ART003094955', description: '국방 환경에서 LLM을 활용할 때 생기는 문제와 대응 전략을 연구한 KCI 등재 논문입니다.' },
  { id: 'book', type: 'PUBLISHED BOOK', year: '2026', title: 'LLM 활용과 국방', subtitle: '기술의 가능성에서 실제 운용까지.', detail: '커뮤니케이션북스 · 2026.04.24 · 148쪽', role: '공저자', authors: '이성호 · 이소울 · 유희철 · 박상수 · 김우현', url: 'https://aiseries.oopy.io/3482a687-4abf-81c9-a5e4-e7818d5ef7b0', description: '국방 분야의 LLM 활용을 보안, 신뢰성, 운용 조건과 책임의 관점에서 다룬 책입니다.' }
];

export const projects = [
  {
    id: 'galmegi', title: '여행갈매기', english: 'GALMEGI', category: 'product', categories: ['product', 'ai', 'backend'], type: 'AI · BACKEND · SERVICE', summary: '부산 여행의 일정, 이동, 역 시설을 하나의 흐름으로.', color: 'blue',
    role: '팀장 · 백엔드 · AI · 서버', status: '부산교통공사 지원 배포 중', stack: ['Spring Boot', 'Java', 'MySQL', 'Python ETL', 'Kotlin'],
    intro: '어디로 갈지 골랐다면, 이제 어떻게 갈지. 여행갈매기는 부산 여행의 날짜별 일정부터 대중교통 이동, 역 시설 정보까지 연결합니다.',
    facts: [['개발 기간', '1주일'], ['나의 역할', '팀장 · 백엔드 · AI · 서버'], ['수상', 'DIVE 2026 발제사 2등상'], ['현재', '부산교통공사 지원 배포 · Google Play 출시 절차 중']],
    sections: [
      ['일정에서 이동까지.', '날짜별 일정과 동선, 대중교통 이동 후보, 역 시설 정보를 함께 확인할 수 있습니다. 짐 관련 정보를 살펴보고 친구와 만날 장소를 정하는 기능도 담았습니다.'],
      ['1주일, 그리고 배포까지.', '팀장으로 백엔드·AI·서버 개발을 담당했습니다. DIVE 2026에서 발제사 2등상을 수상했고, 현재 부산교통공사의 지원을 받아 배포 중입니다.'],
      ['데이터를 조회하고, AI로 설명합니다.', '경로·시설·장소 정보를 서버의 데이터와 도구로 조회하고, 언어 모델이 이를 설명하는 구조입니다. 모델 호출이 실패하면 규칙 기반 안내로 전환합니다.'],
      ['웹에서 Android까지.', 'React·TypeScript 웹과 Kotlin WebView 앱이 같은 서비스를 이용합니다. Java·Spring Boot API와 MySQL, Python 데이터 처리, GitHub Actions 배포로 구성되어 있습니다. Google Play 출시 절차를 진행하고 있습니다.']
    ],
    links: [['서비스 열기', 'https://galmegi.com'], ['개발단 소개', 'https://dev.galmegi.com/#travel']], verifiedRole: true
  },
  {
    id: 'joongo-notify', title: 'joongo_notify', english: 'FIND THE RIGHT ONE.', category: 'ai', type: 'LOCAL LLM · VISION · AUTOMATION', summary: '중고 매물의 본문과 사진에서 원하는 상태를 찾는 실험.', color: 'purple',
    status: 'AI 서비스 프로젝트', stack: ['Python', 'Local LLM', 'Vision-Language', 'Ollama'],
    intro: '모델명과 가격만으로는 알 수 없는 것들이 있습니다. 번인, 흠집, 배터리 상태. 중고 매물의 본문과 사진에 흩어진 조건을 함께 읽는 프로젝트입니다.',
    facts: [['핵심 흐름', '수집 → 조건 추출 → 매칭'], ['모델 활용', '로컬 LLM · 선택적 VL'], ['결과 확인', '웹 대시보드']],
    sections: [['문장에서 조건으로.', '검색과 키워드로 후보를 좁힌 뒤, 본문에서 제품 상태를 추출합니다. 기본 휴리스틱에 로컬 LLM 분석을 선택적으로 더할 수 있습니다.'], ['본문과 사진을 함께.', 'Vision-Language 모델로 사진 속 상태를 선택적으로 분석합니다. 본문과 사진의 판정이 다르면 차이를 표시하고, 최종 판단은 사용자에게 맡깁니다.'], ['한눈에 확인하는 후보.', '조건에 맞는 매물과 판정 결과를 웹 대시보드에서 함께 확인할 수 있습니다.']],
    links: [['GitHub', 'https://github.com/monitor5/joongo_notify']], verifiedRole: false
  },
  {
    id: 'tapo', title: 'Tapo Control', english: 'POWER, FROM ANYWHERE.', category: 'backend', type: 'BACKEND · HOMELAB · CONTROL', summary: '함께 쓰는 워크스테이션의 전원을 원격으로 관리하기.', color: 'green',
    status: '홈랩과 연결된 소프트웨어', stack: ['FastAPI', 'SQLite', 'Docker', 'Nginx'],
    intro: '친구와 함께 쓰는 원격 개발 환경에는 컴퓨터가 꺼졌을 때 다시 켤 방법도 필요했습니다. 스마트 플러그와 서버를 연결하는 전원 관리 애플리케이션입니다.',
    facts: [['대상', 'Tapo 스마트 플러그'], ['구성', 'FastAPI · SQLite'], ['운영 환경', 'NAS · Docker · Nginx']],
    sections: [['서버가 꺼지면, 누가 켤까.', '군 복무 중 TR 2990WX, NAS, 스마트 플러그로 친구와 공유하는 원격 개발 환경을 운영했습니다. 원격 전원 관리는 그 환경에서 필요했던 기능입니다.'], ['함께 쓰는 장비의 권한.', '사용자 인증과 역할, 플러그별 접근 권한을 관리합니다. 사용 예약과 상태 확인 기능도 갖추고 있습니다.'], ['홈랩에 맞춘 구성.', 'FastAPI와 SQLite를 Docker Compose로 구성하고, Nginx와 NAS의 역방향 프록시를 연결합니다.']],
    links: [['GitHub', 'https://github.com/monitor5/Tapo-Multi-User-Control-']], verifiedRole: false
  },
  {
    id: 'rpsms', title: 'RPSMS', english: 'LESS PAPER. MORE FLOW.', category: 'backend', type: 'FULL STACK · OPERATIONS', summary: '수리 접수부터 현황 확인까지 연결하는 업무 도구.', color: 'orange',
    status: '수리점 접수·현황 관리', stack: ['React', 'FastAPI', 'SQLite', 'Socket.IO', 'Docker'],
    intro: '수리 접수와 상태 확인, 출력과 내보내기를 하나의 웹 애플리케이션에서 다루는 프로젝트입니다.',
    facts: [['업무', '수리 접수 · 상태 관리'], ['동기화', 'Socket.IO'], ['배포 구성', '웹·API 단일 Docker 이미지']],
    sections: [['접수부터 현황 확인까지.', '접수 데이터를 등록·조회·수정·삭제하고, 상태 변경을 실시간으로 갱신합니다. 검색과 필터, 출력과 내보내기로 후속 업무를 이어갑니다.'], ['하나의 배포 단위.', 'FastAPI가 React 빌드 결과를 제공하며, 웹과 API를 하나의 Docker 이미지로 묶습니다. 데이터베이스는 SQLite를 사용합니다.']],
    links: [['GitHub', 'https://github.com/monitor5/RPSMS']], verifiedRole: false
  },
  {
    id: 'bium', title: 'BIUM', english: 'A LITTLE ROOM TO THINK.', category: 'ai', type: 'LOCAL AI · DESKTOP · HACKATHON', summary: '동일 파일과 유사 문서를 찾아 디지털 공간을 정리하는 도구.', color: 'violet',
    status: 'CHIC 해커톤 프로젝트', stack: ['Electron', 'Apache Tika', 'SBERT', 'JavaScript'],
    intro: '파일과 사진, 클라우드에 흩어진 데이터에서 중복과 유사 항목을 찾아 정리를 돕는 데스크톱 프로젝트입니다.',
    facts: [['인터페이스', '메뉴바 · 데스크톱'], ['문서 분석', 'Tika · SBERT'], ['판정', '동일 파일 · 유사 후보']],
    sections: [['같은 파일, 비슷한 문서.', '해시로 동일 파일을, 지각 해시로 유사 사진을 찾습니다. 문서는 텍스트를 추출한 뒤 로컬 임베딩으로 유사도를 분석합니다.'], ['무엇을 남길지는 사용자가.', '정리 후보를 묶어 보여주고, 사용자가 남길 위치를 선택합니다.']],
    links: [['GitHub', 'https://github.com/dlwldn4824/BIUM']], verifiedRole: false
  },
  {
    id: 'burn-in', title: 'OLED Uniformity', english: 'LOOK CLOSER.', category: 'ai', type: 'HARDWARE · COMPUTER VISION', summary: '카메라로 화면의 밝기 편차를 측정하는 실험.', color: 'pink',
    status: '연구·실험 단계', stack: ['Kotlin', 'Camera2', 'Image Alignment'],
    intro: '별도 Android 카메라로 OLED 화면의 위치별 밝기 편차를 살펴보고, 출력 감쇠로 시각적 균일도를 개선할 가능성을 탐구합니다.',
    facts: [['측정', 'Android 카메라'], ['핵심', '촬영 · 정합 · 보정맵'], ['범위', '밝기 편차 연구']],
    sections: [['카메라로 화면을 측정하기.', '노출을 제어하며 여러 프레임을 분석하고, 마커와 호모그래피로 위치를 정합합니다. 보정맵을 생성한 뒤 반복 측정하는 실험입니다.'], ['밝기 편차를 줄이는 접근.', '밝은 영역의 출력을 낮춰 시각적 균일도를 개선할 가능성을 탐구합니다. OLED의 물리적 열화를 복구하는 기술이나 제조사의 공식 수리 도구는 아닙니다.']],
    links: [['GitHub', 'https://github.com/monitor5/burn-in-fixer']], verifiedRole: false
  }
];

export const hardware = [
  { id:'threadripper', name:'Threadripper 2990WX', short:'2990WX', number:'4', unit:'YEARS', label:'4년 사용', kind:'WORKSTATION / REMOTE DEVELOPMENT', title:'함께 보낸 4년.', intro:'4년 동안 사용한 TR 2990WX. 군 복무 중에는 NAS와 스마트 플러그를 연결해 친구와 함께 쓰는 원격 개발 환경으로 활용했습니다.', sections:[['서버는 집에. 개발은 원격으로.', '군 복무 중에도 집의 TR 2990WX에 접속해 개발했습니다. NAS와 스마트 플러그를 연결하고, 친구와 환경을 공유했습니다.'],['4년 동안 곁에 둔 장비.', '직접 구성한 환경을 오래 쓰면서, 소프트웨어가 돌아가는 서버에도 자연스럽게 관심이 깊어졌습니다. TR 2990WX는 그 4년을 함께한 장비입니다.']], related:'tapo' },
  { id:'epyc', name:'Dual EPYC 7452', short:'EPYC × 2', number:'4', unit:'MONTHS', label:'4개월 사용', kind:'HOME SERVER / AI EXPERIMENTS', title:'궁금해서, 듀얼 EPYC.', intro:'“CPU 메모리 대역폭을 늘리면 AI를 어디까지 돌릴 수 있을까?” 직접 확인하려고 듀얼 EPYC 서버를 집에 구축했습니다.', sections:[['가설을 실제 장비로.', 'CPU 메모리를 여러 채널로 활용하면 보급형 GPU 성능에 다가갈 수 있지 않을까. 이 생각으로 EPYC 7452 듀얼 CPU와 RAM 240GB 환경을 구성해 친구와 나눠 썼습니다.'],['4개월, 그리고 전기요금.', '집에서 서버를 쓰니 성능뿐 아니라 발열, 소음, 전력과 비용도 체감했습니다. 한 달 전기요금 48만 원은 그중 가장 선명하게 남은 교훈입니다.'],['가설과 결과는 구분합니다.', 'GPU와 동등한 성능을 달성한 사례는 아닙니다. 장비를 직접 구성하고 사용하며 가설을 확인하려 했던 실험입니다.']] },
  { id:'bc250', name:'AMD BC-250', short:'BC-250', number:'2', unit:'BOARDS', label:'두 대 구매', kind:'HARDWARE / EXPLORATION', title:'한 대도 아니고, 두 대.', intro:'특이한 하드웨어를 보면 직접 만져보고 싶어집니다. BC-250은 두 대를 구입했습니다.', sections:[['사양표 다음은 실물.', '궁금한 장비를 직접 구해 보는 것도 제 관심사의 일부입니다. BC-250 두 대의 구매 기록도 이곳에 남깁니다.']] },
  { id:'nas', name:'Custom NAS', short:'SELF-HOSTED', number:'DIY', unit:'STORAGE', label:'직접 구축', kind:'STORAGE / HOMELAB', title:'내 저장소는 직접 만들기로.', intro:'자작 NAS를 구성하고, 원격 개발 환경에서도 NAS를 활용했습니다.', sections:[['저장 환경을 직접 구성하기.', '라즈베리 파이 파일 서버부터 자작 NAS까지, 필요로 하는 환경을 직접 만들며 배웠습니다. 군 복무 중에는 워크스테이션·NAS·스마트 플러그를 연결한 공유 개발 환경을 운영했습니다.']] },
  { id:'laptop', name:'Modified Laptop', short:'THERMAL MOD', number:'MOD', unit:'ENCLOSURE / COOLING', label:'케이스·냉각 개조', kind:'HARDWARE / PHYSICAL MODIFICATION', title:'케이스를 열면, 바꿀 게 보입니다.', intro:'노트북의 케이스와 냉각 솔루션을 직접 개조했습니다. 코드가 돌아가는 기계의 구조까지 관심이 이어집니다.', sections:[['기계의 안쪽까지.', '일체형 PC의 방열 구조를 바꾸고 VM을 돌리던 때부터, 노트북의 케이스와 냉각 솔루션을 손보기까지. 직접 뜯고 바꾸면서 기계를 배워 왔습니다.']] },
  {
    id:'smart-mirror', name:'Smart Mirror', short:'SMART MIRROR', number:'WHY', unit:'ALWAYS ON', label:'고교 창의융합학술프로젝트', kind:'HARDWARE / SOFTWARE / EFFICIENCY',
    title:'잘 돌아가는데, 굳이 어셈블리까지.',
    intro:'스마트미러는 이미 작동했습니다. 그런데 거울 하나를 위해 노트북을 24시간 켜 두는 게 계속 걸렸습니다. 그 질문이 OS를 바꾸고 어셈블리어까지 손대게 했습니다.',
    sections:[
      ['이미 작동했던 스마트미러.', '고등학교 창의융합학술프로젝트에서 조장을 맡아 전체 과정을 설계하고, 주로 소프트웨어를 담당했습니다. 개조한 노트북에 Linux를 설치하고 MagicMirror 프로젝트를 수정해 스마트미러를 구현했습니다.'],
      ['24시간 켜 둘 기계라면.', '결과물은 잘 작동했지만, 노트북을 상시 켜 두는 방식이 기기의 목적에 맞는지 의문이 들었습니다. 전력 사용과 실행 환경을 더 가볍게 만들 방법을 고민하며 가벼운 Linux 기반 OS를 설치했습니다.'],
      ['어셈블리까지 내려가다, 막혔습니다.', '더 낮은 수준에서 직접 구현하면 필요한 자원을 줄일 수 있지 않을까. 그 가설로 스마트미러 프로그램을 어셈블리어로 만들어 보려 했습니다. 당시에는 언어에 대한 이해가 부족했고, 구현에 실패했습니다.'],
      ['최종 구현은 JavaScript로.', '스마트미러는 결국 JavaScript 기반으로 구현했습니다. 이 과정에서 언어마다 다른 실행 방식과 임베디드 기기 설계의 제약을 접했습니다. 돌아가는 화면을 만든 뒤에도, 그 화면을 계속 켜 둘 기계의 조건까지 따져 보게 된 경험입니다.']
    ]
  }
];
