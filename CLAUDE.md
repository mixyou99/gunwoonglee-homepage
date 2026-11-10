# gunwoonglee.com 운영 규칙 (Claude용)

이건웅 교수 공식 연구자 홈페이지 저장소. Claude가 주 관리자로서 콘텐츠 업데이트·유지보수·배포를 맡는다.

## 구조
- 호스팅: GitHub Pages, `main` 브랜치 `/ (root)`에서 배포. 커스텀 도메인 `www.gunwoonglee.com` (`CNAME` 파일 — 지우지 말 것), HTTPS 적용.
- DNS: Cloudflare (DNS only). `bot` 등 홈페이지와 무관한 레코드는 건드리지 않는다. 도메인 등록은 Namecheap.
- 콘텐츠 원본: `data/content.json` (About/CV/Research/Teaching/Contact/Story) + `data/news.json`, `data/lab.json`, `data/media.json`, `data/publications.json` (교수님이 Decap CMS `admin/index.html`에서 직접 편집 가능한 범위, `admin/config.yml`에 정의). `node tools/build.js`가 이 파일들을 합쳐 `index.html`의 `<!-- DATA:섹션:START/END -->` 사이를 다시 만든다. 그 구간을 `index.html`에서 직접 고치지 말 것 (다음 빌드에서 덮어써짐).
- 마커 밖(Hero, 내비게이션)과 디자인은 `index.html`, `css/style.css`, `js/main.js`를 직접 수정.
- CMS: `admin/index.html` + `admin/config.yml` (Decap CMS, GitHub OAuth, `editorial_workflow` — 저장 시 바로 main에 반영되지 않고 별도 브랜치+PR 생성, 교수님이 GitHub에서 Merge해야 반영됨). 편집 가능 범위는 News, Lab 멤버 소개, Media(언론 보도), Publications(논문 목록) 네 가지로 제한되어 있다.
- 로컬 관리자 도구(보조): `admin.html` + `tools/admin-server.js` (`start-admin.command`로 Mac에서 실행, 127.0.0.1:3000 전용, 다섯 데이터 파일 전체를 다룸). 공개 사이트에는 `_config.yml`의 `exclude`로 빠져 있다. 새로 추가하는 내부용 파일도 `exclude`에 넣는다.

## 작업 절차
1. 최신 `main`에서 작업 브랜치(`claude/...`)를 만든다.
2. `data/content.json` 수정 → `node tools/build.js` → diff 확인.
3. 데스크톱·모바일 미리보기 화면을 교수님께 보여 드린다.
4. **교수님 승인 후에만** `main`에 반영한다. 승인 없이 `main`에 push하지 않는다.
5. 반영 후 실제 사이트(https://www.gunwoonglee.com)에서 확인. 문제 시 `git revert`로 되돌린다.

## 콘텐츠 원칙
- 논문·CV·강의·연구실 정보는 교수님이 준 자료(최신 CV 등)에 있는 내용만 반영한다. 지어내지 않는다.
  - Publications는 교수님이 CMS(`admin/index.html`)에서 직접 순서(`order`)·내용을 수정할 수 있다 — 교수님 본인이 입력하는 경우이므로 이 원칙(지어내지 않기)의 예외가 아니라 교수님이 직접 데이터를 관리하는 정상적인 경로다. Claude가 대신 논문 내용을 수정/추가할 때는 여전히 교수님이 준 자료에 있는 내용만 반영한다.
- 심사 중(R&R / Under Review / Working) 논문의 공개 범위는 교수님이 정한다.
- 학생 개인정보는 교수님이 승인한 범위만 게시한다.
