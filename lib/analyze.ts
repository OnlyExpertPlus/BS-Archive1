import {
  beatSaverUrl,
  difficultyLabel,
  scoreAccuracy,
  scoreSaberLeaderboardUrl,
  ScoreSaberLeaderboard,
  ScoreSaberPlayer,
  ScoreSaberScore,
} from "@/lib/scoresaber";

type NormalizedScore = {
  scoreId?: string;
  leaderboardId?: number;
  songHash?: string;
  song: string;
  mapper: string;
  difficulty: string;
  stars: number;
  accuracy: number;
  pp: number;
  score: number;
  timeSet: string;
  ranked: boolean;
  fullCombo: boolean;
  coverImage?: string;
  beatsaverUrl?: string;
  scoresaberUrl?: string;
  targetAccuracy?: number;
  targetPp?: number;
  estimatedGainPp?: number;
  onePpAccGain?: number;
  reasons?: string[];
};

function round(value: number, digits = 2): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

const STAR_PP = 42.1138;
const SCORE_SABER_CURVE = (
  [
    [1, 5.36739428289063],
    [0.9995, 5.01954359587479],
    [0.999, 4.7154706464162],
    [0.99825, 4.32502738358955],
    [0.9975, 3.99679360676332],
    [0.99625, 3.55261453375554],
    [0.995, 3.2022017597338],
    [0.99375, 2.9190155639255],
    [0.9925, 2.68566785659272],
    [0.99125, 2.49029057941069],
    [0.99, 2.32450628214992],
    [0.9875, 2.05894715905274],
    [0.985, 1.85638876936471],
    [0.9825, 1.69753624864754],
    [0.98, 1.57024100555322],
    [0.9775, 1.46647263992895],
    [0.975, 1.38071027431051],
    [0.9725, 1.30903330650576],
    [0.97, 1.24858077599573],
    [0.965, 1.1552120359501],
    [0.96, 1.08718835738505],
    [0.955, 1.0388633331419],
    [0.95, 1],
    [0.94, 0.941736298058024],
    [0.93, 0.903999407186574],
    [0.92, 0.872871034144885],
    [0.91, 0.848837598812447],
    [0.9, 0.825756123560842],
    [0.875, 0.781693456029605],
    [0.85, 0.746229066414319],
    [0.825, 0.715046566345427],
    [0.8, 0.687226886295028],
    [0.75, 0.645180821010144],
    [0.7, 0.612556595911495],
    [0.65, 0.586601001276758],
    [0.6, 0.182232336674391],
    [0, 0],
  ] as Array<[number, number]>
).sort((a, b) => a[0] - b[0]);

function curveMultiplier(accRatio: number) {
  const acc = Math.max(0, Math.min(1, accRatio));
  for (let i = 0; i < SCORE_SABER_CURVE.length - 1; i += 1) {
    const [x1, y1] = SCORE_SABER_CURVE[i];
    const [x2, y2] = SCORE_SABER_CURVE[i + 1];
    if (acc >= x1 && acc <= x2) {
      if (x1 === x2) return y1;
      const t = (acc - x1) / (x2 - x1);
      return y1 + (y2 - y1) * t;
    }
  }
  return acc <= 0 ? 0 : SCORE_SABER_CURVE[SCORE_SABER_CURVE.length - 1][1];
}

function scoreSaberPp(stars: number, accPercent: number) {
  if (!stars || stars <= 0 || !accPercent || accPercent <= 0) return 0;
  return round(stars * STAR_PP * curveMultiplier(accPercent / 100), 2);
}

function weightedTotal(pps: number[]) {
  return pps
    .filter((pp) => Number.isFinite(pp) && pp > 0)
    .sort((a, b) => b - a)
    .reduce((sum, pp, index) => sum + pp * Math.pow(0.965, index), 0);
}

function gainIfAdded(currentPps: number[], candidatePp: number) {
  if (!candidatePp || candidatePp <= 0 || !currentPps.length) return 0;
  const base = currentPps
    .filter((pp) => Number.isFinite(pp) && pp > 0)
    .sort((a, b) => b - a);
  const limit = base.length;
  const next = [...base, candidatePp].sort((a, b) => b - a).slice(0, limit);
  return round(weightedTotal(next) - weightedTotal(base), 2);
}

