"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";

type AnalyzedScore = {
  scoreId?: string;
  leaderboardId?: number;
  songHash?: string;
  song: string;
  mapper: string;
  difficulty: string;
  stars: number;
  accuracy: number;
  pp: number;
  score?: number;
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

type TargetCandidate = AnalyzedScore & {
  targetDelta: number;
  targetAccuracy: number;
  targetPp: number;
  estimatedGainPp: number;
  pp: number;
  reasons: string[];
};

type Analysis = {
  resolvedPlayerId?: string;
  input?: string;
  player: {
    id?: string | number;
    name: string;
    profilePicture?: string;
    pp: number;
    rank: number;
    countryRank: number;
    country?: string;
    rankedPlayCount: number;
  };
  summary: {
    averageAccuracy: number;
    bestAccuracy: number;
    bestPp: number;
    rankedMapCount: number;
  };
  top30: AnalyzedScore[];
  top50: AnalyzedScore[];
  recent: AnalyzedScore[];
  starBuckets: {
    star: number;
    count: number;
    averageAccuracy: number;
    averagePp: number;
  }[];
  refreshCandidates: AnalyzedScore[];
  tryCandidates: AnalyzedScore[];
  onePpCandidates: AnalyzedScore[];
  oldCandidates: AnalyzedScore[];
  ppRecords?: number[];
  ppNotice: string;
};

type Tier = {
  name: string;
  group:
    | "iron"
    | "bronze"
    | "silver"
    | "gold"
    | "platinum"
    | "diamond"
    | "master"
    | "champion"
    | "grandChampion"
    | "legend";
};

const LAST_ANALYSIS_KEY = "bs-archive-last-analysis-v7";
const LAST_INPUT_KEY = "bs-archive-last-player-input-v7";

const tiers: Array<Tier & { min: number; max: number }> = [
  { name: "IRON III", group: "iron", min: 0, max: 1999 },
  { name: "IRON II", group: "iron", min: 2000, max: 2999 },
  { name: "IRON I", group: "iron", min: 3000, max: 3999 },
  { name: "BRONZE III", group: "bronze", min: 4000, max: 4999 },
  { name: "BRONZE II", group: "bronze", min: 5000, max: 5999 },
  { name: "BRONZE I", group: "bronze", min: 6000, max: 6999 },
  { name: "SILVER III", group: "silver", min: 7000, max: 7999 },
  { name: "SILVER II", group: "silver", min: 8000, max: 8999 },
  { name: "SILVER I", group: "silver", min: 9000, max: 9999 },
  { name: "GOLD III", group: "gold", min: 10000, max: 10599 },
  { name: "GOLD II", group: "gold", min: 10600, max: 11199 },
  { name: "GOLD I", group: "gold", min: 11200, max: 11799 },
  { name: "PLATINUM III", group: "platinum", min: 11800, max: 12399 },
  { name: "PLATINUM II", group: "platinum", min: 12400, max: 12999 },
  { name: "PLATINUM I", group: "platinum", min: 13000, max: 13499 },
  { name: "DIAMOND III", group: "diamond", min: 13500, max: 13999 },
  { name: "DIAMOND II", group: "diamond", min: 14000, max: 14499 },
  { name: "DIAMOND I", group: "diamond", min: 14500, max: 14999 },
  { name: "MASTER", group: "master", min: 15000, max: 15999 },
  { name: "CHAMPION", group: "champion", min: 16000, max: 16999 },
  { name: "GRAND CHAMPION", group: "grandChampion", min: 17000, max: 17999 },
  {
    name: "LEGEND",
    group: "legend",
    min: 18000,
    max: Number.POSITIVE_INFINITY,
  },
];

function getTier(pp: number): Tier {
  return tiers.find((t) => pp >= t.min && pp <= t.max) ?? tiers[0];
}

function dateText(value: string) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("ko-KR");
}

function clientDaysSince(value?: string | null) {
  if (!value) return Number.POSITIVE_INFINITY;
  const time = new Date(value).getTime();
  if (Number.isNaN(time)) return Number.POSITIVE_INFINITY;
  return Math.max(0, (Date.now() - time) / 86400000);
}


function oldAgeLabel(minDays: number, maxDays: number | null) {
  if (minDays === 7 && maxDays === 30) return "1주~1달";
  if (minDays === 30 && maxDays === 90) return "1달~3달";
  if (minDays === 90 && maxDays === 180) return "3달~6달";
  if (minDays === 180 && maxDays === 365) return "6달~1년";
  return "1년 이상";
}

function isInOldAgeRange(value: string | undefined, minDays: number, maxDays: number | null) {
  const days = clientDaysSince(value);
  if (!Number.isFinite(days)) return false;
  if (maxDays === null) return days >= minDays;
  return days >= minDays && days < maxDays;
}

function difficultyClass(difficulty: string) {
  const key = difficulty.toLowerCase().replace(/\s|\+/g, "");
  if (key === "easy") return "diffEasy";
  if (key === "normal") return "diffNormal";
  if (key === "hard") return "diffHard";
  if (key === "expert") return "diffExpert";
  return "diffExpertPlus";
}

