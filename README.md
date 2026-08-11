# Jee-Hyun NAM — 개인 홈페이지 (자체 호스팅)

Wix로 만들었던 [skyish.wixsite.com/mysite](https://skyish.wixsite.com/mysite) 사이트를
**Wix 없이 어디서나 직접 운영**할 수 있는 순수 정적 사이트로 다시 만든 버전입니다.

- 빌드 도구·서버·데이터베이스 **불필요** — HTML/CSS/JS 파일뿐
- 어느 웹호스트에나 올리거나, `index.html`을 더블클릭해서 바로 열 수 있음
- 원본 사진(흑백 거리 사진)과 내용을 그대로 포함, 오타 수정 및 모바일 반응형·접근성 개선

---

## 1. 폴더 구조

```
20260712_hompage작성/
├─ index.html        # HOME (히어로 + 소개)
├─ about.html        # ABOUT (소개글 · 학력 · 경력)
├─ works.html        # WORKS (작업/연구 — 카드 템플릿)
├─ pictures.html     # GALLERY (사진 갤러리 + 라이트박스)
├─ blog.html         # BLOG (게시물 + 카테고리 필터)
├─ contact.html      # CONTACT (연락처 + 문의 폼)
├─ assets/
│  ├─ css/style.css  # 전체 디자인 (색·폰트·레이아웃)
│  ├─ js/main.js     # 공통 헤더/푸터 · 메뉴 · 갤러리 · 폼 등
│  └─ img/           # 이미지 (hero, gallery 아이콘, banner 등)
└─ README.md         # 이 파일
```

---

## 2. 미리보기 (로컬)

**가장 간단한 방법:** `index.html` 파일을 더블클릭하면 브라우저에서 바로 열립니다.

**권장 방법(로컬 서버):** 일부 브라우저는 파일 직접 열기에서 제약이 있어, 간단한 로컬 서버를 띄우면 실제 환경과 똑같이 보입니다. 이 폴더에서:

```bash
# 파이썬이 있으면
python -m http.server 8000
# 그다음 브라우저에서 http://localhost:8000 접속
```

---

## 3. 인터넷에 올리기 (무료 호스팅)

이 사이트는 정적 파일이라 아래 어디든 이 폴더를 그대로 올리면 됩니다.

| 서비스 | 방법 | 비용 |
|--------|------|------|
| **Netlify** | netlify.com → "Add new site" → 이 폴더를 드래그&드롭 | 무료 |
| **Cloudflare Pages** | 폴더 업로드 또는 GitHub 연결 | 무료 |
| **GitHub Pages** | 저장소에 올리고 Settings → Pages 활성화 | 무료 |
| **일반 웹호스팅 / 카페24 등** | FTP로 폴더 전체 업로드 | 요금제에 따름 |

> 개인 도메인(예: `namjeehyun.com`)이 있으면 위 서비스에 연결할 수 있습니다.

---

## 4. 내용 수정하기

### 글 · 문구
각 `.html` 파일을 메모장이나 [VS Code](https://code.visualstudio.com/) 같은 편집기로 열어
글자만 바꾸면 됩니다. 예를 들어 소개글은 `about.html`, 연락처는 `contact.html`에 있습니다.

### 메뉴 · 이름 · 연락처 (한 곳에서)
헤더/푸터는 모든 페이지가 **공유**합니다. `assets/js/main.js` 맨 위의 `SITE` 부분만 고치면
6개 페이지에 한 번에 반영됩니다.

```js
var SITE = {
  brand: "Jee-Hyun NAM",              // 사이트 이름(로고)
  tagline: "Architecture · Urban Design",
  nav: [ { label: "HOME", file: "index.html" }, ... ],  // 메뉴
  email: "whlove@gmail.com",
  org:   "Gyeonggi Research Institute"
};
```

### 사진 교체 · 추가
1. 새 이미지를 `assets/img/` 폴더에 넣습니다.
2. 갤러리라면 `pictures.html`에 아래 형태로 추가하면 자동으로 확대(라이트박스)까지 적용됩니다.
   ```html
   <figure>
     <img src="assets/img/새파일.jpg" alt="설명">
     <figcaption>캡션</figcaption>
   </figure>
   ```
3. WORKS 카드의 이미지는 `works.html`의 `<div class="work-card__media">` 안에
   `<img src="assets/img/새파일.jpg" alt="설명">`를 넣으면 됩니다.

### 블로그 글 추가
`blog.html`에서 `<article class="post"> ... </article>` 블록을 복사해 제목·날짜·본문을 바꾸고,
`data-cats`에 카테고리 키(`arch`, `urban`, `future`, `dream`, `daily`)를 지정하세요.

### 색 · 폰트
`assets/css/style.css` 맨 위 `:root` 안의 값만 바꾸면 사이트 전체 톤이 바뀝니다.
```css
--teal: #4f9d92;   /* 포인트 색 */
--paper: #f6f4f1;  /* 배경색 */
```

---

## 5. 문의 폼 동작 방식

CONTACT의 문의 폼은 **서버 없이** 동작합니다. 방문자가 **Send**를 누르면 방문자의
메일 앱이 열리고, 입력한 내용이 자동으로 채워져 `whlove@gmail.com`으로 보낼 준비가 됩니다.

> 방문자가 폼에서 바로(메일 앱을 열지 않고) 전송하게 하려면
> [Formspree](https://formspree.io) 같은 무료 서비스를 연결할 수 있습니다. 필요하면 알려주세요.

---

## 6. 참고 사항

- **폰트**는 Google Fonts(`Anton`, `Noto Sans KR`)를 불러옵니다. 인터넷이 연결된 환경에서
  가장 잘 보이며, 완전 오프라인 전용으로 쓰려면 폰트 파일을 내려받아 self-host 할 수 있습니다.
- 현재 사이트는 원본 Wix에서 접근 가능했던 **거리 사진 2장**(`hero.jpg`, `pictures-banner.jpg`)을
  여러 페이지에서 나눠 쓰고 있습니다. 갤러리·작업 페이지에 **본인 사진을 추가**하면 훨씬 풍성해집니다.
- `assets/img/portrait.jpg`는 임시로 거리 사진을 넣어 두었습니다. 본인 프로필 사진으로
  같은 파일명으로 교체하면 ABOUT 페이지에 반영됩니다.
- 원본에 있던 기본 SNS 링크(Wix 데모용)는 실제 계정이 아니어서 제외했습니다. 본인의
  인스타그램 등이 있으면 `contact.html`의 주석 안내대로 추가하세요.
- WORKS·GALLERY의 일부 카드는 채워 넣을 수 있는 **템플릿**입니다.

문의: whlove@gmail.com
