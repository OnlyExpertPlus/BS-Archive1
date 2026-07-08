import { NextRequest, NextResponse } from 'next/server';
import { getPlayer, getPlayerScoresPage, resolvePlayerId, scoreAccuracy } from '@/lib/scoresaber';

export const runtime = 'nodejs';

function round(value: number, digits = 2) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

export async function GET(request: NextRequest) {
  try {
    const input = request.nextUrl.searchParams.get('player') ?? '';
    const playerId = await resolvePlayerId(input);
    if (!playerId) return NextResponse.json({ error: 'ScoreSaber ID, 커스텀 ID 또는 프로필 URL을 입력해 주세요.' }, { status: 400 });

    const [player, first] = await Promise.all([
      getPlayer(playerId),
      getPlayerScoresPage(playerId, 'top', 100, 1)
    ]);
    const all = [...first.scores];
    const limit = 100;
    const maxPages = Math.min(300, Math.max(1, Number(request.nextUrl.searchParams.get('maxPages') ?? 120)));
    const total = first.metadata?.total ?? first.scores.length;
    const itemsPerPage = first.metadata?.itemsPerPage ?? limit;
    const totalPages = Math.min(maxPages, Math.max(1, Math.ceil(total / itemsPerPage)));
    let pagesLoaded = 1;

    for (let page = 2; page <= totalPages; page += 1) {
      const next = await getPlayerScoresPage(playerId, 'top', limit, page);
      pagesLoaded = page;
      if (!next.scores.length) break;
      all.push(...next.scores);
    }

    const records = all
      .filter((s) => s.leaderboard?.ranked && s.leaderboard?.id)
      .map((s) => {
        const stableScoreId = s.id ?? `${s.leaderboard.id}-${s.timeSet ?? ''}-${s.modifiedScore ?? s.baseScore ?? 0}`;
        return {
          id: `ss-${playerId}-${stableScoreId}`,
          scoreId: s.id !== undefined ? String(s.id) : undefined,
          playerId,
          playerName: player.name,
          mapId: String(s.leaderboard.id),
          acc: round(scoreAccuracy(s)),
          score: s.modifiedScore ?? s.baseScore ?? 0,
          pp: round(s.pp ?? 0),
          rightHandAvg: undefined,
          leftHandAvg: undefined,
          handAvgSource: null,
          fullCombo: Boolean(s.fullCombo),
          memo: 'ScoreSaber에서 가져온 기록',
          createdAt: s.timeSet ?? new Date().toISOString(),
          source: 'scoresaber'
        };
      });

    return NextResponse.json({ records, player: { id: playerId, name: player.name, profilePicture: player.profilePicture }, metadata: { total, loaded: records.length, pagesLoaded, targetPages: totalPages } });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'ScoreSaber 기록을 가져오지 못했습니다.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
