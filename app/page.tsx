'use client';

import Link from 'next/link';
import { FormEvent, useState } from 'react';

type AnalyzedScore = {
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
  targetAccuracy?: number;
  reasons?: string[];
};

type Analysis = {
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
  starBuckets: { star: number; count: number; averageAccuracy: number; averagePp: number }[];
  refreshCandidates: AnalyzedScore[];
  ppNotice: string;
};

type Tier = {
  name: string;
  group: 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond' | 'master' | 'grandmaster';
};

const tiers: Array<Tier & { min: number; max: number }> = [
  { name: 'Bronze IV', group: 'bronze', min: 0, max: 1999 },
  { name: 'Bronze III', group: 'bronze', min: 2000, max: 3999 },
  { name: 'Bronze II', group: 'bronze', min: 4000, max: 4999 },
  { name: 'Bronze I', group: 'bronze', min: 5000, max: 5999 },
  { name: 'Silver IV', group: 'silver', min: 6000, max: 6999 },
  { name: 'Silver III', group: 'silver', min: 7000, max: 7999 },
  { name: 'Silver II', group: 'silver', min: 8000, max: 8999 },
  { name: 'Silver I', group: 'silver', min: 9000, max: 9999 },
  { name: 'Gold IV', group: 'gold', min: 10000, max: 10799 },
  { name: 'Gold III', group: 'gold', min: 10800, max: 11599 },
  { name: 'Gold II', group: 'gold', min: 11600, max: 12399 },
  { name: 'Gold I', group: 'gold', min: 12400, max: 12999 },
  { name: 'Platinum IV', group: 'platinum', min: 13000, max: 13499 },
  { name: 'Platinum III', group: 'platinum', min: 13500, max: 13999 },
  { name: 'Platinum II', group: 'platinum', min: 14000, max: 14499 },
  { name: 'Platinum I', group: 'platinum', min: 14500, max: 14999 },
  { name: 'Diamond III', group: 'diamond', min: 15000, max: 15299 },
  { name: 'Diamond II', group: 'diamond', min: 15300, max: 15599 },
  { name: 'Diamond I', group: 'diamond', min: 15600, max: 15999 },
  { name: 'Master III', group: 'master', min: 16000, max: 16299 },
  { name: 'Master II', group: 'master', min: 16300, max: 16599 },
  { name: 'Master I', group: 'master', min: 16600, max: 16999 },
  { name: 'Grandmaster', group: 'grandmaster', min: 17000, max: Number.POSITIVE_INFINITY }
];

function getTier(pp: number): Tier {
  return tiers.find((t) => pp >= t.min && pp <= t.max) ?? tiers[0];
}

function dateText(value: string) {
  if (!value) return '-';
  return new Date(value).toLocaleDateString('ko-KR');
}

function difficultyClass(difficulty: string) {
  const key = difficulty.toLowerCase().replace(/\s|\+/g, '');
  if (key === 'easy') return 'diffEasy';
  if (key === 'normal') return 'diffNormal';
  if (key === 'hard') return 'diffHard';
  if (key === 'expert') return 'diffExpert';
  return 'diffExpertPlus';
}

function difficultyText(difficulty: string) {
  return difficulty === 'ExpertPlus' ? 'Expert+' : difficulty;
}

