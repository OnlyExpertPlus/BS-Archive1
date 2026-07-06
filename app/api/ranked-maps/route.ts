import { NextRequest, NextResponse } from 'next/server';
import { difficultyLabel, getRankedLeaderboardsPage, ScoreSaberLeaderboard } from '@/lib/scoresaber';

export const runtime = 'nodejs';

function round(value: number, digits = 2) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function normalize(lb: ScoreSaberLeaderboard) {
  const difficulty = difficultyLabel(lb.difficulty?.difficultyRaw);
  const subtitle = lb.songSubName ? ` ${lb.songSubName}` : '';
  const id = String(lb.id ?? lb.difficulty?.leaderboardId ?? `${lb.songHash}-${lb.difficulty?.difficultyRaw}`);
  return {
    id,
    leaderboardId: Number(lb.id ?? lb.difficulty?.leaderboardId ?? 0),
    songHash: lb.songHash ?? '',
    title: `${lb.songName}${subtitle}`.trim(),
    songName: lb.songName,
    songSubName: lb.songSubName ?? '',
    artist: lb.songAuthorName ?? '',
    mapper: lb.levelAuthorName ?? '',
    difficulty,
    difficultyRaw: lb.difficulty?.difficultyRaw ?? '',
    stars: round(lb.stars ?? 0, 2),
    maxScore: lb.maxScore ?? 0,
    maxPP: lb.maxPP ?? 0,
    plays: lb.plays ?? 0,
    coverUrl: lb.coverImage || (lb.songHash ? `https://cdn.scoresaber.com/covers/${lb.songHash}.png` : ''),
    rankedDate: lb.rankedDate ?? null,
    createdDate: lb.createdDate ?? null
  };
}

export async function GET(request: NextRequest) {
  try {
    const limit = Math.min(100, Math.max(10, Number(request.nextUrl.searchParams.get('limit') ?? 100)));
    const requestedMaxPages = Number(request.nextUrl.searchParams.get('maxPages') ?? 2000);
    const maxPages = Math.min(3000, Math.max(1, requestedMaxPages));

    const first = await getRankedLeaderboardsPage(1, limit);
    const all = [...first.leaderboards];
    const total = first.metadata?.total ?? first.leaderboards.length;
    const itemsPerPage = first.metadata?.itemsPerPage ?? limit;
    const metadataTotalPages = total > 0 ? Math.ceil(total / itemsPerPage) : maxPages;
    const targetPages = Math.min(maxPages, Math.max(1, metadataTotalPages));
    let pagesLoaded = 1;
    let stoppedByEmptyPage = false;

    for (let page = 2; page <= targetPages; page += 1) {
      const next = await getRankedLeaderboardsPage(page, limit);
      pagesLoaded = page;
      if (!next.leaderboards.length) {
        stoppedByEmptyPage = true;
        break;
      }
      all.push(...next.leaderboards);
    }

    // 중복 제거는 곡 해시가 아니라 leaderboard id 기준. 같은 곡의 여러 난이도를 각각 보존합니다.
    const unique = new Map<string, ReturnType<typeof normalize>>();
    all
      .filter((lb) => lb.ranked && (lb.stars ?? 0) > 0)
      .map(normalize)
      .forEach((m) => unique.set(m.id, m));

    const maps = [...unique.values()].sort((a, b) => b.stars - a.stars || a.title.localeCompare(b.title));

    return NextResponse.json({
      maps,
      metadata: {
        total,
        loaded: maps.length,
        pagesLoaded,
        targetPages,
        limit,
        complete: !stoppedByEmptyPage && pagesLoaded >= targetPages && maps.length >= Math.min(total || maps.length, maps.length),
        stoppedByEmptyPage,
        lastUpdated: new Date().toISOString()
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : '랭크맵 목록을 가져오지 못했습니다.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
