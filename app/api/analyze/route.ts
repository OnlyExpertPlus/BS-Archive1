import { NextRequest, NextResponse } from 'next/server';
import { analyze } from '@/lib/analyze';
import { getPlayer, getPlayerScores, getRankedLeaderboardsPage, resolvePlayerId } from '@/lib/scoresaber';

export async function GET(request: NextRequest) {
  try {
    const input = request.nextUrl.searchParams.get('player') ?? '';
    const playerId = await resolvePlayerId(input);

    if (!playerId) {
      return NextResponse.json({ error: 'ScoreSaber ID, 커스텀 ID 또는 프로필 URL을 입력해 주세요.' }, { status: 400 });
    }

    const [player, topScores, recentScores] = await Promise.all([
      getPlayer(playerId),
      getPlayerScores(playerId, 'top', 100, 1),
      getPlayerScores(playerId, 'recent', 50, 1)
    ]);

    const rankedPages = await Promise.all(
      Array.from({ length: 35 }, (_, index) => getRankedLeaderboardsPage(index + 1, 100).catch(() => ({ leaderboards: [] })))
    );
    const rankedLeaderboards = rankedPages.flatMap((page) => page.leaderboards);

    return NextResponse.json({ ...analyze(player, topScores, recentScores, rankedLeaderboards), resolvedPlayerId: playerId, input });
  } catch (error) {
    const message = error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