export default function HomePage() {
  const [player, setPlayer] = useState('');
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    setAnalysis(null);

    try {
      const res = await fetch(`/api/analyze?player=${encodeURIComponent(player)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? '분석 중 오류가 발생했습니다.');
      setAnalysis(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  }

  const tier = analysis ? getTier(analysis.player.pp) : null;

  return (
    <main className="page">
      <header className="hero">
        <div>
          <p className="eyebrow">비트세이버 기록 저장소</p>
          <h1 className="brandTitle">BS-Archive</h1>
          <p className="brandSub">비트세이버 기록 저장소</p>
          <p className="heroText">ScoreSaber 기록을 가져와 성과표, 약점, 갱신 후보를 보여주는 한국어 비트세이버 기록 분석기입니다.</p>
        </div>
        <div className="heroActions">
          <Link className="navButton" href="/intro">소개</Link>
          <Link className="navButton" href="/logbook">랭크맵 기록장</Link>
        </div>
      </header>

      <section className="panel">
        <form onSubmit={handleSubmit} className="searchForm">
          <input
            value={player}
            onChange={(e) => setPlayer(e.target.value)}
            placeholder="ScoreSaber ID 또는 https://scoresaber.com/u/..."
          />
          <button disabled={loading}>{loading ? '분석 중...' : '분석하기'}</button>
        </form>
        {error && <p className="error">{error}</p>}
      </section>

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
                <p className="eyebrow">Player</p>
                <div className="playerNameLine">
                  <h2>{analysis.player.name}</h2>
                  <span className={`tierBadge tier-${tier.group}`}>{tier.name}</span>
                </div>
                <p>{analysis.player.country ?? '-'} · 랭크맵 플레이 {analysis.player.rankedPlayCount.toLocaleString()}회</p>
              </div>
            </div>
            <div className="miniStats">
              <span>최고 ACC {analysis.summary.bestAccuracy}%</span>
              <span>최고 PP {analysis.summary.bestPp}pp</span>
              <span>Top 기록 {analysis.summary.rankedMapCount}개 분석</span>
            </div>
          </section>

          <section className="grid cards4">
            <article className="statCard"><span>총 PP</span><strong>{analysis.player.pp.toLocaleString()}</strong></article>
            <article className="statCard"><span>글로벌 랭킹</span><strong>#{analysis.player.rank?.toLocaleString()}</strong></article>
            <article className="statCard"><span>국가 랭킹</span><strong>#{analysis.player.countryRank?.toLocaleString()}</strong></article>
            <article className="statCard"><span>평균 정확도</span><strong>{analysis.summary.averageAccuracy}%</strong></article>
          </section>

          <section className="panel warningPanel">
            <strong>PP 계산 안내</strong>
            <p>{analysis.ppNotice}</p>
          </section>

          <section className="panel">
            <h2>Top 30 성과표</h2>
            <p className="muted">ScoreSaber 실제 PP 기준 Top 30 기록입니다. 카드 디자인은 랭크맵 기록장과 같은 형식을 사용합니다.</p>
            <div className="topScoreGrid">
              {analysis.top30.map((s, idx) => (
                <article className="mapCard topScoreCard recorded" key={`${s.song}-${s.difficulty}-${idx}`}>
                  <span className="rankBadge">#{idx + 1}</span>
                  <div className={`accSlot ${s.accuracy >= 100 ? 'perfectRecord' : s.fullCombo ? 'fcRecord' : 'normalRecord'}`}>{s.accuracy.toFixed(2)}</div>
                  <div className="coverWrap">
                    {s.coverImage ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={s.coverImage} alt="" />
                    ) : <div className="coverFallback">♪</div>}
                    <span className={`starBadge ${difficultyClass(s.difficulty)}`}>{s.stars.toFixed(2)}★</span>
                  </div>
                  <b>{s.song}</b>
                  <small><span className={`difficultyText ${difficultyClass(s.difficulty)}`}>{difficultyText(s.difficulty)}</span> · {s.mapper}</small>
                  <small className="ppLine">{s.pp.toFixed(2)}pp · {dateText(s.timeSet)}</small>
                </article>
              ))}
            </div>
          </section>

          <section className="panel">
            <h2>갱신 추천 TOP 5</h2>
            <p className="muted">현재는 1pp 효율 계산이 아니라, Top 기록 기준으로 갱신 여지가 커 보이는 곡을 추천합니다.</p>
            <div className="recommendList">
              {analysis.refreshCandidates.map((s, idx) => (
                <article className="recommendCard" key={`${s.song}-${idx}`}>
                  <div>
                    <b>{idx + 1}. {s.song}</b>
                    <p>{s.stars}★ · {s.difficulty} · 현재 {s.accuracy}% → 목표 {s.targetAccuracy}%</p>
                    <p className="muted">{s.reasons?.join(' · ')}</p>
                  </div>
                  <span className={s.fullCombo ? 'fcPill' : 'pill'}>{s.fullCombo ? 'FC 기록' : '갱신 후보'}</span>
                </article>
              ))}
            </div>
          </section>

          <section className="grid twoCols">
            <div className="panel">
              <h2>별 개수별 약점 분석</h2>
              <table>
                <thead><tr><th>구간</th><th>기록 수</th><th>평균 ACC</th><th>평균 PP</th></tr></thead>
                <tbody>
                  {analysis.starBuckets.map((b) => (
                    <tr key={b.star}><td>{b.star}★대</td><td>{b.count}</td><td>{b.averageAccuracy}%</td><td>{b.averagePp}pp</td></tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="panel">
              <h2>최근 기록</h2>
              <table>
                <thead><tr><th>날짜</th><th>곡</th><th>ACC</th><th>PP</th></tr></thead>
                <tbody>
                  {analysis.recent.slice(0, 10).map((s, idx) => (
                    <tr key={`${s.song}-${idx}`}><td>{dateText(s.timeSet)}</td><td>{s.song}</td><td>{s.accuracy}%</td><td>{s.pp}pp</td></tr>
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
