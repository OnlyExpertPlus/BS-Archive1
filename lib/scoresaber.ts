export type ScoreSaberPlayer = {
  id: string;
  name: string;
  profilePicture?: string;
  country?: string;
  pp: number;
  rank: number;
  countryRank: number;
  scoreStats?: {
    totalPlayCount?: number;
    rankedPlayCount?: number;
    averageRankedAccuracy?: number;
    totalRankedScore?: number;
  };
};

export type ScoreSaberLeaderboard = {
  id: number;
  songHash?: string;
  songName: string;
  songSubName?: string;
  songAuthorName?: string;
  levelAuthorName?: string;
  difficulty: {
    leaderboardId?: number;
    difficulty?: number;
    gameMode?: string;
    difficultyRaw?: string;
  };
  maxScore?: number;
  ranked?: boolean;
  qualified?: boolean;
  loved?: boolean;
  stars?: number;
  plays?: number;
  dailyPlays?: number;
  maxPP?: number;
  coverImage?: string;
  rankedDate?: string | null;
  createdDate?: string | null;
};

export type ScoreSaberScore = {
  id?: number | string;
  rank?: number;
  baseScore?: number;
  modifiedScore?: number;
  pp?: number;
  weight?: number;
  modifiers?: string;
  multiplier?: number;
  badCuts?: number;
  missedNotes?: number;
  maxCombo?: number;
  fullCombo?: boolean;
  hmd?: number;
  timeSet?: string;
  leaderboard: ScoreSaberLeaderboard;
};

type ScoreSaberRawPlayerScore = ScoreSaberScore | {
  score?: Omit<ScoreSaberScore, 'leaderboard'>;
  leaderboard?: ScoreSaberLeaderboard;
};

export type ScoreSaberListMetadata = {
  total?: number;
  page?: number;
  itemsPerPage?: number;
};

const BASE_URL = 'https://scoresaber.com/api';
const SSR_API_URL = 'https://ssr-api.fascinated.cc';

export function extractPlayerToken(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return '';
  const withoutQuery = trimmed.split('?')[0]?.split('#')[0] ?? trimmed;
  const urlMatch = withoutQuery.match(/scoresaber\.com\/(?:u|users?|profile)\/([^/\s]+)/i);
  if (urlMatch?.[1]) return decodeURIComponent(urlMatch[1]);
  return trimmed.replace(/^@/, '');
}

export function extractPlayerId(input: string): string {
  const token = extractPlayerToken(input);
  const numeric = token.match(/\d{15,20}/);
  return numeric?.[0] ?? token;
}

function findIdDeep(value: unknown): string | null {
  if (!value || typeof value !== 'object') return null;
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findIdDeep(item);
      if (found) return found;
    }
    return null;
  }
  const record = value as Record<string, unknown>;
  for (const key of ['id', 'playerId', 'scoreSaberId', 'scoresaberId', 'steamId']) {
    const candidate = record[key];
    if ((typeof candidate === 'string' || typeof candidate === 'number') && /^\d{15,20}$/.test(String(candidate))) {
      return String(candidate);
    }
  }
  for (const key of ['player', 'user', 'data', 'result', 'results', 'players']) {
    const found = findIdDeep(record[key]);
    if (found) return found;
  }
  return null;
}

export async function resolvePlayerId(input: string): Promise<string> {
  const token = extractPlayerToken(input);
  if (!token) return '';
  if (/^\d{15,20}$/.test(token)) return token;

  const direct = await fetch(`${SSR_API_URL}/player/${encodeURIComponent(token)}`, { next: { revalidate: 60 } });
  if (direct.ok) {
    const data = await direct.json();
    const id = findIdDeep(data);
    if (id) return id;
  }

  const search = await fetch(`${SSR_API_URL}/player/search?query=${encodeURIComponent(token)}`, { next: { revalidate: 60 } });
  if (search.ok) {
    const data = await search.json();
    const id = findIdDeep(data);
    if (id) return id;
  }

  return token;
}

