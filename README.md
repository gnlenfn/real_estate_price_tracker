# 집업 · ZIPUP

보유 부동산과 관심단지의 **가격 차액 변화**를 추적하는 개인용 반응형 웹앱입니다. Next.js App Router + Supabase(PostgreSQL/Auth), Vercel 배포를 기준으로 만들었습니다.

## 실행

```sh
npm install
cp .env.example .env.local
npm run dev
```

http://127.0.0.1:3000 에서 열립니다. 환경변수 없이도 **가상 가격이 명확히 표시된 데모**를 체험할 수 있습니다. '내 데이터로 시작'은 해당 브라우저의 localStorage에 기록하며 기기 간 공유되지 않습니다. 클라우드 계정에 로그인하면 그 계정의 데이터만 표시합니다.

## 로컬 Supabase 개발 환경

운영 Supabase와 분리해 개발하려면 OrbStack 또는 Docker Desktop을 실행한 뒤 아래 명령을 사용합니다.

```sh
npm install
npm run db:start
npm run dev
```

- 로컬 API: `http://127.0.0.1:54321`
- 로컬 Studio: `http://127.0.0.1:54323`
- 로컬 DB: `postgresql://postgres:postgres@127.0.0.1:54322/postgres`
- `supabase/migrations/`의 스키마가 첫 시작과 `npm run db:reset` 때 자동 적용됩니다.
- 로컬 로그인 화면의 **로컬 개발 계정으로 시작**을 누르면 운영 OAuth나 메일 없이 격리된 익명 개발 사용자가 만들어집니다.
- `.env.development.local`은 로컬 Supabase 주소와 키를 담고 Git에서 제외됩니다. 운영 값은 `.env.production.local`에 보관하며 Vercel에서는 프로젝트 환경변수를 사용합니다.
- 로컬에서 실데이터 검색까지 시험하려면 `MOLIT_API_KEY`와 `KAKAO_REST_API_KEY`를 `.env.development.local`에 넣습니다. 카카오 키는 로그인에 사용한 카카오 디벨로퍼스 앱의 REST API 키를 재사용할 수 있습니다.

중지할 때는 `npm run db:stop`, 로컬 DB를 초기화할 때만 `npm run db:reset`을 사용합니다. `db:reset`은 로컬 데이터만 삭제하며, `--linked` 옵션은 운영 DB에 영향을 줄 수 있으므로 사용하지 않습니다.

## Supabase 연결 (PC·모바일 동기화)

1. Supabase 프로젝트를 생성합니다.
2. SQL Editor에서 `supabase/schema.sql`을 한 번 실행합니다. 두 테이블과 사용자별 RLS 정책, 월별 실거래 원자적 교체 함수를 만듭니다.
3. Authentication에서 신규 사용자 가입을 허용하고 Google·Kakao 제공자를 연결합니다. 아래 소셜 로그인 설정을 참고하세요. 앱의 `/auth`에서 첫 소셜 로그인 시 가입됩니다.
4. Project Settings의 URL과 anon/publishable key를 `.env.local`의 `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`에 넣습니다. **service_role 키를 사용하지 마세요.**
5. 개발 서버를 재시작하고 앱에서 구글 또는 카카오로 로그인합니다. 모든 조회·쓰기에는 사용자별 RLS가 적용됩니다.

브라우저 기록은 로그인 시 자동 업로드되지 않습니다. 데모의 가상 가격이 실제 계정에 섞이지 않도록 분리합니다. 클라우드로 사용할 예정이면 로그인 후 단지와 기록을 추가하세요. 각 기기에서 페이지를 새로고침하면 최신 저장 내용을 불러옵니다.

### 서비스 시작 전 운영 DB 완전 초기화

운영 전 테스트 계정과 데이터를 모두 지우려면 Supabase SQL Editor에서 `supabase/production-reset.sql` 전체를 한 번 실행합니다. 이 스크립트는 `auth.users`와 집업의 단지·가격·닉네임·문의 데이터를 삭제하고 최신 스키마를 다시 생성합니다. 프로젝트 URL, API 키, Google·Kakao 제공자 설정은 유지됩니다. 실제 서비스 시작 후에는 사용하지 마세요.