function gainIfReplaced(
  currentPps: number[],
  index: number,
  candidatePp: number,
) {
  if (index < 0 || !candidatePp || candidatePp <= 0) return 0;
  const next = [...currentPps];
  next[index] = Math.max(next[index] ?? 0, candidatePp);
  return round(weightedTotal(next) - weightedTotal(currentPps), 2);
}

function normalize(scores: ScoreSaberScore[]): NormalizedScore[] {
  return scores.map((s) => ({
    scoreId: s.id !== undefined ? String(s.id) : undefined,
    leaderboardId: s.leaderboard.id,
    songHash: s.leaderboard.songHash,
    song: [s.leaderboard.songName, s.leaderboard.songSubName]
      .filter(Boolean)
      .join(" "),
    mapper: s.leaderboard.levelAuthorName ?? "",
    difficulty: difficultyLabel(s.leaderboard.difficulty.difficultyRaw),
    stars: s.leaderboard.stars ?? 0,
    accuracy: round(scoreAccuracy(s)),
    pp: round(s.pp ?? 0),
    score: s.modifiedScore ?? s.baseScore ?? 0,
    timeSet: s.timeSet ?? "",
    ranked: Boolean(s.leaderboard.ranked),
    fullCombo: Boolean(s.fullCombo),
    coverImage: s.leaderboard.coverImage,
    beatsaverUrl: beatSaverUrl(s.leaderboard.songHash),
    scoresaberUrl: scoreSaberLeaderboardUrl(s.leaderboard.id),
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
      averageAccuracy: round(
        list.reduce((sum, s) => sum + s.accuracy, 0) / list.length,
      ),
      averagePp: round(list.reduce((sum, s) => sum + s.pp, 0) / list.length),
    }));
}

function avgByStarBucket(scores: NormalizedScore[]) {
  const map = new Map<number, number>();
  const grouped = groupByStar(scores);
  grouped.forEach((g) => map.set(g.star, g.averageAccuracy));
  return map;
}

function targetForRecord(current: number, bucketAvg: number, ageDays: number) {
  const gap = Math.max(0, bucketAvg - current);

  // 비정상적으로 낮은 옛 기록은 예외 처리: 평균 근처/조금 위까지 목표를 크게 열어둡니다.
  if (gap >= 8)
    return Math.min(
      96.5,
      bucketAvg + 1.0,
      Math.max(current + 2.0, bucketAvg + 0.4),
    );
  if (gap >= 5)
    return Math.min(
      96.2,
      bucketAvg + 0.7,
      Math.max(current + 1.2, bucketAvg + 0.2),
    );
  if (gap >= 3) return Math.min(95.8, bucketAvg + 0.35, current + 1.0);

  // 일반적인 기갱은 0.1~0.5%p 내외. 오래된 기록만 조금 더 여지를 줍니다.
  const ageBonus = ageDays >= 365 ? 0.18 : ageDays >= 180 ? 0.1 : 0;
  const gain = Math.min(0.55, Math.max(0.1, 0.1 + gap * 0.18 + ageBonus));
  return Math.min(99.99, current + gain);
}

