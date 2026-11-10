# AI 음악·영화 취향 큐레이터

Next.js App Router와 TypeScript로 만든 실습 앱의 기본 틀입니다.
첫 화면의 취향 입력 폼을 `/api/recommend`와 연결했습니다.
추천받기를 누르면 입력한 기분, 장르, 좋아하는 작품 또는 가수, 추천 유형, 최대 상영시간, 자유 요청을 JSON으로 보냅니다.
상영시간을 비우면 해당 조건을 생략합니다.
영화·음악 추천 카드는 제목, 장르, 영화 상영시간 또는 음악 아티스트, 추천 이유를 표시합니다.
별도의 `AI Agent 실행 기록`에서 실행 함수, 검색 조건, 결과 수와 작품 목록을 확인할 수 있습니다.
처리 중에는 진행 안내를 표시하고 중복 요청을 막습니다. 오류와 빈 검색 결과도 안내합니다.

## 실행

프로젝트 폴더에서 다음 명령을 실행합니다.

```powershell
npm.cmd install
npm.cmd run dev
```

브라우저에서 http://localhost:3000 에 접속합니다.
종료하려면 터미널에서 `Ctrl+C`를 누릅니다.

## 프로덕션 실행

```powershell
npm.cmd run build
npm.cmd start
```

## AI 추천 서버

`POST /api/recommend`에 JSON으로 취향 정보를 보냅니다.
`recommendationType`은 `movie`, `music`, `both` 중 하나이며 필수입니다.
`mood`, `genre`, `favorite`, `request`는 선택 문자열입니다.
`maxRuntime`은 선택 항목이며 분 단위의 양의 정수입니다. 제한하지 않으려면 생략합니다.
잘못된 JSON이나 입력 형식에는 HTTP 400을 반환합니다.
정상 요청에는 HTTP 200과 다음 정보를 반환합니다.

- `recommendations.movies`: 추천 영화의 원본 정보와 AI가 작성한 `reason`
- `recommendations.music`: 추천 음악의 원본 정보와 AI가 작성한 `reason`
- `toolCalls`: 실제 실행한 검색 함수의 `name`, 적용한 `arguments`, 원본 검색 결과 `result`

OpenAI Responses API의 함수 호출로 검색 조건을 결정하고 서버가 검색 함수를 실행합니다.
영화 요청은 `search_movies`, 음악 요청은 `search_music`, 둘 다 요청하면 두 함수를 사용합니다.
AI가 한 함수만 선택하면 다음 호출에서 누락된 함수를 선택하게 합니다.
검색 도구 호출 단계는 최대 2회이며, 이후 검색 결과를 AI에게 전달해 이유를 작성하게 합니다.
매체별 최대 3개를 추천합니다. 추천 작품 정보는 AI가 만든 값이 아닌 JSON 검색 결과에서 가져옵니다.
서버는 추천 ID가 실제 검색 결과에 있는지 검증하고 영화 최대 상영시간을 강제합니다.
결과가 없는 매체는 빈 목록을 반환하며, 조건을 임의로 완화하지 않습니다.
키 누락 또는 API 이용 제한은 HTTP 503, 외부 API 실패나 잘못된 AI 응답은 HTTP 502를 반환합니다.
키와 OpenAI의 원시 오류 내용은 응답에 넣지 않습니다.

`npm.cmd run dev`로 서버를 켠 뒤 다른 PowerShell 창에서 시험할 수 있습니다.

```powershell
$body = @{
  mood = "따뜻함"
  genre = "드라마"
  favorite = "골목 끝 우체통"
  recommendationType = "both"
  maxRuntime = 90
  request = "편안한 작품을 원해요"
} | ConvertTo-Json
Invoke-RestMethod -Uri http://localhost:3000/api/recommend -Method Post -ContentType 'application/json; charset=utf-8' -Body ([System.Text.Encoding]::UTF8.GetBytes($body))
```