## 국토교통부 실거래 API

- 신청: https://www.data.go.kr/data/15126469/openapi.do
- 서비스: 국토교통부 아파트 매매 실거래가 자료 (`RTMSDataSvcAptTrade`)
- 일반 인증키 **Decoding** 값을 서버 환경변수 `MOLIT_API_KEY`에 넣습니다. 브라우저에 키를 전달하지 않습니다.
- 등록 정보: 아파트명을 검색해 주소 후보를 선택하고 실거래에서 조회한 전용면적을 선택합니다. 주소에서 법정동과 조회용 시군구 코드를 자동으로 설정하고, 최근 거래에서 국토교통부 단지 식별값(`aptSeq`)을 찾아 저장합니다. 전용면적은 소수점 아래를 버려 정수 부분이 같은 거래를 합산합니다(59.1·59.99㎡ → 59㎡, 84.1·84.99㎡ → 84㎡). 정수 부분이 다른 면적은 별도로 등록합니다.
- 실거래 불러오기에서 기간을 지정하면 월별로 조회·저장합니다. 월별 전체 페이지를 가져오고 해제 거래를 제외합니다. 같은 달을 다시 조회하면 해당 단지·월의 API 자료만 트랜잭션으로 교체합니다. 수동 기록은 유지됩니다.
- 실제 국토교통부 서비스와의 종단 검증은 미완료입니다. 등록 키의 API 승인 상태를 확인하고 소량의 한 달 자료부터 검증하세요.
- Vercel 프로덕션 배포에서는 매주 월요일 오전 3시경(한국 시간, Hobby 플랜은 해당 시간대 안에서 실행)에 전체 사용자의 등록 단지를 자동 갱신합니다. 이번 달과 직전 달을 함께 다시 불러와 신고 지연과 해제 정정을 반영하며, 동일 시군구 자료는 한 번만 조회합니다. 과거 기간은 기존 버튼으로 수동 조회할 수 있습니다.
- 여러 해의 자료를 불러오면 브라우저를 열어 두세요. 일부 월 실패 시 이전에 완료된 월은 보존됩니다.

한국부동산원 R-ONE은 지역 통계·지수 보완용이며 현재 연동하지 않았습니다. 호가 조회와 입력 기능은 제공하지 않습니다.

## 계산 원칙

- 금액 저장 단위: 만 원. 입력·표시 단위: 억 원.
- 각 월의 가격 중앙값을 계산합니다. 관심단지는 실거래가만 사용하고 보유 주택은 실거래가 또는 직접 평가 중 하나를 선택합니다. 보유 주택에 실거래가가 없고 직접 평가가 있으면 직접 평가를 기본으로 제안합니다. 월 내 같은 종류의 기록이 여러 건이면 중앙값입니다.
- `간격 = 관심단지 중앙값 - 기준 부동산 중앙값`.
- 기간 변화는 **선택 기간 내 첫 비교 가능 월과 마지막 비교 가능 월**의 차이입니다. 실제 비교 월을 카드에 표시합니다.
- 자료가 없는 달은 값을 만들지 않고 다음 실제 값까지 선으로 연결합니다. 점은 실제 값이 있는 달에만 표시하며 0원과 미확인을 구분합니다.
- 세금, 대출잔액, 거래비용은 포함하지 않습니다. 층·향·동·상태를 통제한 감정가격은 아닙니다.
- 실거래를 수동으로 입력한 뒤 같은 거래를 API로 가져오면 별개 기록으로 남습니다. 중복 수동 기록은 삭제하세요.

## Vercel 배포

