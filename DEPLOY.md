# 배포 안내 — skyish.kr

정적 사이트입니다. GitHub `main` 에 푸시하면 Netlify 가 자동으로 빌드·배포합니다.

```
GitHub(sky0ish/skyish-site) ──push──▶ Netlify ──빌드──▶ skyish.kr
                                        │
                                        └ node tools/build-posts.mjs
                                          (content/blog/*.md → assets/data/posts.js)
```

---

## 1. Netlify 에 사이트 연결 (최초 1회)

1. <https://app.netlify.com> 로그인
2. **Add new site → Import an existing project → GitHub**
3. 저장소 `sky0ish/skyish-site` 선택
4. 빌드 설정은 `netlify.toml` 에 이미 있으므로 **그대로 두고 Deploy**
   - Build command: `node tools/build-posts.mjs`
   - Publish directory: `.`
5. 배포가 끝나면 `무작위이름.netlify.app` 주소가 생깁니다 → **이 이름을 적어 두세요** (3번에서 씁니다)

## 2. 도메인 연결 (skyish.kr)

**Netlify** → Site configuration → **Domain management** → Add a domain → `skyish.kr`

그다음 **가비아 DNS 관리**에서 아래 두 줄을 등록합니다.

| 타입 | 호스트 | 값 |
|---|---|---|
| A | `@` | `75.2.60.5` |
| CNAME | `www` | `무작위이름.netlify.app.` ← **끝에 점(.)** |

> 정확한 A 레코드 값은 Netlify 의 Domain management 화면에 표시된 것을 우선하세요.
> DNS 반영에 보통 10분~1시간, 최대 하루가 걸립니다. 반영되면 Netlify 가 HTTPS 인증서를 자동 발급합니다.

## 3. 글쓰기(CMS) 로그인 설정

블로그 글쓰기는 `/admin/` 에서 하며, GitHub 계정으로 로그인합니다.
(Netlify Git Gateway 는 2026년 기준 deprecated 라 쓰지 않고, 우리 사이트의 함수로 직접 처리합니다.)

### 3-1. GitHub OAuth 앱 만들기

GitHub → 우측 상단 프로필 → **Settings** → 맨 아래 **Developer settings** → **OAuth Apps** → **New OAuth App**

| 항목 | 입력값 |
|---|---|
| Application name | `skyish.kr CMS` |
| Homepage URL | `https://skyish.kr` |
| Authorization callback URL | `https://skyish.kr/callback` |

만든 뒤 **Client ID** 를 복사하고, **Generate a new client secret** 을 눌러 **Client secret** 도 복사합니다.
(secret 은 이 화면을 벗어나면 다시 볼 수 없습니다.)

### 3-2. Netlify 환경변수 등록

Netlify → Site configuration → **Environment variables** → Add a variable

| Key | Value |
|---|---|
| `GITHUB_CLIENT_ID` | 복사한 Client ID |
| `GITHUB_CLIENT_SECRET` | 복사한 Client secret |

저장 후 **Deploys → Trigger deploy → Clear cache and deploy site** 를 한 번 실행합니다.

### 3-3. 확인

`https://skyish.kr/admin/` 접속 → **Login with GitHub** → 글 목록이 보이면 완료입니다.

> `skyish.kr` DNS 가 아직 연결되지 않았으면 로그인이 되지 않습니다. 2번을 먼저 끝내세요.

---

## 글 쓰는 방법

1. `https://skyish.kr/admin/` 접속
2. **블로그 → New 글**
3. 제목·날짜·분류·본문 작성, 사진은 본문 툴바의 이미지 버튼으로 삽입
4. **Publish** → GitHub 에 커밋되고 1~2분 뒤 사이트에 반영

글 원본은 `content/blog/*.md`, 사진은 `assets/img/blog/` 에 저장됩니다.

## 로컬에서 확인하기

```
python preview_server.py 8123
```

블로그 목록을 로컬에서 갱신하려면:

```
node tools/build-posts.mjs
```