function difficultyText(difficulty: string) {
  return difficulty === "ExpertPlus" ? "Expert+" : difficulty;
}

function safeFileName(value: string) {
  return value
    .replace(/[\\/:*?"<>|]/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

function downloadPlaylist(title: string, scores: AnalyzedScore[]) {
  const seen = new Set<string>();
  const songs = scores
    .filter((score) => score.songHash)
    .filter((score) => {
      const key = score.songHash!.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map((score) => ({
      hash: score.songHash,
      songName: score.song,
      levelAuthorName: score.mapper,
    }));

  if (!songs.length) return;

  const playlist = {
    playlistTitle: `BS-Archive - ${title}`,
    playlistAuthor: "BS-Archive",
    playlistDescription:
      "BS-Archive 추천곡으로 만든 Beat Saber 플레이리스트입니다. 추천 PP와 증가량은 추정값일 수 있습니다.",
    songs,
  };

  const blob = new Blob([JSON.stringify(playlist, null, 2)], {
    type: "application/json;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${safeFileName(`bs-archive-${title}`)}.bplist`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function RecommendationCard({
  score,
  index,
  mode,
}: {
  score: AnalyzedScore;
  index: number;
  mode: "refresh" | "try" | "old" | "onepp";
}) {
  const gainText =
    score.estimatedGainPp && score.estimatedGainPp > 0
      ? ` · 예상 증가 +${score.estimatedGainPp.toFixed(2)}pp`
      : "";
  const valueLine =
    mode === "try"
      ? `예상 기준 ${score.targetAccuracy ? `${score.targetAccuracy}%` : "-"} · 추정 ${score.pp ? `약 ${Math.round(score.pp)}pp` : `${score.stars.toFixed(2)}★`}${gainText}`
      : mode === "onepp"
        ? `현재 ${score.accuracy.toFixed(2)}% → +1pp 기준 ${score.targetAccuracy ?? "-"}% · +${score.onePpAccGain ?? "-"}%p`
        : `현재 ${score.accuracy.toFixed(2)}%${score.targetAccuracy ? ` → 목표 ${score.targetAccuracy}%` : ""} · ${score.pp ? `${score.pp.toFixed(2)}pp` : "PP -"}${score.targetPp ? ` → 추정 ${Math.round(score.targetPp)}pp` : ""}${gainText}`;

  return (
    <article className="recommendTile">
      <span className="rankBadge soft">#{index + 1}</span>
      <div className="recommendCover">
        {score.coverImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={score.coverImage} alt="" />
        ) : (
          <div className="coverFallback">♪</div>
        )}
      </div>
      <div className="recommendBody">
        <b>{score.song}</b>
        <p>
          <span
            className={`difficultyText ${difficultyClass(score.difficulty)}`}
          >
            {difficultyText(score.difficulty)}
          </span>{" "}
          · {score.mapper || "-"}
        </p>
        <p className="recommendValue">{valueLine}</p>
        <p className="muted">{score.reasons?.join(" · ")}</p>
      </div>
      <div className="recommendActions">
        {score.beatsaverUrl && (
          <a href={score.beatsaverUrl} target="_blank" rel="noreferrer">
            BeatSaver
          </a>
        )}
        {score.scoresaberUrl && (
          <a href={score.scoresaberUrl} target="_blank" rel="noreferrer">
            ScoreSaber
          </a>
        )}
      </div>
    </article>
  );
}

function RecommendationSection({
  title,
  description,
  scores,
  mode,
}: {
  title: string;
  description: string;
  scores: AnalyzedScore[];
  mode: "refresh" | "try" | "old" | "onepp";
}) {
  return (
    <section className="panel recommendationPanel">
      <div className="sectionHeader recommendationListHeader">
        <div>
          <p className="eyebrow">Recommendation</p>
          <h2>{title}</h2>
          <p className="muted">{description}</p>
        </div>
        {scores.length > 0 && (
          <button
            type="button"
            className="playlistButton"
            onClick={() => downloadPlaylist(title, scores)}
          >
            .bplist 저장
          </button>
        )}
      </div>
      {scores.length ? (
        <div className="recommendGrid">
          {scores.map((s, idx) => (
            <RecommendationCard
              key={`${s.song}-${s.difficulty}-${idx}`}
              score={s}
              index={idx}
              mode={mode}
            />
          ))}
        </div>
      ) : (
        <div className="emptyState">
          현재 목표 PP 증가량을 달성할 수 있는 미기록 추천곡이 없습니다. 목표 증가량을 낮추거나 기록 갱신 추천을 확인해 보세요.
        </div>
      )}
    </section>
  );
}


function clientRound(value: number, digits = 2): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

const CLIENT_STAR_PP = 42.1138;
const CLIENT_SCORE_SABER_CURVE = (
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

function clientCurveMultiplier(accRatio: number) {
  const acc = Math.max(0, Math.min(1, accRatio));
  for (let i = 0; i < CLIENT_SCORE_SABER_CURVE.length - 1; i += 1) {
    const [x1, y1] = CLIENT_SCORE_SABER_CURVE[i];
    const [x2, y2] = CLIENT_SCORE_SABER_CURVE[i + 1];
    if (acc >= x1 && acc <= x2) {
      if (x1 === x2) return y1;
      const t = (acc - x1) / (x2 - x1);
      return y1 + (y2 - y1) * t;
    }
  }
  return acc <= 0 ? 0 : CLIENT_SCORE_SABER_CURVE[CLIENT_SCORE_SABER_CURVE.length - 1][1];
}

function clientScoreSaberPp(stars: number, accPercent: number) {
  if (!stars || stars <= 0 || !accPercent || accPercent <= 0) return 0;
  return clientRound(stars * CLIENT_STAR_PP * clientCurveMultiplier(accPercent / 100), 2);
}

function clientWeightedTotal(pps: number[]) {
  return pps
    .filter((pp) => Number.isFinite(pp) && pp > 0)
    .sort((a, b) => b - a)
    .reduce((sum, pp, index) => sum + pp * Math.pow(0.965, index), 0);
}

function clientGainIfAdded(currentPps: number[], candidatePp: number) {
  if (!candidatePp || candidatePp <= 0 || !currentPps.length) return 0;
  const base = currentPps
    .filter((pp) => Number.isFinite(pp) && pp > 0)
    .sort((a, b) => b - a);
  const limit = base.length;
  const next = [...base, candidatePp].sort((a, b) => b - a).slice(0, limit);
  return clientRound(clientWeightedTotal(next) - clientWeightedTotal(base), 2);
}

function buildTargetCandidate(
  score: AnalyzedScore,
  targetGain: number,
  currentPps: number[],
): TargetCandidate | null {
  if (!score.stars || !currentPps.length) return null;

  const baseAcc = Math.max(82, Math.min(99.9, score.targetAccuracy ?? 90));
  const maxAcc = 99.9;
  const maxPp = clientScoreSaberPp(score.stars, maxAcc);
  const maxGain = clientGainIfAdded(currentPps, maxPp);
  const minimumUsefulGain = Math.max(1, targetGain - 1);

  if (maxGain < minimumUsefulGain) return null;

  let low = baseAcc;
  let high = maxAcc;
  for (let i = 0; i < 28; i += 1) {
    const mid = (low + high) / 2;
    const midGain = clientGainIfAdded(currentPps, clientScoreSaberPp(score.stars, mid));
    if (midGain >= targetGain) high = mid;
    else low = mid;
  }

  const targetAccuracy = clientRound(high, 2);
  const targetPp = clientScoreSaberPp(score.stars, targetAccuracy);
  const estimatedGainPp = clientGainIfAdded(currentPps, targetPp);
  if (estimatedGainPp < 1) return null;

  const delta = clientRound(estimatedGainPp - targetGain, 1);
  const sign = delta > 0 ? "+" : "";

  return {
    ...score,
    targetAccuracy,
    pp: targetPp,
    targetPp,
    estimatedGainPp,
    targetDelta: Math.abs(delta),
    reasons: [
      ...((score.reasons ?? []).filter((reason) => !reason.startsWith("목표 "))),
      `목표 ${targetGain}pp 대비 ${sign}${delta}pp`,
    ],
  };
}

function targetFilteredScores(
  scores: AnalyzedScore[],
  targetGain: number,
  currentPps: number[],
) {
  return scores
    .map((score) => buildTargetCandidate(score, targetGain, currentPps))
    .filter((score): score is TargetCandidate => score !== null)
    .sort(
      (a, b) =>
        a.targetDelta - b.targetDelta ||
        (a.targetAccuracy ?? 100) - (b.targetAccuracy ?? 100) ||
        (b.estimatedGainPp ?? 0) - (a.estimatedGainPp ?? 0),
    );
}

function getDefaultTargetGain(totalPp: number) {
  if (totalPp <= 10000) return 3;
  if (totalPp <= 13000) return 5;
  if (totalPp <= 15000) return 8;
  if (totalPp <= 16000) return 10;
  if (totalPp <= 17000) return 12;
  return 15;
}


function getWarmupStarRange(totalPp: number) {
  if (totalPp >= 17000) return { min: 10, max: 11 };
  if (totalPp >= 15000) return { min: 9, max: 11 };
  if (totalPp >= 14000) return { min: 9, max: 10.5 };
  if (totalPp >= 13000) return { min: 8, max: 9.5 };
  if (totalPp >= 11500) return { min: 7, max: 9 };
  if (totalPp >= 9000) return { min: 6, max: 8 };
  return { min: 4, max: 7 };
}

function getChallengeStarRange(totalPp: number) {
  if (totalPp >= 18000) return { min: 12, max: 15 };
  if (totalPp >= 16500) return { min: 11, max: 14.5 };
  if (totalPp >= 15000) return { min: 10.5, max: 13.8 };
  if (totalPp >= 14000) return { min: 10.2, max: 13 };
  if (totalPp >= 13000) return { min: 10.2, max: 12.5 };
  if (totalPp >= 11500) return { min: 8.8, max: 11.5 };
  if (totalPp >= 9000) return { min: 7.5, max: 10.5 };
  return { min: 5, max: 9 };
}

function inStarRange(score: AnalyzedScore, range: { min: number; max: number }) {
  return score.stars >= range.min && score.stars <= range.max;
}

type RecommendationTabKey = "refresh" | "try" | "old";

function RecommendationTabs({ analysis }: { analysis: Analysis }) {
  const [active, setActive] = useState<RecommendationTabKey>("refresh");
  const defaultTargetGain = getDefaultTargetGain(analysis.player.pp);
  const [targetGainDraft, setTargetGainDraft] = useState(defaultTargetGain);
  const [targetGain, setTargetGain] = useState<number | null>(defaultTargetGain);
  const [tryPage, setTryPage] = useState(0);
  const [refreshPage, setRefreshPage] = useState(0);
  const [oldPage, setOldPage] = useState(0);
  const [oldAgeRange, setOldAgeRange] = useState<{ min: number; max: number | null }>({ min: 90, max: 180 });

  useEffect(() => {
    const nextDefault = getDefaultTargetGain(analysis.player.pp);
    setTargetGain(nextDefault);
    setTargetGainDraft(nextDefault);
    setTryPage(0);
    setRefreshPage(0);
    setOldPage(0);
  }, [analysis.resolvedPlayerId, analysis.player.pp]);
  const tabs = useMemo(
    () => [
      {
        key: "refresh" as const,
        title: "기록 갱신 추천",
        short: "기록 갱신",
        description:
          "이미 친 곡 중에서 현재 기록 대비 갱신 여지가 커 보이는 곡입니다.",
        scores: analysis.refreshCandidates,
        mode: "refresh" as const,
      },
      {
        key: "try" as const,
        title: "미기록 추천곡",
        short: "미기록 추천",
        description:
          "아직 기록이 없는 ScoreSaber 랭크맵 중에서 현재 기록 수준 기준으로 PP 반영 가능성이 높은 곡입니다.",
        scores: analysis.tryCandidates,
        mode: "try" as const,
      },
      {
        key: "old" as const,
        title: "오래된 기록 갱신 후보",
        short: "오래된 기록",
        description:
          "90일 이상 지난 기록 중 지금 다시 치면 갱신 가능성이 있어 보이는 곡입니다.",
        scores: analysis.oldCandidates,
        mode: "old" as const,
      },
    ],
    [analysis],
  );

  const selected = tabs.find((tab) => tab.key === active) ?? tabs[0];
  const ppRecords = analysis.ppRecords?.length
    ? analysis.ppRecords
    : analysis.top50.map((score) => score.pp).filter(Boolean);
  const filteredTryScores =
    active === "try" && targetGain !== null
      ? targetFilteredScores(selected.scores, targetGain, ppRecords)
      : selected.scores;
  const filteredOldScores =
    active === "old"
      ? selected.scores.filter((score) => isInOldAgeRange(score.timeSet, oldAgeRange.min, oldAgeRange.max))
      : selected.scores;
  const refreshPageCount = Math.max(1, Math.ceil(analysis.refreshCandidates.length / 10));
  const oldPageCount = Math.max(1, Math.ceil(filteredOldScores.length / 10));
  const tryPageCount = Math.max(1, Math.ceil(filteredTryScores.length / 10));
  const safeTryPage = Math.min(tryPage, tryPageCount - 1);
  const safeRefreshPage = Math.min(refreshPage, refreshPageCount - 1);
  const safeOldPage = Math.min(oldPage, oldPageCount - 1);
  const visibleScores =
    active === "try" && targetGain !== null
      ? filteredTryScores.slice(safeTryPage * 10, safeTryPage * 10 + 10)
      : active === "refresh"
        ? analysis.refreshCandidates.slice(safeRefreshPage * 10, safeRefreshPage * 10 + 10)
        : active === "old"
          ? filteredOldScores.slice(safeOldPage * 10, safeOldPage * 10 + 10)
          : selected.scores.slice(0, 10);
  const visibleDescription =
    active === "try" && targetGain !== null
      ? `${selected.description} 현재 목표 +${targetGain}pp를 달성하기 위한 예상 ACC를 다시 계산해 추천합니다.`
      : active === "old"
        ? `${selected.description} 현재 기준은 ${oldAgeLabel(oldAgeRange.min, oldAgeRange.max)} 구간 기록입니다.`
        : selected.description;

  return (
    <section className="panel recommendationPanel recommendationTabsPanel">
      <div className="sectionHeader recommendationTabsHeader">
        <div>
          <p className="eyebrow">Recommendation</p>
          <h2>추천곡</h2>
          <p className="muted">
            원하는 추천 기준을 선택해서 추천 후보를 따로 확인할 수 있습니다.
          </p>
          {analysis.ppNotice && <p className="ppNotice">{analysis.ppNotice}</p>}
        </div>
      </div>
      <div
        className="recommendTabButtons"
        role="tablist"
        aria-label="추천 카테고리"
      >
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            className={active === tab.key ? "active" : ""}
            onClick={() => { setActive(tab.key); setTryPage(0); setRefreshPage(0); setOldPage(0); }}
          >
            <span>{tab.short}</span>
          </button>
        ))}
      </div>
      {active === "try" && (
        <div className="targetGainBox">
          <div>
            <b>목표 총 PP 증가량</b>
            <p>유저 PP 수준에 맞춘 기본값에서 시작하고, 슬라이더를 움직이면 추천곡이 바로 바뀝니다.</p>
          </div>
          <div className="targetGainControl">
            <input
              type="range"
              min="1"
              max="50"
              step="1"
              value={targetGainDraft}
              onChange={(e) => {
                const next = Number(e.target.value);
                setTargetGainDraft(next);
                setTargetGain(next);
                setTryPage(0);
              }}
            />
            <span>+{targetGainDraft}pp</span>
            <button
              type="button"
              onClick={() => {
                setTargetGain(defaultTargetGain);
                setTargetGainDraft(defaultTargetGain);
                setTryPage(0);
              }}
            >
              초기화
            </button>
          </div>
        </div>
      )}
      {active === "old" && (
        <div className="oldAgeControl">
          <b>오래된 기록 기준</b>
          <div>
            {[
              { label: "1주~1달", min: 7, max: 30 },
              { label: "1달~3달", min: 30, max: 90 },
              { label: "3달~6달", min: 90, max: 180 },
              { label: "6달~1년", min: 180, max: 365 },
              { label: "1년 이상", min: 365, max: null },
            ].map((item) => (
              <button
                key={`${item.min}-${item.max ?? "up"}`}
                type="button"
                className={oldAgeRange.min === item.min && oldAgeRange.max === item.max ? "active" : ""}
                onClick={() => {
                  setOldAgeRange({ min: item.min, max: item.max });
                  setOldPage(0);
                }}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      )}
      <RecommendationSection
        title={selected.title}
        description={visibleDescription}
        scores={visibleScores}
        mode={selected.mode}
      />
      {active === "try" && filteredTryScores.length > 10 && (
        <div className="candidatePager">
          <span>
            {safeTryPage + 1} / {tryPageCount} 페이지
          </span>
          <button
            type="button"
            onClick={() => setTryPage((prev) => (prev + 1) % tryPageCount)}
          >
            다른 후보 보기
          </button>
        </div>
      )}
      {active === "refresh" && analysis.refreshCandidates.length > 10 && (
        <div className="candidatePager">
          <span>
            {safeRefreshPage + 1} / {refreshPageCount} 페이지
          </span>
          <button
            type="button"
            onClick={() => setRefreshPage((prev) => (prev + 1) % refreshPageCount)}
          >
            다른 후보 보기
          </button>
        </div>
      )}
      {active === "old" && filteredOldScores.length > 10 && (
        <div className="candidatePager">
          <span>
            {safeOldPage + 1} / {oldPageCount} 페이지
          </span>
          <button
            type="button"
            onClick={() => setOldPage((prev) => (prev + 1) % oldPageCount)}
          >
            다른 후보 보기
          </button>
        </div>
      )}
    </section>
  );
}

function TopScoreCard({
  s,
  idx,
}: {
  s: AnalyzedScore;
  idx: number;
}) {
  return (
    <article
      className="mapCard topScoreCard recorded"
      key={`${s.song}-${s.difficulty}-${idx}`}
    >
      <span className="rankBadge">#{idx + 1}</span>
      <div
        className={`accSlot ${s.accuracy >= 100 ? "perfectRecord" : s.fullCombo ? "fcRecord" : "normalRecord"}`}
      >
        {s.accuracy.toFixed(2)}
      </div>
      <div className="coverWrap">
        {s.coverImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={s.coverImage} alt="" />
        ) : (
          <div className="coverFallback">♪</div>
        )}
        <span className={`starBadge ${difficultyClass(s.difficulty)}`}>
          {s.stars.toFixed(2)}★
        </span>
      </div>
      <b>{s.song}</b>
      <small>
        <span className={`difficultyText ${difficultyClass(s.difficulty)}`}>
          {difficultyText(s.difficulty)}
        </span>{" "}
        · {s.mapper}
      </small>
      <small className="ppLine">
        {s.pp.toFixed(2)}pp · {dateText(s.timeSet)}
      </small>
    </article>
  );
}


function DailyPickCard({
  label,
  score,
  note,
}: {
  label: string;
  score?: AnalyzedScore;
  note: string;
}) {
  if (!score) {
    return (
      <article className="dailyPickCard">
        <span>{label}</span>
        <b>추천 후보 없음</b>
        <p>{note}</p>
      </article>
    );
  }

  return (
    <article className="dailyPickCard">
      <span>{label}</span>
      <div className="dailyPickMain">
        <div className="dailyPickCover">
          {score.coverImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={score.coverImage} alt="" />
          ) : (
            <div className="coverFallback">♪</div>
          )}
        </div>
        <div>
          <b>{score.song}</b>
          <p>
            <span className={`difficultyText ${difficultyClass(score.difficulty)}`}>
              {difficultyText(score.difficulty)}
            </span>{" "}
            · {score.mapper || "-"}
          </p>
          <p className="muted">{note}</p>
        </div>
      </div>
    </article>
  );
}

function DailyPicks({ analysis }: { analysis: Analysis }) {
  const [rollSeed, setRollSeed] = useState(0);
  const [rolling, setRolling] = useState(false);

  const warmupRange = getWarmupStarRange(analysis.player.pp);
  const challengeRange = getChallengeStarRange(analysis.player.pp);

  const warmupPool = useMemo(() => {
    const midpoint = (warmupRange.min + warmupRange.max) / 2;
    return [...analysis.top50]
      .filter((score) => score.accuracy >= 88 && inStarRange(score, warmupRange))
      .sort(
        (a, b) =>
          Math.abs(a.stars - midpoint) - Math.abs(b.stars - midpoint) ||
          Math.abs(a.accuracy - 94.5) - Math.abs(b.accuracy - 94.5) ||
          b.pp - a.pp,
      );
  }, [analysis.top50, warmupRange.min, warmupRange.max]);

  const refreshPool = analysis.refreshCandidates;
  const challengePool = useMemo(() => {
    const target = Math.max(getDefaultTargetGain(analysis.player.pp), analysis.player.pp >= 15000 ? 10 : 6);
    const currentPps = analysis.ppRecords?.length
      ? analysis.ppRecords
      : analysis.top50.map((score) => score.pp).filter(Boolean);

    const targetBased = targetFilteredScores(analysis.tryCandidates, target, currentPps);
    const source = targetBased.length ? targetBased : analysis.tryCandidates;
    const preferredAccLimit = analysis.player.pp >= 13000 ? 96.4 : 97;

    const candidates = source
      .filter((score) => inStarRange(score, challengeRange))
      .map((score) => {
        const expectedAcc = score.targetAccuracy ?? score.accuracy;
        const highStarBonus = Math.max(0, score.stars - challengeRange.min) * 2.2;
        const accComfortBonus = Math.max(0, preferredAccLimit - expectedAcc) * 1.6;
        const ppGainBonus = (score.estimatedGainPp ?? 0) * 2.8;
        const ppValueBonus = score.pp / 140;
        const tooEasyPenalty =
          expectedAcc > preferredAccLimit && score.stars < challengeRange.min + 0.9
            ? (expectedAcc - preferredAccLimit) * 5
            : 0;
        return {
          ...score,
          challengePriority:
            ppGainBonus + ppValueBonus + highStarBonus + accComfortBonus - tooEasyPenalty,
        };
      })
      .filter((score) => {
        const expectedAcc = score.targetAccuracy ?? score.accuracy;
        return expectedAcc <= preferredAccLimit || score.stars >= challengeRange.min + 0.9;
      })
      .sort(
        (a, b) =>
          b.challengePriority - a.challengePriority ||
          (b.estimatedGainPp ?? 0) - (a.estimatedGainPp ?? 0) ||
          b.stars - a.stars,
      );

    return candidates.length ? candidates : source.filter((score) => inStarRange(score, challengeRange));
  }, [analysis, challengeRange.min, challengeRange.max]);

  function pick<T>(items: T[], offset: number) {
    if (!items.length) return undefined;
    return items[(rollSeed + offset) % items.length];
  }

  const warmup = pick(warmupPool, 0);
  const refresh = pick(refreshPool, 1);
  const challenge = pick(challengePool, 2);

  function reroll() {
    setRolling(true);
    window.setTimeout(() => {
      setRollSeed((prev) => prev + 1 + Math.floor(Math.random() * 7));
      setRolling(false);
    }, 650);
  }

  return (
    <section className={`panel dailyPicksPanel ${rolling ? "rolling" : ""}`}>
      <div className="sectionHeader">
        <div>
          <p className="eyebrow">Today</p>
          <h2>오늘의 추천 3곡</h2>
          <p className="muted">워밍업, 기록 갱신, PP 도전용으로 한 곡씩 골라봤습니다.</p>
        </div>
        <button type="button" className="playlistButton rerollButton" onClick={reroll} disabled={rolling}>
          {rolling ? "뽑는 중..." : "다시 뽑기"}
        </button>
      </div>
      <div className="dailyPickGrid">
        <DailyPickCard
          label="워밍업"
          score={warmup}
          note={warmup ? `${warmup.stars.toFixed(2)}★ · ${warmupRange.min}~${warmupRange.max}★ 워밍업 구간` : `${warmupRange.min}~${warmupRange.max}★ 기록을 더 불러오면 추천이 표시됩니다.`}
        />
        <DailyPickCard
          label="기록 갱신"
          score={refresh}
          note={refresh ? `현재 ${refresh.accuracy.toFixed(2)}% → 목표 ${refresh.targetAccuracy ?? "-"}%` : "갱신 후보가 아직 없습니다."}
        />
        <DailyPickCard
          label="PP 도전"
          score={challenge}
          note={challenge ? `${challenge.stars.toFixed(2)}★ · 목표권 추정 ${Math.round(challenge.pp)}pp · 예상 ${challenge.targetAccuracy ?? challenge.accuracy}%` : `${challengeRange.min}~${challengeRange.max}★ 도전 후보가 아직 없습니다.`}
        />
      </div>
    </section>
  );
}


export default function HomePage() {
  const [player, setPlayer] = useState("");
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [exporting, setExporting] = useState(false);
  const boardExportRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    // 메인 입력창은 처음 들어왔을 때 빈칸으로 둡니다.
    // 최근 분석 결과는 같은 탭에서 기록 저장소를 오갔을 때만 복원합니다.
    const sessionAnalysis = sessionStorage.getItem(LAST_ANALYSIS_KEY);
    if (sessionAnalysis) {
      try {
        setAnalysis(JSON.parse(sessionAnalysis));
      } catch {
        sessionStorage.removeItem(LAST_ANALYSIS_KEY);
      }
    }
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch(
        `/api/analyze?player=${encodeURIComponent(player)}`,
      );
      const data = await res.json();
      if (!res.ok)
        throw new Error(data.error ?? "분석 중 오류가 발생했습니다.");
      setAnalysis(data);
      localStorage.setItem(LAST_INPUT_KEY, player);
      // 분석 결과 전체는 용량이 커질 수 있어 같은 탭 복원용 sessionStorage에만 저장합니다.
      // 기록 저장소 자동 연결도 이 sessionStorage 값만 사용하므로, 새 접속 시 화면이 깨끗하게 시작됩니다.
      sessionStorage.setItem(LAST_ANALYSIS_KEY, JSON.stringify(data));
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleExportTop30Image() {
    if (!analysis || !boardExportRef.current) return;
    setExporting(true);
    setError("");
    try {
      const { toPng } = await import("html-to-image");
      const dataUrl = await toPng(boardExportRef.current, {
        cacheBust: true,
        pixelRatio: 2,
        backgroundColor: "#070a13",
      });
      const link = document.createElement("a");
      const playerId = String(analysis.resolvedPlayerId ?? analysis.player.id ?? analysis.player.name);
      link.href = dataUrl;
      link.download = `${safeFileName(`bs-archive-top30-${playerId}`)}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      setError(
        err instanceof Error
          ? `이미지 저장 중 오류가 발생했습니다. ${err.message}`
          : "이미지 저장 중 오류가 발생했습니다.",
      );
    } finally {
      setExporting(false);
    }
  }

  const tier = analysis ? getTier(analysis.player.pp) : null;

  return (
    <main className="page">
      <nav className="topNav">
        <Link className="logoMark" href="/">
          BS-Analyzer
        </Link>
        <div>
          <a href="#analyze">Dashboard</a>
          <Link href="/logbook">BS-Archive</Link>
          <Link href="/intro">소개</Link>
        </div>
      </nav>

      <header className="hero heroV7">
        <div className="heroMain">
          <h1 className="brandTitle">Dashboard</h1>
          <p className="heroText">
            ScoreSaber 기록을 분석해 성과표, 추천곡, 난이도별 통계를 한눈에
            정리해주는 한국어 비트세이버 분석 대시보드입니다.
          </p>
          <form id="analyze" onSubmit={handleSubmit} className="heroSearch">
            <input
              value={player}
              onChange={(e) => setPlayer(e.target.value)}
              placeholder="ScoreSaber ID, 커스텀 ID, 또는 프로필 URL 입력"
            />
            <button disabled={loading}>
              {loading ? "분석 중..." : "분석하기"}
            </button>
          </form>
          {error && <p className="error">{error}</p>}
        </div>
      </header>

      {!analysis && (
        <section className="introCards">
          <article>
            <b>성과표 분석</b>
            <p>총 PP, 랭킹, 평균 ACC와 Top 30 기록을 카드형으로 정리합니다.</p>
          </article>
          <article>
            <b>추천곡 제안</b>
            <p>갱신 후보, 미기록 추천곡, 오래된 기록을 탭으로 보여줍니다.</p>
          </article>
          <article>
            <b>BS-Archive</b>
            <p>
              브라우저에 유저별 기록을 분리 저장하고 L/R 평균 컷, 메모, JSON 백업을 지원합니다.
            </p>
          </article>
        </section>
      )}

      {analysis && tier && (
        <>
          <section className="panel profilePanel profilePanelTop">
            <div className="playerIdentity">
              <div className="avatarWrap">
                {analysis.player.profilePicture ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={analysis.player.profilePicture} alt="" />
                ) : (
                  <span>{analysis.player.name.slice(0, 1).toUpperCase()}</span>
                )}
              </div>
              <div>
                <p className="eyebrow">최근 분석 유지 중</p>
                <div className="playerNameLine">
                  <h2>{analysis.player.name}</h2>
                  <span className={`tierBadge tier-${tier.group}`}>
                    {tier.name}
                  </span>
                </div>
                <p>
                  {analysis.player.country ?? "-"} · ID{" "}
                  {analysis.resolvedPlayerId ?? analysis.player.id ?? "-"} ·
                  랭크맵 플레이{" "}
                  {analysis.player.rankedPlayCount.toLocaleString()}회
                </p>
              </div>
            </div>
          </section>

          <section className="grid cards5">
            <article className="statCard">
              <span>총 PP</span>
              <strong>{analysis.player.pp.toLocaleString()}</strong>
            </article>
            <article className="statCard">
              <span>글로벌 랭킹</span>
              <strong>#{analysis.player.rank?.toLocaleString()}</strong>
            </article>
            <article className="statCard">
              <span>국가 랭킹</span>
              <strong>#{analysis.player.countryRank?.toLocaleString()}</strong>
            </article>
            <article className="statCard">
              <span>평균 정확도</span>
              <strong>{analysis.summary.averageAccuracy}%</strong>
            </article>
            <article className="statCard">
              <span>Top PP</span>
              <strong>{analysis.summary.bestPp.toLocaleString()}pp</strong>
            </article>
          </section>

          <DailyPicks analysis={analysis} />

          <RecommendationTabs analysis={analysis} />

          <section className="panel">
            <div className="sectionHeader">
              <div>
                <p className="eyebrow">Achievement Board</p>
                <h2>Top 30 성과표</h2>
                <p className="muted">
                  ScoreSaber 실제 PP 기준 Top 30 기록입니다.
                </p>
              </div>
              <button
                type="button"
                className="playlistButton"
                onClick={handleExportTop30Image}
                disabled={exporting}
              >
                {exporting ? "이미지 생성 중..." : "성과표 PNG 저장"}
              </button>
            </div>
            <div className="topScoreGrid">
              {analysis.top30.map((s, idx) => (
                <TopScoreCard s={s} idx={idx} key={`${s.song}-${s.difficulty}-${idx}`} />
              ))}
            </div>
          </section>

          <div className="boardExportRoot" aria-hidden="true">
            <div className="boardExportCanvas" ref={boardExportRef}>
              <div className="boardExportIntro">
                <div className="boardExportBrand">BS-Archive Top 30 Board</div>
                <div className="boardExportDate">Generated {new Date().toLocaleDateString("ko-KR")}</div>
              </div>
              <div className="boardExportHeader">
                <div className="boardExportIdentity">
                  <div className="boardExportAvatar">
                    {analysis.player.profilePicture ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={analysis.player.profilePicture} alt="" />
                    ) : (
                      <span>{analysis.player.name.slice(0, 1).toUpperCase()}</span>
                    )}
                  </div>
                  <div>
                    <div className="boardExportNameLine">
                      <h2>{analysis.player.name}</h2>
                      <span className={`tierBadge tier-${tier.group}`}>
                        {tier.name}
                      </span>
                    </div>
                    <p>
                      {analysis.player.country ?? "-"} · ID {analysis.resolvedPlayerId ?? analysis.player.id ?? "-"}
                    </p>
                    <p>
                      랭크맵 플레이 {analysis.player.rankedPlayCount.toLocaleString()}회 · Top 30 성과표
                    </p>
                  </div>
                </div>
                <div className="boardExportStats">
                  <div>
                    <span>총 PP</span>
                    <strong>{analysis.player.pp.toLocaleString()}</strong>
                  </div>
                  <div>
                    <span>글로벌</span>
                    <strong>#{analysis.player.rank?.toLocaleString()}</strong>
                  </div>
                  <div>
                    <span>국가</span>
                    <strong>#{analysis.player.countryRank?.toLocaleString()}</strong>
                  </div>
                  <div>
                    <span>평균 ACC</span>
                    <strong>{analysis.summary.averageAccuracy}%</strong>
                  </div>
                  <div>
                    <span>Top PP</span>
                    <strong>{analysis.summary.bestPp.toFixed(2)}pp</strong>
                  </div>
                </div>
              </div>
              <div className="boardExportTopGrid">
                {analysis.top30.map((s, idx) => (
                  <TopScoreCard s={s} idx={idx} key={`export-${s.song}-${s.difficulty}-${idx}`} />
                ))}
              </div>
            </div>
          </div>

          <section className="grid twoCols">
            <div className="panel">
              <h2>난이도 구간별 기록 통계</h2>
              <table>
                <thead>
                  <tr>
                    <th>구간</th>
                    <th>기록 수</th>
                    <th>평균 ACC</th>
                    <th>평균 PP</th>
                  </tr>
                </thead>
                <tbody>
                  {analysis.starBuckets.map((b) => (
                    <tr key={b.star}>
                      <td>{b.star}★대</td>
                      <td>{b.count}</td>
                      <td>{b.averageAccuracy}%</td>
                      <td>{b.averagePp}pp</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="panel">
              <h2>최근 기록</h2>
              <table>
                <thead>
                  <tr>
                    <th>날짜</th>
                    <th>곡</th>
                    <th>ACC</th>
                    <th>PP</th>
                  </tr>
                </thead>
                <tbody>
                  {analysis.recent.slice(0, 10).map((s, idx) => (
                    <tr key={`${s.song}-${idx}`}>
                      <td>{dateText(s.timeSet)}</td>
                      <td>{s.song}</td>
                      <td>{s.accuracy}%</td>
                      <td>{s.pp}pp</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </main>
  );
}
