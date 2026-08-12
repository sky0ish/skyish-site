# 배포 안내 — skyish.kr

정적 사이트입니다. **GitHub Pages** 가 `main` 브랜치를 그대로 서빙합니다.
빌드 단계가 없어서 **푸시하면 곧바로 반영**되고, 배포 횟수 제한이나 추가 비용이 없습니다.

```
로컬 작업 ──push──▶ GitHub(sky0ish/skyish-site) ──▶ GitHub Pages ──▶ skyish.kr
```

같은 계정의 `sky0ish/utokyo-kr`(u-tokyo.kr) 과 동일한 방식입니다.

---

## 최초 설정 (한 번만)

### 1. 저장소를 공개로 전환

GitHub Pages 는 **무료 플랜에서 공개 저장소만** 서빙합니다.
(비공개로 두려면 GitHub Pro $4/월이 필요하고, 그래도 *사이트 자체*는 공개됩니다.)

<https://github.com/sky0ish/skyish-site/settings> → 맨 아래 **Danger Zone**
→ **Change repository visibility** → **Change to public**

> 공개 전 점검 완료: 전화번호는 커밋 이력에서 제거했고(2026.08), API 키·토큰은 없습니다.
> 여행 원본 PDF·상장 원본·출장 자료는 `.gitignore` 로 제외되어 올라가지 않습니다.

### 2. Pages 켜기

Settings → **Pages**
- **Source**: `Deploy from a branch`
- **Branch**: `main` / `/ (root)`
- Save

저장소에 `CNAME`(skyish.kr) 과 `.nojekyll` 이 이미 들어 있어 추가 설정이 필요 없습니다.

### 3. 가비아 DNS 변경 (Netlify → GitHub Pages)

My가비아 → DNS 관리툴 → skyish.kr → **DNS 설정**

기존 Netlify 레코드(A `75.2.60.5`)를 지우고 아래로 교체합니다.

| 타입 | 호스트 | 값 |
|---|---|---|
| A | `@` | `185.199.108.153` |
| A | `@` | `185.199.109.153` |
| A | `@` | `185.199.110.153` |
| A | `@` | `185.199.111.153` |
| CNAME | `www` | `sky0ish.github.io.` ← **끝에 점(.)** |

반영에 10분~1시간. 그다음 Settings → Pages 에서 **Enforce HTTPS** 를 켭니다.

### 4. Netlify 정리

DNS 가 GitHub 로 넘어간 것을 확인한 뒤, Netlify 의 `skyish` 프로젝트를 삭제합니다.
(크레딧 소진으로 배포가 멈춰 있던 곳입니다.)

---

## 평소 작업 흐름

1. 로컬에서 수정 → `http://localhost:8123` 으로 확인
2. 블로그 글을 고쳤으면 목록 파일을 다시 생성

   ```
   node tools/build-posts.mjs
   ```

3. 커밋 후 `git push` → 1~2분 뒤 skyish.kr 에 반영

`assets/data/posts.js` 는 저장소에 포함돼 있어 GitHub 쪽 빌드가 필요 없습니다.
글 원본은 `content/blog/*.md`, 사진은 `assets/img/blog/` 입니다.

## 글 쓰는 방법

블로그 페이지의 **✎ 글쓰기** → 제목·본문 작성, 사진 첨부 → **내보내기**
→ 저장된 파일을 알려주시면 사이트에 반영합니다.

> `/admin` (Decap CMS) 은 로그인 처리에 서버가 필요해 GitHub Pages 에서는 동작하지 않습니다.
> 파일은 남겨 두었으니, Supabase Edge Function 으로 로그인만 붙이면 다시 쓸 수 있습니다.

## 로컬에서 확인하기

```
python preview_server.py 8123
```

지도는 `fetch()` 로 자료를 읽기 때문에 **파일을 더블클릭해서 열면 표시되지 않습니다.**
반드시 위 주소로 여세요.
