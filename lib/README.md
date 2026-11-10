# JSON 검색 함수

`search.ts`는 Node.js 파일 시스템을 사용하는 서버 전용 모듈입니다.
프로젝트 루트에서 실행합니다. 클라이언트 컴포넌트나 Edge 런타임에서는 가져오지 않습니다.
모듈 로드 시 `data/movies.json`과 `data/music.json`을 읽습니다.

```typescript
import { search_movies, search_music } from "./search";

const movies = search_movies({
  genre: "드라마",
  mood: "따뜻함",
  maxRuntimeMinutes: 90,
});

const music = search_music({
  genre: "팝",
  mood: "활기",
  energyLevel: 5,
});
```

- 모든 조건은 선택 사항이며, 생략한 조건은 제한하지 않습니다. 조건이 없으면 전체 목록을 반환합니다.
- 지정한 조건은 모두 만족해야 합니다. 장르와 분위기는 배열 안의 문자열과 정확히 일치해야 합니다.
- 최대 상영시간은 분 단위이며 해당 값을 포함합니다. 에너지 수준은 1~5 중 정확히 일치하는 값을 찾습니다.
- 일치하는 항목이 없으면 `[]`를 반환합니다. 임의 추천이나 조건 완화는 하지 않습니다.
- 결과는 원본 순서, ID, 모든 필드 값을 유지하는 복사본입니다. 결과를 수정해도 다음 검색에 영향을 주지 않습니다.
- `recommend.ts`가 OpenAI에서 선택한 검색 함수를 실행하고 결과를 돌려줍니다. 화면은 `/api/recommend`를 통해 결과를 받아 표시합니다.

현재 개발 환경인 Node.js 26에서 테스트합니다. 프로젝트 루트에서 `npm.cmd test`를 실행합니다.