화면은 서버 응답을 표시합니다. 요청 정보는 서버 파일에 저장하지 않습니다.
사용자 취향과 검색 결과는 추천 생성을 위해 OpenAI에 전달하며 `store: false`로 요청합니다.
기본 모델은 `gpt-4.1-mini`이며 서버 환경변수 `OPENAI_MODEL`로 변경할 수 있습니다.
별도 SDK 설치 없이 서버의 `fetch`로 공식 API를 호출합니다.
구현은 [OpenAI 함수 호출 문서](https://developers.openai.com/api/docs/guides/function-calling)와
[구조화 응답 문서](https://developers.openai.com/api/docs/guides/structured-outputs)를 따릅니다.

전체 자동 테스트는 Node.js 26에서 `npm.cmd test`로 실행합니다.
자동 테스트는 OpenAI 응답만 대체하며 실제 JSON 검색 함수를 실행합니다. API 요금은 발생하지 않습니다.

실제 API 시험은 키를 설정한 뒤 서버를 시작합니다.

```powershell
npm.cmd run build
npm.cmd start -- --hostname 127.0.0.1 --port 3100
```

다른 터미널에서 `node scripts/test-recommend-live.mjs`를 실행합니다.
영화, 음악, 둘 다 요청을 순서대로 보내 함수 이름, 원본 정보, 추천 ID, 이유, 상영시간을 검증합니다.
실제 OpenAI API 호출이므로 사용 요금이 발생합니다. 다른 주소는 `TEST_BASE_URL`로 지정할 수 있습니다.

## 브라우저 확인

현재 환경에서는 설치된 Microsoft Edge를 사용합니다.
서버를 `http://127.0.0.1:3100`에서 실행한 뒤 아래 명령을 실행합니다.

```powershell
npm.cmd run test:ui
```

브라우저 테스트 9개는 API 응답을 대체해 입력값 전송, 세 추천 유형, 처리 중 중복 요청 방지,
오류, 빈 결과, 모바일 너비 375px의 화면 배치를 확인합니다. OpenAI API 요금은 발생하지 않습니다.

```powershell
npm.cmd run test:ui:live
```

이 명령은 실제 브라우저에서 영화만, 음악만, 둘 다를 선택하고 버튼을 눌러 서버와 OpenAI에 요청합니다.
카드, 실행 기록, 원본 검색 정보와 추천의 일치 여부, 모바일 화면을 확인합니다. API 사용 요금이 발생합니다.
스크린샷은 Git에서 제외되는 `test-results/live-*.png`에 저장합니다.
다른 서버 주소를 사용하려면 `TEST_BASE_URL`을 설정합니다.

## 서버 API 키 설정

실제 키는 로컬의 `.env.local`에 `OPENAI_API_KEY=실제키` 형태로 설정합니다.
파일이 이미 있다면 기존 설정을 보존하고 해당 항목만 추가하거나 수정합니다.
`.env.example`은 API 키 값이 비어 있는 공유용 양식입니다. 실제 키를 이 파일에 넣지 않습니다.
기존 `.env`는 그대로 보존했습니다. AI 추천에는 유효한 키와 API 사용 권한이 필요합니다.
환경변수를 변경한 뒤 개발 서버를 다시 시작합니다.

키는 서버 코드에서만 `process.env.OPENAI_API_KEY`로 읽습니다.
`NEXT_PUBLIC_` 접두사, 클라이언트 코드, 응답 또는 로그에 키를 넣지 않습니다.
이는 [OpenAI 공식 문서의 서버 환경변수 지침](https://developers.openai.com/api/reference/overview)을 따릅니다.
`.gitignore`는 `.env`와 `.env.local` 등 `.env*`를 제외하고 비밀 값이 없는 `.env.example`만 허용합니다.
GitHub에 푸시할 때도 이 제외 규칙을 유지하고 실제 키 파일은 커밋하지 않습니다.