1. 저장소를 본인 GitHub에 올리고 Vercel에서 Import Project합니다. Framework Preset은 Next.js입니다.
2. 기존 환경변수에 `KAKAO_REST_API_KEY`, `SUPABASE_SECRET_KEY`, `CRON_SECRET`, `GITHUB_ISSUES_TOKEN`을 더해 Vercel Project Settings → Environment Variables에 등록합니다. `KAKAO_REST_API_KEY`는 카카오 디벨로퍼스 앱의 REST API 키이며 서버에서만 읽습니다. `SUPABASE_SECRET_KEY`는 Supabase Settings → API Keys의 서버 전용 secret key이며 브라우저에 노출하거나 `NEXT_PUBLIC_` 접두사를 붙이면 안 됩니다. `CRON_SECRET`은 16자 이상의 임의 문자열로 만듭니다. GitHub 토큰은 관리자가 문의를 개발 이슈로 전환할 때만 사용합니다.
3. 기존 프로젝트는 `supabase/migrations/`에서 아직 적용하지 않은 SQL을 시간순으로 실행합니다. 새 프로젝트에서 최신 `supabase/schema.sql`을 실행했다면 생략합니다.
4. Deploy를 실행합니다. Supabase Authentication URL Configuration의 Site URL을 배포 URL로 지정합니다. Cron은 프로덕션 배포에서만 동작합니다.
5. Vercel Settings → Cron Jobs에서 `/api/cron/trades`가 등록됐는지 확인합니다.
6. PC와 모바일에서 같은 Vercel 주소를 열고 동일한 개인 계정으로 로그인합니다.

### 구글·카카오 소셜 로그인 설정

앱은 `/auth`에서 **Google로 계속하기 / 카카오로 계속하기** 두 가지만 제공합니다. 첫 로그인 시 가입되고, 이후에는 동일 계정으로 기록을 불러옵니다. 이메일 가입·비밀번호 재설정 화면과 발송 코드는 제거했습니다. SMTP 설정이 필요하지 않으며 SQL 재실행도 필요하지 않습니다.

#### 공통: Supabase

1. Authentication → Sign In / Providers에서 신규 가입을 허용합니다.
2. URL Configuration의 Site URL을 개발 중에는 `http://localhost:3000`, 배포 후에는 실제 배포 주소로 지정합니다.
3. Redirect URLs에 다음을 추가합니다.
   - `http://localhost:3000/auth?mode=callback`
   - `http://127.0.0.1:3000/auth?mode=callback` (이 주소로 개발할 때)
   - `https://실제배포주소/auth?mode=callback`
4. Google·Kakao 제공자 화면에서 표시되는 **Callback URL**을 복사합니다. 일반적으로 `https://프로젝트ID.supabase.co/auth/v1/callback` 형태입니다. 이 주소를 각 소셜 서비스의 Redirect URI에 등록합니다. 위 앱 주소와는 용도가 다릅니다.
5. 소셜 전용으로 운영할 때 Email 제공자를 끌 수 있습니다. 기존 이메일 계정에 기록이 있다면 먼저 소셜 계정 연결·기록 접근을 확인하세요. 계정을 삭제하거나 다른 사용자에게 기록을 옮기지 않습니다.

#### Google

1. https://console.cloud.google.com/ 에서 프로젝트 생성 → Google Auth Platform에서 앱 이름·지원 이메일·대상 사용자·기본 프로필 권한 설정.
2. OAuth 클라이언트 생성: 유형은 **웹 애플리케이션**.
3. Authorized JavaScript origins에 실제 앱 origin(개발: `http://localhost:3000`)을 추가합니다.
4. Authorized redirect URIs에 **Supabase Callback URL**을 등록합니다.
5. 발급된 **Client ID, Client Secret**을 Supabase Google 제공자 설정에 넣고 활성화합니다.
6. 테스트 모드의 대상 사용자를 등록하고, 일반 사용자 공개 시 Google의 게시/검증 요구사항을 확인합니다.

공식 안내: https://supabase.com/docs/guides/auth/social-login/auth-google

#### Kakao