function makeRefreshCandidates(top: NormalizedScore[], limit = 10) {
  const ranked = top.filter((s) => s.ranked && s.pp > 0 && s.accuracy > 0);
  const bucketAvg = avgByStarBucket(ranked);
  const currentPps = ranked.map((s) => s.pp);

  return ranked
    .map((s, index) => {
      const ageDays = s.timeSet
        ? Math.max(0, (Date.now() - new Date(s.timeSet).getTime()) / 86400000)
        : 0;
      const starAvg = bucketAvg.get(Math.floor(s.stars)) ?? s.accuracy;
      const weaknessGap = Math.max(0, starAvg - s.accuracy);
      const targetAccuracy = targetForRecord(s.accuracy, starAvg, ageDays);
      const top50Influence = Math.max(0, 50 - index) / 50;
      const oldRecordBonus = Math.min(4, ageDays / 120);
      const anomalyBonus =
        weaknessGap >= 5 ? weaknessGap * 1.8 : weaknessGap * 1.2;
      const targetPp = scoreSaberPp(s.stars, targetAccuracy);
      const estimatedGainPp = gainIfReplaced(currentPps, index, targetPp);
      const priority =
        anomalyBonus +
        top50Influence * 2.0 +
        oldRecordBonus +
        s.pp / 400 +
        estimatedGainPp * 2.2;

      const reasons: string[] = [];
      if (weaknessGap >= 5)
        reasons.push(`${Math.floor(s.stars)}★대 평균보다 크게 낮은 예외 기록`);
      else if (weaknessGap >= 0.35)
        reasons.push(
          `${Math.floor(s.stars)}★대 평균보다 ${round(weaknessGap)}%p 낮음`,
        );
      if (ageDays >= 180) reasons.push(`${Math.floor(ageDays)}일 전 기록`);
      if (index < 50) reasons.push("Top 50 영향권 기록");
      if (!reasons.length) reasons.push("소폭 갱신 후보");

      return {
        ...s,
        targetAccuracy: round(targetAccuracy),
        targetPp: round(targetPp),
        estimatedGainPp: round(estimatedGainPp),
        priority: round(priority),
        reasons,
      };
    })
    .filter((s) => s.targetAccuracy > s.accuracy)
    .sort((a, b) => b.priority - a.priority)
    .slice(0, limit);
}

function makeOldCandidates(top: NormalizedScore[], limit = 10) {
  const ranked = top.filter((s) => s.ranked && s.timeSet);
  const bucketAvg = avgByStarBucket(ranked);
  const currentPps = top.filter((s) => s.ranked && s.pp > 0).map((s) => s.pp);

  return ranked
    .map((s) => {
      const recordIndex = top.findIndex(
        (item) =>
          item.leaderboardId === s.leaderboardId &&
          item.difficulty === s.difficulty,
      );
      const ageDays = Math.max(
        0,
        (Date.now() - new Date(s.timeSet).getTime()) / 86400000,
      );
      const avg = bucketAvg.get(Math.floor(s.stars)) ?? s.accuracy;
      const gap = Math.max(0, avg - s.accuracy);
      const targetAccuracy = targetForRecord(s.accuracy, avg, ageDays);
      const targetPp = scoreSaberPp(s.stars, targetAccuracy);
      const estimatedGainPp = gainIfReplaced(currentPps, recordIndex, targetPp);
      const priority =
        ageDays / 45 + gap * 2.6 + s.pp / 300 + estimatedGainPp * 1.8;
      const reasons = [
        `${Math.floor(ageDays)}일 전 기록`,
        gap >= 5
          ? `${Math.floor(s.stars)}★대 평균보다 크게 낮음`
          : gap > 0.25
            ? `${Math.floor(s.stars)}★대 평균보다 낮음`
            : "오래된 기록 점검 후보",
      ];
      return {
        ...s,
        targetAccuracy: round(targetAccuracy),
        targetPp: round(targetPp),
        estimatedGainPp: round(estimatedGainPp),
        priority,
        reasons,
      };
    })
    .filter((s) => {
      if (!s.timeSet) return false;
      const ageDays = Math.max(
        0,
        (Date.now() - new Date(s.timeSet).getTime()) / 86400000,
      );
      return ageDays >= 90;
    })
    .sort((a, b) => b.priority - a.priority)
    .slice(0, limit);
}

function normalizeLeaderboard(
  lb: ScoreSaberLeaderboard,
): NormalizedScore | null {
  const stars = lb.stars ?? 0;
  const leaderboardId = Number(lb.id ?? lb.difficulty?.leaderboardId ?? 0);
  if (!leaderboardId || !lb.ranked || stars <= 0) return null;

  return {
    leaderboardId,
    songHash: lb.songHash,
    song: [lb.songName, lb.songSubName].filter(Boolean).join(" "),
    mapper: lb.levelAuthorName ?? "",
    difficulty: difficultyLabel(lb.difficulty?.difficultyRaw),
    stars: round(stars, 2),
    accuracy: 0,
    pp: estimatedMaxPp(stars, lb.maxPP),
    score: 0,
    timeSet: "",
    ranked: true,
    fullCombo: false,
    coverImage: lb.coverImage,
    beatsaverUrl: beatSaverUrl(lb.songHash),
    scoresaberUrl: scoreSaberLeaderboardUrl(leaderboardId),
  };
}

