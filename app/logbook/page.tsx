'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

type RankedMap = {
  id: string;
  leaderboardId: number;
  songHash: string;
  title: string;
  songName: string;
  songSubName?: string;
  artist: string;
  mapper: string;
  difficulty: string;
  difficultyRaw?: string;
  stars: number;
  maxScore: number;
  maxPP?: number;
  plays?: number;
  coverUrl: string;
  rankedDate?: string | null;
  createdDate?: string | null;
};

type ManualRecord = {
  id: string;
  mapId: string;
  acc: number;
  score: number;
  pp?: number;
  rightHandAvg?: number;
  leftHandAvg?: number;
  handAvgSource?: 'ssr' | 'manual' | null;
  scoreId?: string;
  playerId?: string;
  playerName?: string;
  fullCombo: boolean;
  memo?: string;
  createdAt: string;
  source?: 'manual' | 'scoresaber';
};

type RecordForm = {
  acc: string;
  score: string;
  pp: string;
  rightHandAvg: string;
  leftHandAvg: string;
  fullCombo: boolean;
  memo: string;
};

const RECORDS_KEY_PREFIX = 'bs-archive-records-v7';
const LEGACY_RECORDS_KEY = 'b-archive-manual-records-v3';
const MAPS_KEY = 'b-archive-ranked-maps-v6-full-1';
const MAPS_META_KEY = 'b-archive-ranked-maps-meta-v6-full-1';
const LAST_ANALYSIS_KEY = 'bs-archive-last-analysis-v7';

function initialForm(): RecordForm {
  return { acc: '', score: '', pp: '', rightHandAvg: '', leftHandAvg: '', fullCombo: false, memo: '' };
}

function formFromRecord(record: ManualRecord): RecordForm {
  return {
    acc: String(record.acc ?? ''),
    score: record.score ? String(record.score) : '',
    pp: record.pp !== undefined ? String(record.pp) : '',
    rightHandAvg: record.rightHandAvg !== undefined ? String(record.rightHandAvg) : '',
    leftHandAvg: record.leftHandAvg !== undefined ? String(record.leftHandAvg) : '',
    fullCombo: record.fullCombo,
    memo: record.memo ?? ''
  };
}

function todayText(value: string) {
  return new Date(value).toLocaleDateString('ko-KR');
}