1. https://developers.kakao.com/ 에서 앱 생성 후 웹 서비스 도메인을 등록합니다.
2. 카카오 로그인을 활성화하고 Redirect URI에 **Supabase Callback URL**을 등록합니다.
3. **REST API 키**와 활성화한 **카카오 로그인 Client Secret**을 Supabase Kakao 설정에 입력합니다.
4. 카카오 동의항목의 닉네임, 이메일과 프로필 사진은 앱에서 요청하지 않습니다. 앱 안에서는 소셜 계정 이름과 무관한 고유 임의 닉네임을 생성합니다.
5. Supabase Kakao 설정의 **Allow users without an email**을 켜고 저장합니다. 이메일 없는 카카오 계정은 기존 구글 계정과 자동으로 연결되지 않으므로 기존 기록은 이전 로그인 계정으로 확인합니다.
5. 저장 후 앱에서 연결 상태 다시 확인을 누릅니다. 이메일 없는 계정도 사용자 UUID 기준으로 단지·거래 기록을 구분합니다.

공식 안내: https://supabase.com/docs/guides/auth/social-login/auth-kakao

**소셜 Client Secret은 Supabase 관리 화면에 저장합니다. `.env.local`의 `NEXT_PUBLIC_` 변수에 넣지 않습니다.** 기존 앱 환경변수 3개는 그대로 사용합니다.

앱은 `/api/auth/providers`를 통해 활성화 여부만 확인합니다. 미설정 제공자는 준비 중으로 표시하고 버튼을 비활성화합니다. 활성화 여부가 올바른 Redirect URI·Client Secret까지 보증하지는 않으므로, 설정 후 각 서비스에서 본인 계정으로 최종 로그인해야 합니다.

브라우저 SDK가 OAuth implicit flow의 세션을 저장하며 `/auth?mode=callback`에서 초기화를 마친 후 `/`로 돌아옵니다. 취소·만료·설정 오류는 로그인 화면에 표시됩니다. 임의의 외부 `next` 주소로 이동하지 않습니다.

Google과 Kakao가 서로 다른 Supabase 사용자로 생성될 수 있으므로 기존 기록은 이전에 쓰던 계정으로 접근합니다. 계정 통합/수동 연결 화면은 아직 없습니다. 기존 사용자·데이터는 그대로 유지됩니다.

GitHub 없이 CLI로 배포할 경우, 이 폴더에서 `npx vercel`로 계정을 연결하고 프로젝트를 만든 뒤 환경변수를 설정하고 `npx vercel --prod`로 배포할 수도 있습니다. 사용자 Vercel/Supabase 계정이 아직 준비되지 않아 현재 공개 배포는 수행하지 않았습니다. 영구 데이터는 Supabase에 저장되므로 Vercel 파일시스템을 저장소로 사용하지 않습니다.

## 검증

```sh
npm test
npm run build
```

월간·주간 중앙값, 차액, 누락 기간, 가격 기준 분리와 실거래 XML 파싱·취소 거래 필터를 테스트합니다. 사용자별 DB 격리는 실제 Supabase 프로젝트 구성 후 두 개의 테스트 계정으로 추가 확인해야 합니다.

### 아파트 주소 검색

카카오 Local API로 아파트명을 검색해 단지명과 도로명·지번 주소 후보를 보여줍니다. 선택한 주소에서 법정동 코드와 지번을 추출하고, 면적 조회 시 국토교통부 `aptSeq`를 자동 연결합니다. `KAKAO_REST_API_KEY`는 서버 전용 환경변수로 사용하며 `NEXT_PUBLIC_` 접두사를 붙이지 않습니다. 이름 검색을 사용할 수 없거나 결과가 없으면 카카오 우편번호 서비스의 주소 직접 찾기를 사용할 수 있습니다.

### 전용면적 선택

단지 추가·수정에서 아파트 후보를 선택하면 최근 12개월의 실거래 면적을 자동으로 조회합니다. 월별 요청은 최대 4개씩 동시에 처리합니다. 선택 주소의 법정동·지번을 먼저 사용하고, 찾은 `aptSeq`를 이후 조회의 우선 기준으로 저장합니다. 기존 단지는 `aptSeq`가 없어도 종전 단지명·법정동 비교로 조회합니다. 해제 거래는 제외하며, 면적 선택과 거래 매칭 모두 소수점 아래를 버린 정수 부분을 사용하고 거래 메모에는 원래 면적을 보존합니다. 월별 지역 자료는 서버에서 1시간 캐시하며 조회는 가격 기록을 저장하지 않습니다.

