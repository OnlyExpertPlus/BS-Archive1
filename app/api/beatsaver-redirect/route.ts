import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

type BeatSaverMap = {
  id?: string;
  key?: string;
};

export async function GET(request: NextRequest) {
  const hash = request.nextUrl.searchParams.get('hash')?.trim();
  if (!hash) return NextResponse.redirect('https://beatsaver.com');

  try {
    const res = await fetch(`https://api.beatsaver.com/maps/hash/${encodeURIComponent(hash)}`, {
      next: { revalidate: 86400 }
    });

    if (!res.ok) return NextResponse.redirect(`https://beatsaver.com/search?q=${encodeURIComponent(hash)}`);

    const data = await res.json() as BeatSaverMap;
    const key = data.id ?? data.key;
    if (key) return NextResponse.redirect(`https://beatsaver.com/maps/${encodeURIComponent(key)}`);

    return NextResponse.redirect(`https://beatsaver.com/search?q=${encodeURIComponent(hash)}`);
  } catch {
    return NextResponse.redirect(`https://beatsaver.com/search?q=${encodeURIComponent(hash)}`);
  }
}