function nearestBucketAverage(
  bucketAvg: Map<number, number>,
  star: number,
): { avg: number; distance: number } | null {
  const buckets = [...bucketAvg.keys()];
  if (!buckets.length) return null;
  let best = buckets[0];
  let bestDistance = Math.abs(best - star);
  for (const bucket of buckets) {
    const distance = Math.abs(bucket - star);
    if (distance < bestDistance) {
      best = bucket;
      bestDistance = distance;
    }
  }
  const avg = bucketAvg.get(best);
  return avg ? { avg, distance: bestDistance } : null;
}

function estimatedMaxPp(stars: number, apiMaxPp?: number | null) {
  if (apiMaxPp && apiMaxPp > 0) return round(apiMaxPp, 2);
  return scoreSaberPp(stars, 100);
}

function minimumStarForPlayer(totalPp: number) {
  if (totalPp >= 18000) return 11;
  if (totalPp >= 16500) return 10;
  if (totalPp >= 15000) return 9;
  if (totalPp >= 13500) return 8;
  if (totalPp >= 11500) return 7;
  if (totalPp >= 9000) return 6;
  if (totalPp >= 6500) return 5;
  return 3;
}

function expectedPpFromAccuracy(stars: number, expectedAccuracy: number) {
  return scoreSaberPp(stars, expectedAccuracy);
}

function daysSince(value?: string | null) {
  if (!value) return Number.POSITIVE_INFINITY;
  const time = new Date(value).getTime();
  if (Number.isNaN(time)) return Number.POSITIVE_INFINITY;
  return Math.max(0, (Date.now() - time) / 86400000);
}

