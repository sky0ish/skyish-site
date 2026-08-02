# 배포 안내 — skyish.kr

정적 사이트입니다. GitHub `main` 에 푸시하면 Netlify 가 자동으로 빌드·배포합니다.

```
GitHub(sky0ish/skyish-site) ──push──▶ Netlify ──빌드──▶ skyish.kr
                                        │
                                        └ node tools/build-posts.mjs
                                          (content/blog/*.md → assets/data/posts.js)
```

---

## 현재 상태

**Netlify 프로젝트: `skyish` / 주소: <https://skyish.kr>**
(초기에 만든 `spectacular-capybara-6d4360` 프로젝트는 삭제했습니다. 한 저장소에 사이트가 둘이면
푸시 한 번에 빌드가 두 번 돌아 크레딧이 두 배로 소모됩니다.)

| 단계 | 상태 |
|---|---|
| Netlify 연결·자동 배포 | ✅ 완료 |
| skyish.kr 도메인 + HTTPS | ✅ 완료 |
| 빌드 (`node tools/build-posts.mjs`) | ✅ 정상 |
| `/admin` CMS 화면 | ✅ 열림 (로그인 버튼까지) |
| **GitHub 로그인 키 등록** | ⬜ **남음 — 아래 1번** |

### ⚠️ 배포 일시 중지 중 (크레딧 소진)

Netlify 팀 크레딧을 모두 써서 **production 배포가 일시 중지**된 상태입니다.
사이트는 계속 살아 있고, 새 커밋만 `Skipped — account credit usage exceeded` 로 넘어갑니다.

**크레딧이 리셋되면 (좌측 하단 아바타 → Billing 에서 날짜 확인)**

1. 로컬에서 `git push origin main`
2. Netlify → **Deploys → `Trigger deploy` ▾ → `Deploy site`** 를 **한 번** 클릭
   (Skipped 된 배포는 자동으로 다시 시도되지 않습니다)

**크레딧을 아끼려면** — 수정할 때마다 푸시하지 말고 여러 건을 모아 한 번에 푸시합니다.
푸시 1회 = 빌드 1회입니다.

---

## 1. 글쓰기 로그인 켜기 ← 이것만 하면 글을 쓸 수 있습니다

블로그 글쓰기는 `/admin/` 에서 GitHub 계정으로 로그인해 사용합니다.
(Netlify Git Gateway 는 2026년 기준 deprecated 라 쓰지 않고, 사이트 안의 함수로 직접 처리합니다.)

### 1-1. GitHub OAuth 앱 만들기

<https://github.com/settings/developers> → **OAuth Apps** → **New OAuth App**

| 항목 | 입력값 |
|---|---|
| Application name | `skyish CMS` |
| Homepage URL | `https://skyish.kr` |
| Authorization callback URL | `https://skyish.kr/callback` |

**Register application** → **Client ID** 복사 → **Generate a new client secret** → **Client secret** 복사
(secret 은 화면을 벗어나면 다시 볼 수 없습니다. 저에게 보내지 마세요.)

### 1-2. Netlify 환경변수 등록

Netlify → **Site configuration → Environment variables → Add a variable**

| Key | Value |
|---|---|
| `GITHUB_CLIENT_ID` | 복사한 Client ID |
| `GITHUB_CLIENT_SECRET` | 복사한 Client secret |

저장 후 **Deploys → Trigger deploy → Clear cache and deploy site** 한 번 실행.

### 1-3. 확인

<https://skyish.kr/admin/> → **GitHub 로 로그인** → 글 목록이 보이면 완료.

## 2. 도메인 연결 (skyish.kr) — ✅ 완료

가비아 DNS 에 아래 두 줄이 등록되어 있고, Netlify 가 HTTPS 인증서를 발급한 상태입니다.

| 타입 | 호스트 | 값 |
|---|---|---|
| A | `@` | `75.2.60.5` |
| CNAME | `www` | (Netlify 가 안내한 사이트 주소, 끝에 점) |

`www.skyish.kr` 은 `skyish.kr` 로 301 리다이렉트됩니다.

---

## 글 쓰는 방법

1. `/admin/` 접속 → **GitHub 로 로그인**
2. 왼쪽 **블로그** → 우측 상단 **New 글**
3. 제목·날짜·분류·한 줄 요약·본문 작성
   - 사진은 본문 툴바의 **이미지** 버튼으로 넣습니다 (대표 사진 칸도 따로 있습니다)
4. **Publish** → GitHub 에 커밋 → 1~2분 뒤 사이트 반영

글 원본은 `content/blog/*.md`, 사진은 `assets/img/blog/` 에 저장됩니다.
목록 페이지(`blog.html`)는 배포할 때 `tools/build-posts.mjs` 가 자동으로 다시 만듭니다.

인터넷 없이 초안만 잡고 싶을 때는 `blog-write.html` (블로그 페이지의 **오프라인 글쓰기** 버튼)을 쓰세요.

## 로컬에서 확인하기

```
python preview_server.py 8123
```

블로그 목록을 로컬에서 갱신하려면:

```
node tools/build-posts.mjs
```
