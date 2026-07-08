export type RankedMap = {
  id: string;
  title: string;
  artist: string;
  mapper: string;
  difficulty: string;
  stars: number;
  coverUrl: string;
  songHash?: string;
};

// v7.1부터 샘플/임시 추천 데이터는 사용하지 않습니다.
// 실제 전체 랭크맵 목록은 기록 저장소의 ScoreSaber 랭크맵 캐시에서 불러옵니다.
export const rankedMaps: RankedMap[] = [];
