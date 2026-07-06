import { difficultyLabel, scoreAccuracy, ScoreSaberPlayer, ScoreSaberScore } from '@/lib/scoresaber';

type NormalizedScore = {
  song: string;
  mapper: string;
  difficulty: string;
  stars: number;
  accuracy: number;
  pp: number;
  timeSet: string;
  ranked: boolean;
  fullCombo: boolean;
  coverImage?: string;
};

function round(value: number, digits = 2): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function normalize(scores: ScoreSaberScore[]): NormalizedScore[] {
  return scores.map((s) => ({
    song: [s.leaderboard.songName, s.leaderboard.songSubName].filter(Boolean).join(' '),
    mapper: s.leaderboard.levelAuthorName ?? '',
    difficulty: difficultyLabel(s.leaderboard.difficulty.difficultyRaw),
    stars: s.leaderboard.stars ?? 0,
    accuracy: round(scoreAccuracy(s)),
    pp: round(s.pp ?? 0),
    timeSet: s.timeSet ?? '',
    ranked: Boolean(s.leaderboard.ranked),
    fullCombo: Boolean(s.fullCombo),
    coverImage: s.leaderboard.coverImage
  }));
}

function groupByStar(scores: NormalizedScore[]) {
  const groups = new Map<number, NormalizedScore[]>();

  scores.forEach((s) => {
    if (!s.stars) return;
    const bucket = Math.floor(s.stars);
    const list = groups.get(bucket) ?? [];
    list.push(s);
    groups.set(bucket, list);
  });

  return [...groups.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([star, list]) => ({
      star,
      count: list.length,
      averageAccuracy: round(list.reduce((sum, s) => sum + s.accuracy, 0) / list.length),
      averagePp: round(list.reduce((sum, s) => sum + s.pp, 0) / list.length)
    }));
}

function makeRefreshCandidates(top: NormalizedScore[]) {
  const ranked = top.filter((s) => s.ranked && s.pp > 0 && s.accuracy > 0);
  const topAvg = ranked.length
    ? ranked.reduce((sum, s) => sum + s.accuracy, 0) / ranked.length
    : 0;

  return ranked
    .map((s, index) => {
      const targetAccuracy = Math.min(99.99, Math.max(s.accuracy + 0.3, Math.min(topAvg, s.accuracy + 1.2)));
      const oldRecordBonus = s.timeSet ? Math.min(20, Math.max(0, (Date.now() - new Date(s.timeSet).getTime()) / 86400000 / 10)) : 0;
      const weaknessGap = Math.max(0, topAvg - s.accuracy);
      const top50Influence = Math.max(0, 50 - index) / 50;
      const priority = weaknessGap * 2 + top50Influence * 3 + oldRecordBonus + s.stars * 0.1;

      const reasons: string[] = [];
      if (weaknessGap >= 0.5) reasons.push(`Top 기록 평균(${round(topAvg)}%)보다 낮음`);
      if (index < 50) reasons.push('Top 50 영향권 기록');
      if (s.fullCombo) reasons.push('FC 기록이라 ACC 갱신 후보');
      if (!reasons.length) reasons.push('현재 기록 기준 갱신 여지 있음');

      return {
        ...s,
        targetAccuracy: round(targetAccuracy),
        priority: round(priority),
        reasons
      };
    })
    .filter((s) => s.targetAccuracy > s.accuracy)
    .sort((a, b) => b.priority - a.priority)
    .slice(0, 5);
}

export function analyze(player: ScoreSaberPlayer, topScores: ScoreSaberScore[], recentScores: ScoreSaberScore[]) {
  const top = normalize(topScores).filter((s) => s.ranked).sort((a, b) => b.pp - a.pp);
  const recent = normalize(recentScores).sort((a, b) => new Date(b.timeSet).getTime() - new Date(a.timeSet).getTime());
  const ranked = top.filter((s) => s.ranked);
  const accuracies = ranked.map((s) => s.accuracy).filter(Boolean);

  return {
    player: {
      id: player.id,
      name: player.name,
      profilePicture: player.profilePicture,
      country: player.country,
      pp: round(player.pp ?? 0),
      rank: player.rank,
      countryRank: player.countryRank,
      rankedPlayCount: player.scoreStats?.rankedPlayCount ?? ranked.length
    },
    summary: {
      averageAccuracy: accuracies.length ? round(accuracies.reduce((a, b) => a + b, 0) / accuracies.length) : 0,
      bestAccuracy: accuracies.length ? round(Math.max(...accuracies)) : 0,
      bestPp: ranked.length ? ranked[0].pp : 0,
      rankedMapCount: ranked.length
    },
    top30: top.slice(0, 30),
    top50: top.slice(0, 50),
    recent: recent.slice(0, 20),
    starBuckets: groupByStar(ranked),
    refreshCandidates: makeRefreshCandidates(top),
    ppNotice: '현재 버전에서는 부정확한 예상 +PP 숫자를 표시하지 않습니다. ScoreSaber 공식/보간 PP 계산기를 붙인 뒤 1pp 효율 추천을 활성화할 예정입니다.'
  };
}
