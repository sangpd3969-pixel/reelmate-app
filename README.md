# ReelMate (시제품)

사진·짧은 영상을 AI가 분석해 인스타 릴스 / 페이스북 스토리 / 유튜브 숏츠를 자동으로 만드는 앱의 클릭형 시제품입니다.

- 화면 디자인: Google Stitch (`DESIGN.md` = 디자인 규칙)
- `screens/` 화면 13개, `nav.js` 화면 연결
- `reel.js` 휴대폰 저장(IndexedDB) + 휴대폰 안에서 릴스 영상 만들기(서버 없음, 사진이 휴대폰 밖으로 나가지 않음)
- 설치형 웹앱(PWA): `manifest.json`, `sw.js`

휴대폰 설치: https://sangpd3969-pixel.github.io/reelmate-app/ 접속 후
- 안드로이드(크롬): 메뉴 ⋮ → "앱 설치" 또는 "홈 화면에 추가"
- 아이폰(사파리): 공유 버튼 → "홈 화면에 추가"

## AI (Claude Opus 5.5)
- `apps-script/Code.gs`: Google Apps Script 중계 서버 (현재 사용). API 키·접속 코드는 스크립트 속성에만 저장 (코드에 없음)
- `worker/worker.js`: Cloudflare Worker 버전 (예비)
- `config.js`의 `AI_ENDPOINT` = 중계 서버 주소
- 지인은 '내 정보'에서 접속 코드 입력 (또는 링크 끝에 `?code=코드`)

## 사진 보정·구도 (요청 → AI → 휴대폰에서 적용)
- 사용자가 색감·구도·속도 요청을 적으면 Claude Opus 5.5가 사진별 보정값(밝기·대비·채도·색온도·노출·비네팅·선명도), 구도(9:16 채우기/전체보기, 중심점, 줌), 영상 속도·자막 위치를 정함
- `edit.js`가 휴대폰 안에서 적용 (사진은 저장 서버로 가지 않음)
- 오픈소스: `vendor/glfx.js` (WebGL 색보정, MIT), `vendor/smartcrop.js` (9:16 자동 구도, MIT)
- AI 연결 실패 시 기본 자막으로 만들지 않고 '다시 시도' 화면 표시
