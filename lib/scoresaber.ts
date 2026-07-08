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

export function scoreAccuracy(score: ScoreSaberScore): number {
  const rawScore = score.modifiedScore ?? score.baseScore ?? 0;
  const maxScore = score.leaderboard?.maxScore ?? 0;
  if (!rawScore || !maxScore) return 0;
  return (rawScore / maxScore) * 100;
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