async function readJson<T>(url: string, message: string, revalidate = 300): Promise<T> {
  const res = await fetch(url, { next: { revalidate } });
  if (!res.ok) throw new Error(message);
  return res.json();
}

function normalizePlayerScore(item: ScoreSaberRawPlayerScore): ScoreSaberScore | null {
  const maybeWrapped = item as { score?: Omit<ScoreSaberScore, 'leaderboard'>; leaderboard?: ScoreSaberLeaderboard };
  if (maybeWrapped.score && maybeWrapped.leaderboard) {
    return { ...maybeWrapped.score, leaderboard: maybeWrapped.leaderboard };
  }

  const maybeFlat = item as ScoreSaberScore;
  if (maybeFlat.leaderboard) return maybeFlat;
  return null;
}

export async function getPlayer(playerId: string): Promise<ScoreSaberPlayer> {
  return readJson<ScoreSaberPlayer>(
    `${BASE_URL}/player/${playerId}/full`,
    'ScoreSaber 플레이어 정보를 가져오지 못했습니다. ID, 커스텀 ID 또는 URL을 확인해 주세요.',
    60
  );
}

export async function getPlayerScores(
  playerId: string,
  sort: 'top' | 'recent',
  limit = 50,
  page = 1
): Promise<ScoreSaberScore[]> {
  const data = await readJson<{ playerScores?: ScoreSaberRawPlayerScore[]; scores?: ScoreSaberRawPlayerScore[] }>(
    `${BASE_URL}/player/${playerId}/scores?sort=${sort}&limit=${limit}&page=${page}`,
    `ScoreSaber ${sort} 기록을 가져오지 못했습니다.`,
    sort === 'recent' ? 30 : 300
  );

  return (data.playerScores ?? data.scores ?? [])
    .map(normalizePlayerScore)
    .filter((score): score is ScoreSaberScore => Boolean(score));
}

export async function getPlayerScoresPage(
  playerId: string,
  sort: 'top' | 'recent',
  limit = 100,
  page = 1
): Promise<{ scores: ScoreSaberScore[]; metadata?: ScoreSaberListMetadata }> {
  const data = await readJson<{
    playerScores?: ScoreSaberRawPlayerScore[];
    scores?: ScoreSaberRawPlayerScore[];
    metadata?: ScoreSaberListMetadata;
  }>(
    `${BASE_URL}/player/${playerId}/scores?sort=${sort}&limit=${limit}&page=${page}`,
    `ScoreSaber ${sort} 기록을 가져오지 못했습니다.`,
    sort === 'recent' ? 30 : 300
  );

  const scores = (data.playerScores ?? data.scores ?? [])
    .map(normalizePlayerScore)
    .filter((score): score is ScoreSaberScore => Boolean(score));

  return { scores, metadata: data.metadata };
}

export async function getRankedLeaderboardsPage(
  page = 1,
  limit = 50
): Promise<{ leaderboards: ScoreSaberLeaderboard[]; metadata?: ScoreSaberListMetadata }> {
  const params = new URLSearchParams({
    ranked: 'true',
    withMetadata: 'true',
    page: String(page),
    limit: String(limit)
  });

  const data = await readJson<{
    leaderboards?: ScoreSaberLeaderboard[];
    metadata?: ScoreSaberListMetadata;
  }>(`${BASE_URL}/leaderboards?${params.toString()}`, 'ScoreSaber 랭크맵 목록을 가져오지 못했습니다.', 3600);

  return { leaderboards: data.leaderboards ?? [], metadata: data.metadata };
}

