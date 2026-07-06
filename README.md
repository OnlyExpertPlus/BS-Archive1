# BS-Archive MVP v6 업데이트판

Beat Saber / ScoreSaber 기록 분석기 + 랭크맵 수동 기록장입니다.

## 이번 업데이트

- 폴더 이름은 그대로 `beat-saber-analyzer-v6`입니다.
- ScoreSaber 랭크맵 목록을 페이지 제한 없이 최대한 끝까지 수집합니다.
- 오래된 랭크맵 누락을 줄이기 위해 기본 수집 페이지를 크게 늘렸습니다.
- 같은 곡의 여러 난이도는 `leaderboard id` 기준으로 각각 따로 저장합니다.
- 랭크맵 캐시 상태에 `불러온 개수 / 페이지 / 갱신 시간`을 표시합니다.
- ScoreSaber에서 가져온 기록도 `보완` 버튼으로 수정할 수 있습니다.
- 자동 기록을 다시 가져와도 직접 입력한 오른손/왼손 ACC, 메모는 유지됩니다.
- 기존 디자인 흐름은 v3/v6 느낌을 유지했습니다.

## 실행

이미 기존 v6 폴더에 `node_modules`가 있다면 새 파일을 덮어쓴 뒤 아래만 실행하면 됩니다.

```bash
npm run dev
```

새 폴더로 압축을 풀었거나 `node_modules`가 없으면 한 번만 설치가 필요합니다.

```bash
npm install
npm run dev
```

## 주소

- 분석기: http://localhost:3000
- 기록장: http://localhost:3000/logbook

## 주의

랭크맵 전체 새로고침은 ScoreSaber API를 여러 페이지 호출하므로 시간이 걸릴 수 있습니다.
처음 한 번 캐시되면 이후에는 브라우저 localStorage의 캐시를 사용합니다.