### 실거래 일괄 조회

실거래 불러오기에서 전체 관심단지(기본값), 보유+관심단지 전체, 개별 단지를 선택할 수 있습니다. 기간은 올해 1월부터 이번 달이 기본값입니다. 단지·월별 요청을 최대 4개씩 동시에 실행·저장하고 일부 실패가 있어도 나머지를 계속 진행합니다. 결과에 단지별 건수와 실패 월이 표시되며 실패 월만 개별 재조회할 수 있습니다. 실행 중에는 화면을 열어 두어야 합니다.

그래프는 `단지별 가격`과 `내 집과 비교` 탭으로 나뉘며 월간·주간 중앙값을 전환할 수 있습니다. 가격 탭은 실제 기록만 표시하고 빈 기간을 건너뛰어 선으로 연결합니다. 비교 탭은 보유 주택이나 관심단지의 가격이 바뀐 시점마다 양쪽의 마지막 확인 가격을 사용합니다. 따라서 9월에 입력한 내 집 가격과 8월이 마지막 거래인 관심단지도 비교할 수 있으며, 내부 데이터에는 양쪽 가격의 기준 시점을 함께 보관합니다.

### 닉네임과 문의 접수

첫 로그인 뒤 형용사와 구체적인 동물 종을 조합한 고유 앱 닉네임을 만듭니다. Google·Kakao의 이름, 이메일과 프로필 사진은 닉네임에 사용하지 않습니다. 설정에서 2~30자의 다른 고유 닉네임으로 변경할 수 있습니다.

문의는 앱의 비공개 문의함에 먼저 저장됩니다. 관리자는 `/admin/login`으로 로그인해 `/admin/support`에서 대화와 첨부 이미지를 확인하고 답변합니다. 개발 작업이 필요한 문의만 검토 후 GitHub Issue로 전환합니다. Vercel에 서버 전용 `GITHUB_ISSUES_TOKEN`을 추가하고, Fine-grained token에는 해당 저장소의 **Issues: Read and write** 권한만 부여합니다. 다른 저장소를 쓰려면 `GITHUB_ISSUES_REPOSITORY=소유자/저장소`를 설정합니다.

관리자 계정은 Supabase Authentication → Users에서 이메일·비밀번호 사용자로 만든 뒤 SQL Editor에서 `insert into public.app_admins(user_id) values ('관리자 사용자 UUID');`를 실행해 등록합니다. 일반 소셜 로그인 사용자는 관리자 경로에 접근할 수 없습니다. `/admin`에서는 미답변 문의와 예약 수집 상태를 확인하고, `/admin/sync`에서는 전체 수동 실행과 실패한 단지·월만 재시도할 수 있습니다. `/admin/support`의 내부 메모는 사용자에게 공개되지 않으며, 사용자 조회·연동 점검·관리자 활동 기록은 각각 별도 메뉴에서 확인합니다.

운영 배포 전 `supabase/migrations`를 파일명 순서대로 적용합니다. 특히 관리자 추가 기능은 `20260913120912`부터 `20260913122341`까지 순서대로 적용해야 합니다. 되돌릴 때는 운영 데이터를 삭제하지 말고 해당 관리자 화면과 API만 이전 배포로 비활성화합니다. 예약 실행 상태를 정확히 판정하려면 Vercel에 `CRON_ENABLED_AT`을 첫 운영 배포 시각의 UTC ISO 값으로 추가합니다.

사용자 화면과 API 응답에는 내부 오류, 공급자 응답, 환경변수 이름을 표시하지 않습니다. 서버 오류 응답의 `requestId`로 Vercel Logs를 검색하면 상세 원인을 확인할 수 있습니다. API 키, 토큰, 이메일과 사용자 UUID는 로그 기록 전에 가립니다.