const ACCURACY_STAR_PP = 42.1138;
const ACCURACY_CURVE: Array<[number, number]> = [
  [0, 0],
  [0.6, 0.182232336674391],
  [0.65, 0.586601001276758],
  [0.7, 0.612556595911495],
  [0.75, 0.645180821010144],
  [0.8, 0.687226886295028],
  [0.825, 0.715046566345427],
  [0.85, 0.746229066414319],
  [0.875, 0.781693456029605],
  [0.9, 0.825756123560842],
  [0.91, 0.848837598812447],
  [0.92, 0.872871034144885],
  [0.93, 0.903999407186574],
  [0.94, 0.941736298058024],
  [0.95, 1],
  [0.955, 1.0388633331419],
  [0.96, 1.08718835738505],
  [0.965, 1.1552120359501],
  [0.97, 1.24858077599573],
  [0.9725, 1.30903330650576],
  [0.975, 1.38071027431051],
  [0.9775, 1.46647263992895],
  [0.98, 1.57024100555322],
  [0.9825, 1.69753624864754],
  [0.985, 1.85638876936471],
  [0.9875, 2.05894715905274],
  [0.99, 2.32450628214992],
  [0.99125, 2.49029057941069],
  [0.9925, 2.68566785659272],
  [0.99375, 2.9190155639255],
  [0.995, 3.2022017597338],
  [0.99625, 3.55261453375554],
  [0.9975, 3.99679360676332],
  [0.99825, 4.32502738358955],
  [0.999, 4.7154706464162],
  [0.9995, 5.01954359587479],
  [1, 5.36739428289063],
];

function accuracyFromPp(stars?: number, pp?: number): number | null {
  if (!stars || stars <= 0 || !pp || pp <= 0) return null;
  const targetMultiplier = pp / (stars * ACCURACY_STAR_PP);

  for (let i = 0; i < ACCURACY_CURVE.length - 1; i += 1) {
    const [x1, y1] = ACCURACY_CURVE[i];
    const [x2, y2] = ACCURACY_CURVE[i + 1];
    if (targetMultiplier >= y1 && targetMultiplier <= y2) {
      if (y1 === y2) return x1 * 100;
      const t = (targetMultiplier - y1) / (y2 - y1);
      return (x1 + (x2 - x1) * t) * 100;
    }
  }

  return null;
}

export function pureScoreValue(score: ScoreSaberScore): number {
  const maxScore = score.leaderboard?.maxScore ?? 0;
  const baseScore = score.baseScore ?? 0;
  const modifiedScore = score.modifiedScore ?? 0;
  const multiplier = score.multiplier ?? 1;

  if (baseScore > 0 && (!maxScore || baseScore <= maxScore)) return Math.round(baseScore);
  if (modifiedScore > 0 && multiplier > 0 && multiplier !== 1) {
    return Math.round(modifiedScore / multiplier);
  }
  return Math.round(modifiedScore || baseScore || 0);
}

export function scoreAccuracy(score: ScoreSaberScore): number {
  // 랭크 기록은 PP와 현재 별 값을 역산한 ACC를 우선 사용합니다.
  // 이렇게 하면 FS 등 modifier가 modifiedScore에 섞여 있어도 순수 ACC를 복원할 수 있습니다.
  const ppAccuracy = accuracyFromPp(score.leaderboard?.stars, score.pp);
  if (ppAccuracy !== null && Number.isFinite(ppAccuracy)) {
    return Math.min(100, Math.max(0, ppAccuracy));
  }

  const maxScore = score.leaderboard?.maxScore ?? 0;
  if (!maxScore) return 0;

  const rawScore = pureScoreValue(score);
  if (!rawScore) return 0;
  return Math.min(100, Math.max(0, (rawScore / maxScore) * 100));
}

export function difficultyLabel(raw?: string): string {
  if (!raw) return 'Unknown';
  const parts = raw.split('_').filter(Boolean);
  const label = parts.find((p) => ['Easy', 'Normal', 'Hard', 'Expert', 'ExpertPlus'].includes(p));
  return label ?? parts[0] ?? raw;
}

export function beatSaverUrl(songHash?: string) {
  return songHash ? `/api/beatsaver-redirect?hash=${encodeURIComponent(songHash)}` : '';
}

export function beatSaverDirectSearchUrl(songHash?: string) {
  return songHash ? `https://beatsaver.com/search?q=${encodeURIComponent(songHash)}` : '';
}

export function scoreSaberLeaderboardUrl(leaderboardId?: number) {
  return leaderboardId ? `https://scoresaber.com/leaderboard/${leaderboardId}` : '';
}