function average(values: number[]) {
  const valid = values.filter((v) => Number.isFinite(v) && v > 0);
  return valid.length ? valid.reduce((a, b) => a + b, 0) / valid.length : 0;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function estimateAccSlopeByStar(bucketAvg: Map<number, number>) {
  const buckets = [...bucketAvg.entries()].sort((a, b) => a[0] - b[0]);
  const slopes: number[] = [];
  for (let i = 0; i < buckets.length - 1; i += 1) {
    const [starA, avgA] = buckets[i];
    const [starB, avgB] = buckets[i + 1];
    if (starB === starA) continue;
    const dropPerStar = (avgA - avgB) / (starB - starA);
    if (Number.isFinite(dropPerStar)) slopes.push(dropPerStar);
  }
  const positive = slopes.filter((v) => v > 0);
  const value = positive.length ? average(positive) : 0.55;
  return clamp(value, 0.28, 1.35);
}

function weightedNearbyAccuracy(
  rankedScores: NormalizedScore[],
  star: number,
) {
  const nearby = rankedScores
    .filter((s) => Number.isFinite(s.stars) && Number.isFinite(s.accuracy))
    .map((s) => {
      const distance = Math.abs(s.stars - star);
      return { score: s, distance };
    })
    .filter((item) => item.distance <= 1.35)
    .sort((a, b) => a.distance - b.distance)
    .slice(0, 18);

  if (nearby.length < 4) return null;

  const weighted = nearby.reduce(
    (acc, item) => {
      const weight = 1 / Math.pow(item.distance + 0.22, 2);
      return {
        total: acc.total + item.score.accuracy * weight,
        weight: acc.weight + weight,
      };
    },
    { total: 0, weight: 0 },
  );

  return weighted.weight ? weighted.total / weighted.weight : null;
}

function interpolateBucketAverage(
  bucketAvg: Map<number, number>,
  star: number,
) {
  const buckets = [...bucketAvg.entries()].sort((a, b) => a[0] - b[0]);
  if (!buckets.length) return null;

  const lower = [...buckets].reverse().find(([bucket]) => bucket <= star);
  const upper = buckets.find(([bucket]) => bucket >= star);

  if (lower && upper && lower[0] !== upper[0]) {
    const t = (star - lower[0]) / (upper[0] - lower[0]);
    return lower[1] + (upper[1] - lower[1]) * t;
  }

  const nearest = nearestBucketAverage(bucketAvg, Math.floor(star));
  return nearest?.avg ?? null;
}

function estimateAccuracyForUnplayed(
  bucketAvg: Map<number, number>,
  rankedScores: NormalizedScore[],
  star: number,
  totalPp: number,
  difficulty = "ExpertPlus",
) {
  const minStar = minimumStarForPlayer(totalPp);
  const slope = estimateAccSlopeByStar(bucketAvg);
  const nearby = weightedNearbyAccuracy(rankedScores, star);
  const bucketEstimate = interpolateBucketAverage(bucketAvg, star);

  const fallbackBase =
    totalPp >= 17000
      ? 96.4
      : totalPp >= 15000
        ? 95.1
        : totalPp >= 13000
          ? 93.3
          : totalPp >= 10000
            ? 91.2
            : 88.8;

  const base = nearby ?? bucketEstimate ?? fallbackBase;
  const bucket = Math.floor(star);
  const decimalPressure = (star - bucket) * slope;
  const starBandPressure = Math.max(0, star - (minStar + 2.2)) * 0.18;
  const diffBonus =
    difficulty === "Easy"
      ? 0.3
      : difficulty === "Normal"
        ? 0.22
        : difficulty === "Hard"
          ? 0.14
          : difficulty === "Expert"
            ? 0.05
            : 0;

  // 같은 9★대라도 9.02★와 9.98★를 똑같이 보지 않도록 별 소수점/주변 기록을 반영합니다.
  const estimated = base - decimalPressure - starBandPressure + diffBonus;
  return round(clamp(estimated, 82, 98.7), 2);
}

function makeTryCandidates(
  top: NormalizedScore[],
  rankedLeaderboards: ScoreSaberLeaderboard[] = [],
  totalPp = 0,
  limit = 10,
) {
  const rankedScores = top.filter(
    (s) => s.ranked && s.accuracy > 0 && s.pp > 0,
  );
  const bucketAvg = avgByStarBucket(rankedScores);
  const playedLeaderboards = new Set(
    rankedScores.map((s) => String(s.leaderboardId)).filter(Boolean),
  );
  const playedHashDiff = new Set(
    rankedScores.map((s) => `${s.songHash ?? ""}:${s.difficulty}`),
  );
  const minStar = minimumStarForPlayer(totalPp);
  const top50 = rankedScores.slice(0, 50);
  const top50Floor =
    top50.length >= 30
      ? top50[top50.length - 1].pp
      : (rankedScores[0]?.pp ?? 0) * 0.58;
  const topAverage =
    average(top50.map((s) => s.pp)) || rankedScores[0]?.pp || 0;

  const normalized = rankedLeaderboards
    .map(normalizeLeaderboard)
    .filter((m): m is NormalizedScore => Boolean(m))
    .filter(
      (m) =>
        !playedLeaderboards.has(String(m.leaderboardId)) &&
        !playedHashDiff.has(`${m.songHash ?? ""}:${m.difficulty}`),
    );

  function scoreCandidate(
    m: NormalizedScore,
    relaxed = false,
  ): (NormalizedScore & { priority: number }) | null {
    const expectedAccuracy = estimateAccuracyForUnplayed(
      bucketAvg,
      rankedScores,
      m.stars,
      totalPp,
      m.difficulty,
    );
    const expectedPp = expectedPpFromAccuracy(m.stars, expectedAccuracy);
    const ageDays = daysSince(
      rankedLeaderboards.find(
        (lb) =>
          Number(lb.id ?? lb.difficulty?.leaderboardId) === m.leaderboardId,
      )?.rankedDate,
    );

    const starDistance = Math.abs(m.stars - (minStar + 1.4));
    const tooLowStarPenalty = m.stars < minStar ? (minStar - m.stars) * 160 : 0;
    const tooHighStarPenalty =
      m.stars > minStar + 5 ? (m.stars - minStar - 5) * 35 : 0;
    const recentBonus =
      ageDays <= 30 ? 42 : ageDays <= 90 ? 24 : ageDays <= 180 ? 10 : 0;
    const estimatedEfficiency = m.stars > 0 ? m.pp / m.stars : 0;
    const efficiencyBonus = Math.min(
      70,
      Math.max(0, estimatedEfficiency - 48) * 1.15,
    );
    const reflectBonus =
      expectedPp >= top50Floor
        ? 80
        : expectedPp >= top50Floor - 80
          ? 38
          : expectedPp >= topAverage * 0.55
            ? 18
            : 0;
    const starFitBonus = Math.max(0, 85 - starDistance * 24);

    // strict 필터는 최소한의 별 범위만 체크하고, PP는 탈락 조건이 아니라 감점으로 처리합니다.
    if (!relaxed && m.stars < minStar - 0.25) return null;
    if (!relaxed && m.stars > minStar + 5.5) return null;
    if (relaxed && m.stars < Math.max(3, minStar - 1.25)) return null;

    const estimatedGainPp = gainIfAdded(
      rankedScores.map((score) => score.pp),
      expectedPp,
    );

    // 미기록 PP 효율곡은 실제 weighted 총 PP가 오를 가능성을 가장 우선합니다.
    // 단순 raw PP가 높거나 최신곡이라는 이유만으로 추천 상단에 올라오지 않게 합니다.
    if (!relaxed && estimatedGainPp < 1) return null;

    const meaningfulGainBonus =
      estimatedGainPp >= 1 ? estimatedGainPp * 95 : estimatedGainPp * 14;
    const priority =
      meaningfulGainBonus +
      expectedPp * 0.55 +
      efficiencyBonus +
      recentBonus * 0.65 +
      reflectBonus * 0.6 +
      starFitBonus * 0.75 -
      tooLowStarPenalty -
      tooHighStarPenalty;

    const reasons: string[] = [];
    if (estimatedGainPp >= 1) reasons.push("실제 PP 증가 후보");
    else if (expectedPp >= top50Floor) reasons.push("Top 기록 반영 가능성");
    else if (expectedPp >= top50Floor - 80) reasons.push("Top 기록 근처 후보");
    else reasons.push("실력대 기준 미기록 후보");
    if (efficiencyBonus >= 22) reasons.push("PP 효율 추정");
    if (recentBonus >= 24) reasons.push("최신 랭크맵");
    if (m.stars >= minStar && m.stars <= minStar + 3)
      reasons.push(`${Math.floor(m.stars)}★대 추천 구간`);

    return {
      ...m,
      pp: expectedPp,
      targetAccuracy: expectedAccuracy,
      estimatedGainPp,
      priority,
      reasons,
    };
  }

  let candidates = normalized
    .map((m) => scoreCandidate(m, false))
    .filter((m): m is NormalizedScore & { priority: number } => Boolean(m));

  if (candidates.length < limit) {
    const seen = new Set(candidates.map((c) => String(c.leaderboardId)));
    const relaxed = normalized
      .filter((m) => !seen.has(String(m.leaderboardId)))
      .map((m) => scoreCandidate(m, true))
      .filter((m): m is NormalizedScore & { priority: number } => Boolean(m));
    candidates = [...candidates, ...relaxed];
  }

  // 마지막 안전장치: API는 왔는데 계산 후보가 0개면, 해당 실력대 별 구간의 미기록맵을 무조건 보여줍니다.
  if (!candidates.length && normalized.length) {
    candidates = normalized
      .filter(
        (m) => m.stars >= Math.max(3, minStar - 1) && m.stars <= minStar + 5,
      )
      .map((m) => {
        const expectedAccuracy = estimateAccuracyForUnplayed(
          bucketAvg,
          rankedScores,
          m.stars,
          totalPp,
          m.difficulty,
        );
        const expectedPp = expectedPpFromAccuracy(m.stars, expectedAccuracy);
        return {
          ...m,
          pp: expectedPp,
          targetAccuracy: expectedAccuracy,
          priority: expectedPp + m.stars * 18,
          reasons: [
            "실력대 기준 미기록 후보",
            `${Math.floor(m.stars)}★대 추천 구간`,
          ],
        };
      });
  }

  return candidates.sort((a, b) => b.priority - a.priority).slice(0, limit);
}

function makeOnePpEfficiencyCandidates(top: NormalizedScore[], limit = 10) {
  const ranked = top.filter(
    (s) => s.ranked && s.pp > 0 && s.accuracy > 0 && s.stars > 0,
  );
  const currentPps = ranked.map((s) => s.pp);

  return ranked
    .map((s, index) => {
      // API에서 받은 실제 PP와 커브로 재계산한 PP는 소수점/별점 차이로 조금 다를 수 있습니다.
      // 그래서 목표 PP는 "현재 실제 PP + 커브상 증가분"으로 잡아 총 weighted PP 증가량을 계산합니다.
      const currentCurvePp = scoreSaberPp(s.stars, s.accuracy);
      const maxTarget = Math.min(99.9, s.accuracy + 2.5);
      let found: {
        targetAccuracy: number;
        targetPp: number;
        estimatedGainPp: number;
        onePpAccGain: number;
      } | null = null;

      for (let step = 0.05; step <= 2.5; step += 0.05) {
        const targetAccuracy = round(Math.min(maxTarget, s.accuracy + step), 2);
        if (targetAccuracy <= s.accuracy) continue;
        const targetCurvePp = scoreSaberPp(s.stars, targetAccuracy);
        const targetPp = round(Math.max(s.pp, s.pp + (targetCurvePp - currentCurvePp)), 2);
        const estimatedGainPp = gainIfReplaced(currentPps, index, targetPp);
        if (estimatedGainPp >= 1) {
          found = {
            targetAccuracy,
            targetPp,
            estimatedGainPp,
            onePpAccGain: round(targetAccuracy - s.accuracy, 2),
          };
          break;
        }
      }

      if (!found) return null;

      const ageDays = daysSince(s.timeSet);
      const priority =
        1 / Math.max(0.05, found.onePpAccGain) +
        Math.min(12, s.pp / 80) +
        found.estimatedGainPp * 1.6 +
        (ageDays >= 180 ? 2 : 0);
      const reasons = [
        `+1pp까지 약 +${found.onePpAccGain.toFixed(2)}%p`,
        found.onePpAccGain <= 0.15
          ? "효율 매우 좋음"
          : found.onePpAccGain <= 0.45
            ? "소폭 갱신 효율 후보"
            : "갱신 여지 후보",
      ];

      return {
        ...s,
        targetAccuracy: found.targetAccuracy,
        targetPp: found.targetPp,
        estimatedGainPp: round(found.estimatedGainPp),
        onePpAccGain: found.onePpAccGain,
        priority,
        reasons,
      };
    })
    .filter(Boolean)
    .sort((a, b) => (b?.priority ?? 0) - (a?.priority ?? 0))
    .slice(0, limit) as Array<NormalizedScore & { priority: number }>;
}

export function analyze(
  player: ScoreSaberPlayer,
  topScores: ScoreSaberScore[],
  recentScores: ScoreSaberScore[],
  rankedLeaderboards: ScoreSaberLeaderboard[] = [],
) {
  const top = normalize(topScores)
    .filter((s) => s.ranked)
    .sort((a, b) => b.pp - a.pp);
  const recent = normalize(recentScores).sort(
    (a, b) => new Date(b.timeSet).getTime() - new Date(a.timeSet).getTime(),
  );
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
      rankedPlayCount: player.scoreStats?.rankedPlayCount ?? ranked.length,
    },
    summary: {
      averageAccuracy: accuracies.length
        ? round(accuracies.reduce((a, b) => a + b, 0) / accuracies.length)
        : 0,
      bestAccuracy: accuracies.length ? round(Math.max(...accuracies)) : 0,
      bestPp: ranked.length ? ranked[0].pp : 0,
      rankedMapCount: ranked.length,
    },
    top30: top.slice(0, 30),
    top50: top.slice(0, 50),
    recent: recent.slice(0, 20),
    starBuckets: groupByStar(ranked),
    refreshCandidates: makeRefreshCandidates(top, 10),
    tryCandidates: makeTryCandidates(
      top,
      rankedLeaderboards,
      player.pp ?? 0,
      500,
    ),
    onePpCandidates: makeOnePpEfficiencyCandidates(top, 10),
    oldCandidates: makeOldCandidates(top, 10),
    ppRecords: ranked.map((score) => score.pp).filter((pp) => pp > 0),
    ppNotice:
      "추천곡의 추정 PP와 예상 증가량은 ScoreSaber PP 커브 기반 계산값이며, 실제 ScoreSaber 반영 PP와 다를 수 있습니다.",
  };
}
