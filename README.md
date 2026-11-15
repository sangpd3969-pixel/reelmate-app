# ReelMate (시제품)

사진·짧은 영상을 AI가 분석해 인스타 릴스 / 페이스북 스토리 / 유튜브 숏츠를 자동으로 만드는 앱의 클릭형 시제품입니다.

- 화면 디자인: Google Stitch (`DESIGN.md` = 디자인 규칙)
- `screens/` 화면 13개, `nav.js` 화면 연결
- `reel.js` 휴대폰 저장(IndexedDB) + 휴대폰 안에서 릴스 영상 만들기(서버 없음, 사진이 휴대폰 밖으로 나가지 않음)
- 설치형 웹앱(PWA): `manifest.json`, `sw.js`

휴대폰 설치: https://sangpd3969-pixel.github.io/reelmate-app/ 접속 후
- 안드로이드(크롬): 메뉴 ⋮ → "앱 설치" 또는 "홈 화면에 추가"
- 아이폰(사파리): 공유 버튼 → "홈 화면에 추가"