function getBucket(stars: number) {
  return Math.max(1, Math.min(15, Math.floor(stars)));
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

function recordTone(record?: ManualRecord, hasFc = false) {
  if (!record) return '';
  if (record.acc >= 100) return 'perfectRecord';
  if (hasFc || record.fullCombo) return 'fcRecord';
  return 'normalRecord';
}

function formatHand(value?: number) {
  if (value === undefined || Number.isNaN(value)) return '-';
  return value.toFixed(1);
}

function signed(value?: number, digits = 2) {
  if (value === undefined || Number.isNaN(value)) return null;
  if (value === 0) return { text: '±0', className: 'deltaSame' };
  return { text: `${value > 0 ? '+' : ''}${value.toFixed(digits)}`, className: value > 0 ? 'deltaUp' : 'deltaDown' };
}

function recordStorageKey(playerId: string) {
  return `${RECORDS_KEY_PREFIX}:${playerId || 'local'}`;
}

function keepSupplementedValue<T>(oldValue: T | undefined, newValue: T | undefined) {
  return oldValue !== undefined && oldValue !== null ? oldValue : newValue;
}

export default function LogbookPage() {
  const [activeStar, setActiveStar] = useState(14);
  const [records, setRecords] = useState<ManualRecord[]>([]);
  const [maps, setMaps] = useState<RankedMap[]>([]);
  const [selected, setSelected] = useState<RankedMap | null>(null);
  const [editingRecord, setEditingRecord] = useState<ManualRecord | null>(null);
  const [form, setForm] = useState<RecordForm>(initialForm());
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'recorded' | 'unrecorded' | 'fc'>('all');
  const [loadingMaps, setLoadingMaps] = useState(false);
  const [mapsMessage, setMapsMessage] = useState('');
  const [playerInput, setPlayerInput] = useState('');
  const [activePlayer, setActivePlayer] = useState<{ id: string; name?: string; profilePicture?: string }>(() => ({ id: 'local', name: '로컬 기록' }));
  const [importingScores, setImportingScores] = useState(false);

  useEffect(() => {
    // 처음 기록 저장소에 직접 들어오면 항상 로컬 기록으로 시작합니다.
    // 분석 화면에서 같은 탭으로 넘어온 경우에만 sessionStorage의 최근 분석 유저를 자동 연결합니다.
    const lastAnalysis = sessionStorage.getItem(LAST_ANALYSIS_KEY);
    if (lastAnalysis) {
      try {
        const parsed = JSON.parse(lastAnalysis) as { resolvedPlayerId?: string; input?: string; player?: { name?: string; profilePicture?: string } };
        if (parsed.resolvedPlayerId) {
          setPlayerInput(parsed.input || parsed.resolvedPlayerId);
          setActivePlayer({ id: parsed.resolvedPlayerId, name: parsed.player?.name, profilePicture: parsed.player?.profilePicture });
        }
      } catch {
        sessionStorage.removeItem(LAST_ANALYSIS_KEY);
      }
    }

    // 전체 랭크맵 목록은 localStorage 용량을 크게 차지하므로 캐시하지 않고 필요할 때만 불러옵니다.
    void refreshRankedMaps();
  }, []);

  useEffect(() => {
    const key = recordStorageKey(activePlayer.id);
    const savedRecords = localStorage.getItem(key) ?? (activePlayer.id === 'local' ? localStorage.getItem(LEGACY_RECORDS_KEY) : null);
    setRecords(savedRecords ? JSON.parse(savedRecords) : []);
  }, [activePlayer]);

  useEffect(() => {
    try {
      localStorage.setItem(recordStorageKey(activePlayer.id), JSON.stringify(records));
    } catch {
      setMapsMessage('브라우저 저장 공간이 부족해 기록을 저장하지 못했습니다. JSON 백업 후 오래된 캐시를 삭제해 주세요.');
    }
  }, [records, activePlayer.id]);

  async function refreshRankedMaps(maxPages = 2000) {
    setLoadingMaps(true);
    setMapsMessage('ScoreSaber 랭크맵 전체 목록을 가져오는 중입니다. 오래된 맵까지 끝까지 확인하므로 시간이 조금 걸릴 수 있습니다.');
    try {
      const res = await fetch(`/api/ranked-maps?limit=100&maxPages=${maxPages}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? '랭크맵 목록을 가져오지 못했습니다.');
      setMaps(data.maps);
      const lastUpdated = data.metadata.lastUpdated ? new Date(data.metadata.lastUpdated).toLocaleString('ko-KR') : new Date().toLocaleString('ko-KR');
      const metaText = `${data.metadata.loaded.toLocaleString()}개 · ${data.metadata.pagesLoaded}/${data.metadata.targetPages}페이지 · ${lastUpdated} 갱신`;
      try { localStorage.setItem(MAPS_META_KEY, metaText); } catch {}
      setMapsMessage(`ScoreSaber 랭크맵 캐시 완료 · ${metaText}`);
    } catch (error) {
      setMapsMessage(error instanceof Error ? error.message : '랭크맵 목록을 가져오지 못했습니다.');
    } finally {
      setLoadingMaps(false);
    }
  }

  async function importScoresFromScoreSaber() {
    if (!playerInput.trim()) {
      alert('ScoreSaber ID, 커스텀 ID 또는 프로필 URL을 입력해 주세요.');
      return;
    }
    setImportingScores(true);
    try {
      const res = await fetch(`/api/player-ranked-scores?player=${encodeURIComponent(playerInput)}&maxPages=160`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'ScoreSaber 기록을 가져오지 못했습니다.');
      const incoming = data.records as ManualRecord[];
      const nextPlayer = data.player ?? { id: incoming[0]?.playerId ?? playerInput, name: playerInput };
      const key = recordStorageKey(nextPlayer.id);
      const previousSaved = localStorage.getItem(key);
      const previous = previousSaved ? JSON.parse(previousSaved) as ManualRecord[] : [];
      const byId = new Map(previous.map((r) => [r.id, r]));

      incoming.forEach((next) => {
        const old = byId.get(next.id);
        if (!old) {
          byId.set(next.id, next);
          return;
        }

        byId.set(next.id, {
          ...old,
          acc: next.acc,
          score: next.score,
          pp: next.pp,
          createdAt: next.createdAt,
          source: next.source,
          mapId: next.mapId,
          scoreId: keepSupplementedValue(old.scoreId, next.scoreId),
          rightHandAvg: keepSupplementedValue(old.rightHandAvg, next.rightHandAvg),
          leftHandAvg: keepSupplementedValue(old.leftHandAvg, next.leftHandAvg),
          handAvgSource: keepSupplementedValue(old.handAvgSource, next.handAvgSource),
          memo: old.memo && old.memo !== 'ScoreSaber에서 가져온 기록' ? old.memo : next.memo,
          fullCombo: old.fullCombo || next.fullCombo
        });
      });

      const merged = [...byId.values()].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      try {
        localStorage.setItem(key, JSON.stringify(merged));
      } catch {
        alert('브라우저 저장 공간이 부족해 전체 기록을 저장하지 못했습니다. 일부 기록만 보이거나 저장되지 않을 수 있습니다.');
      }
      setActivePlayer(nextPlayer);
      setRecords(merged);
      alert(`ScoreSaber 기록 ${incoming.length.toLocaleString()}개를 가져왔습니다. 현재 기록 저장소가 ${nextPlayer.name ?? nextPlayer.id} 기준으로 전환되었습니다.`);
    } catch (error) {
      alert(error instanceof Error ? error.message : 'ScoreSaber 기록을 가져오지 못했습니다.');
    } finally {
      setImportingScores(false);
    }
  }


  const recordsByMap = useMemo(() => {
    const map = new Map<string, ManualRecord[]>();
    records.forEach((r) => {
      const list = map.get(r.mapId) ?? [];
      list.push(r);
      map.set(r.mapId, list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
    });
    return map;
  }, [records]);

  const availableStars = useMemo(() => {
    const buckets = new Set<number>();
    maps.forEach((m) => {
      if (m.stars > 0) buckets.add(getBucket(m.stars));
    });
    return [...buckets].sort((a, b) => b - a);
  }, [maps]);

  useEffect(() => {
    if (availableStars.length && !availableStars.includes(activeStar)) {
      setActiveStar(availableStars[0]);
    }
  }, [availableStars, activeStar]);

  const visibleMaps = useMemo(() => {
    return maps
      .filter((m) => getBucket(m.stars) === activeStar)
      .filter((m) => {
        const q = query.trim().toLowerCase();
        if (!q) return true;
        return [m.title, m.artist, m.mapper, m.songHash, String(m.leaderboardId)].some((text) => text?.toLowerCase().includes(q));
      })
      .filter((m) => {
        const list = recordsByMap.get(m.id) ?? [];
        if (filter === 'recorded') return list.length > 0;
        if (filter === 'unrecorded') return list.length === 0;
        if (filter === 'fc') return list.some((r) => r.fullCombo);
        return true;
      })
      .sort((a, b) => b.stars - a.stars || a.title.localeCompare(b.title));
  }, [activeStar, query, filter, recordsByMap, maps]);

  function bestRecord(mapId: string) {
    const list = recordsByMap.get(mapId) ?? [];
    return [...list].sort((a, b) => b.acc - a.acc || (b.pp ?? 0) - (a.pp ?? 0))[0];
  }

  function submitRecord() {
    if (!selected) return;
    const acc = Number(form.acc);
    if (Number.isNaN(acc) || acc < 0 || acc > 100) {
      alert('ACC는 0~100 사이 숫자로 입력해 주세요.');
      return;
    }

    if (editingRecord) {
      const updated: ManualRecord = {
        ...editingRecord,
        acc,
        score: Number(form.score) || 0,
        pp: form.pp ? Number(form.pp) : undefined,
        rightHandAvg: form.rightHandAvg ? Number(form.rightHandAvg) : undefined,
        leftHandAvg: form.leftHandAvg ? Number(form.leftHandAvg) : undefined,
        handAvgSource: form.rightHandAvg || form.leftHandAvg ? 'manual' : editingRecord.handAvgSource,
        fullCombo: form.fullCombo,
        memo: form.memo.trim(),
        mapId: selected.id
      };
      setRecords((prev) => prev.map((r) => (r.id === editingRecord.id ? updated : r)));
      setEditingRecord(null);
      setForm(initialForm());
      return;
    }

    const next: ManualRecord = {
      id: crypto.randomUUID(),
      mapId: selected.id,
      acc,
      score: Number(form.score) || 0,
      pp: form.pp ? Number(form.pp) : undefined,
      rightHandAvg: form.rightHandAvg ? Number(form.rightHandAvg) : undefined,
      leftHandAvg: form.leftHandAvg ? Number(form.leftHandAvg) : undefined,
      handAvgSource: form.rightHandAvg || form.leftHandAvg ? 'manual' : null,
      fullCombo: form.fullCombo,
      memo: form.memo.trim(),
      createdAt: new Date().toISOString(),
      source: 'manual'
    };

    setRecords((prev) => [next, ...prev]);
    setForm(initialForm());
  }

  function beginEditRecord(record: ManualRecord) {
    setEditingRecord(record);
    setForm(formFromRecord(record));
  }

  function cancelEdit() {
    setEditingRecord(null);
    setForm(initialForm());
  }

  function deleteRecord(id: string) {
    setRecords((prev) => prev.filter((r) => r.id !== id));
    if (editingRecord?.id === id) cancelEdit();
  }

  function exportJson() {
    const blob = new Blob([JSON.stringify({ activePlayer, records, mapsMeta: localStorage.getItem(MAPS_META_KEY) }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `beat-saber-records-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function importJson(file?: File) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        const nextRecords = Array.isArray(parsed) ? parsed : parsed.records;
        if (!Array.isArray(nextRecords)) throw new Error('형식 오류');
        if (parsed.activePlayer) setActivePlayer(parsed.activePlayer);
        setRecords(nextRecords);
      } catch {
        alert('기록 파일을 읽지 못했습니다.');
      }
    };
    reader.readAsText(file);
  }

  function closeModal() {
    setSelected(null);
    cancelEdit();
  }

  return (
    <main className="page">
      <header className="hero">
        <div>
          <h1>BS-Archive</h1>
          <p className="heroText">ScoreSaber 실제 랭크맵을 별 난이도별로 보고, ACC·점수·PP·L/R 평균 컷·FC 여부를 저장합니다.</p>
        </div>
        <Link className="navButton" href="/">Dashboard로 이동</Link>
      </header>

      <section className="panel warningPanel">
        <strong>BS-Archive 사용법</strong>
        <p>Dashboard에서 ScoreSaber ID를 분석하면 같은 탭의 BS-Archive에 해당 유저가 자동 연결됩니다. 기록 가져오기로 ScoreSaber 기록을 불러온 뒤, L/R 평균 컷·메모·FC 여부를 직접 보완할 수 있습니다. 기록은 브라우저에 유저별로 분리 저장되며, JSON 백업/복원을 지원합니다.</p>
      </section>

      <section className="panel activePlayerPanel">
        <div>
          <p className="eyebrow">현재 보고 있는 기록</p>
          <h2>{activePlayer.name ?? activePlayer.id}</h2>
          <p className="muted">저장 기준 ID: {activePlayer.id}</p>
        </div>
        <button className="ghostButton" onClick={() => setActivePlayer({ id: 'local', name: '로컬 기록' })}>로컬 기록 보기</button>
      </section>

      <section className="panel toolsPanel wideTools">
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="곡명 / 아티스트 / 매퍼 / 해시 / leaderboard ID 검색" />
        <select value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)}>
          <option value="all">전체</option>
          <option value="recorded">기록 있음</option>
          <option value="unrecorded">미기록</option>
          <option value="fc">FC 기록 있음</option>
        </select>
        <button onClick={() => refreshRankedMaps()} disabled={loadingMaps}>{loadingMaps ? '불러오는 중' : '랭크맵 전체 새로고침'}</button>
        <button onClick={exportJson}>기록 백업</button>
        <label className="fileButton">기록 복원<input type="file" accept="application/json" onChange={(e) => importJson(e.target.files?.[0])} /></label>
      </section>

      <section className="panel importPanel">
        <div>
          <strong>ScoreSaber 기록 가져오기</strong>
          <p className="muted">내 ScoreSaber ID/URL을 넣으면 Top 기록을 기록장에 가져옵니다. 이미 보완한 L/R 평균 컷과 메모는 다시 가져와도 유지됩니다.</p>
        </div>
        <input value={playerInput} onChange={(e) => setPlayerInput(e.target.value)} placeholder="분석한 ID가 자동으로 들어옵니다" />
        <button onClick={importScoresFromScoreSaber} disabled={importingScores}>{importingScores ? '가져오는 중' : '기록 가져오기'}</button>
      </section>

      {mapsMessage && <p className="muted statusText">{mapsMessage}</p>}

      <section className="starTabs">
        {availableStars.map((star) => (
          <button key={star} className={activeStar === star ? 'active' : ''} onClick={() => setActiveStar(star)}>{star}★</button>
        ))}
      </section>

      <section className="mapGrid">
        {visibleMaps.map((map) => {
          const best = bestRecord(map.id);
          const history = recordsByMap.get(map.id) ?? [];
          const hasFc = history.some((r) => r.fullCombo);
          return (
            <button key={map.id} className={`mapCard ${best ? 'recorded' : ''} ${hasFc ? 'fullCombo' : ''} ${best?.acc && best.acc >= 100 ? 'perfectCombo' : ''}`} onClick={() => setSelected(map)}>
              <div className={`accSlot ${best ? recordTone(best, hasFc) : 'emptyRecord'}`}>{best ? best.acc.toFixed(2) : '-'}</div>
              <div className="coverWrap">
                {map.coverUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={map.coverUrl} alt="" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                ) : <div className="coverFallback">♪</div>}
                <span className={`starBadge ${difficultyClass(map.difficulty)}`}>{map.stars.toFixed(2)}★</span>
              </div>
              <b>{map.title}</b>
              <small><span className={`difficultyText ${difficultyClass(map.difficulty)}`}>{difficultyText(map.difficulty)}</span> · {map.mapper}</small>
              {best?.pp !== undefined && <small className="ppLine">{best.pp.toFixed(2)}pp · {todayText(best.createdAt)}</small>}
            </button>
          );
        })}
      </section>

      {!visibleMaps.length && <section className="panel"><p className="muted">이 조건에 맞는 맵이 없습니다.</p></section>}

      {selected && (
        <div className="modalBackdrop" onClick={closeModal}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modalHeader">
              <div>
                <p className="eyebrow">{selected.stars.toFixed(2)}★ · {difficultyText(selected.difficulty)} · #{selected.leaderboardId}</p>
                <h2>{selected.title}</h2>
                <p className="muted">{selected.artist} · mapped by {selected.mapper}</p>
                <p className="muted">최대 점수 {selected.maxScore.toLocaleString()} · 최대 PP {selected.maxPP ? selected.maxPP.toFixed(2) : '-'} · 플레이 {selected.plays?.toLocaleString() ?? '-'}</p>
              </div>
              <button className="closeButton" onClick={closeModal}>닫기</button>
            </div>

            <div className="recordForm recordFormV5">
              <input value={form.acc} onChange={(e) => setForm({ ...form, acc: e.target.value })} placeholder="ACC 예: 99.83" />
              <input value={form.score} onChange={(e) => setForm({ ...form, score: e.target.value })} placeholder="점수" />
              <input value={form.pp} onChange={(e) => setForm({ ...form, pp: e.target.value })} placeholder="PP 선택 입력" />
              <input value={form.leftHandAvg} onChange={(e) => setForm({ ...form, leftHandAvg: e.target.value })} placeholder="L 평균 컷" />
              <input value={form.rightHandAvg} onChange={(e) => setForm({ ...form, rightHandAvg: e.target.value })} placeholder="R 평균 컷" />
              <label className="check"><input type="checkbox" checked={form.fullCombo} onChange={(e) => setForm({ ...form, fullCombo: e.target.checked })} /> 풀콤보</label>
              <input value={form.memo} onChange={(e) => setForm({ ...form, memo: e.target.value })} placeholder="메모" />
              <button onClick={submitRecord}>{editingRecord ? '기록 수정 저장' : '기록 추가'}</button>
              {editingRecord && <button className="ghostButton" onClick={cancelEdit}>수정 취소</button>}
            </div>

            <h3>기록 히스토리</h3>
            <div className="historyList">
              {(recordsByMap.get(selected.id) ?? []).map((r) => (
                <article key={r.id} className={`historyItem ${r.fullCombo ? 'fullCombo' : ''} ${r.acc >= 100 ? 'perfectRecord' : ''} ${editingRecord?.id === r.id ? 'editing' : ''}`}>
                  <div>
                    <b>{r.acc.toFixed(2)}%</b>
                    {(() => {
                      const list = recordsByMap.get(selected.id) ?? [];
                      const currentIndex = list.findIndex((item) => item.id === r.id);
                      const prev = currentIndex >= 0 ? list[currentIndex + 1] : undefined;
                      const accDelta = prev ? signed(r.acc - prev.acc) : null;
                      const scoreDelta = prev ? signed(r.score - prev.score, 0) : null;
                      const ppDelta = prev && r.pp !== undefined && prev.pp !== undefined ? signed(r.pp - prev.pp) : null;
                      const rDelta = prev && r.rightHandAvg !== undefined && prev.rightHandAvg !== undefined ? signed(r.rightHandAvg - prev.rightHandAvg, 1) : null;
                      const lDelta = prev && r.leftHandAvg !== undefined && prev.leftHandAvg !== undefined ? signed(r.leftHandAvg - prev.leftHandAvg, 1) : null;
                      return (
                        <p>
                          {todayText(r.createdAt)} · ACC {accDelta && <span className={accDelta.className}> {accDelta.text}%</span>} · 점수 {r.score.toLocaleString()} {scoreDelta && <span className={scoreDelta.className}>({scoreDelta.text})</span>} · PP {r.pp !== undefined ? r.pp.toFixed(2) : '-'} {ppDelta && <span className={ppDelta.className}>({ppDelta.text})</span>} · L: {formatHand(r.leftHandAvg)} {lDelta && <span className={lDelta.className}>({lDelta.text})</span>} / R: {formatHand(r.rightHandAvg)} {rDelta && <span className={rDelta.className}>({rDelta.text})</span>}
                        </p>
                      );
                    })()}
                    {r.memo && <p className="muted">{r.memo}</p>}
                  </div>
                  <div className="historyActions">
                    {r.source === 'scoresaber' && <span className="pill">SS</span>}
                    {r.fullCombo && <span className="fcPill">FC</span>}
                    <button onClick={() => beginEditRecord(r)}>{r.source === 'scoresaber' ? '보완' : '수정'}</button>
                    <button onClick={() => deleteRecord(r.id)}>삭제</button>
                  </div>
                </article>
              ))}
              {!(recordsByMap.get(selected.id) ?? []).length && <p className="muted">아직 저장된 기록이 없습니다.</p>}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
