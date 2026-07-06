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
  rightAcc?: number;
  leftAcc?: number;
  fullCombo: boolean;
  memo?: string;
  createdAt: string;
  source?: 'manual' | 'scoresaber';
};

type RecordForm = {
  acc: string;
  score: string;
  pp: string;
  rightAcc: string;
  leftAcc: string;
  fullCombo: boolean;
  memo: string;
};

const RECORDS_KEY = 'b-archive-manual-records-v3';
const LEGACY_RECORDS_KEY = 'beat-saber-analyzer-manual-records-v1';
const MAPS_KEY = 'b-archive-ranked-maps-v6-full-1';
const MAPS_META_KEY = 'b-archive-ranked-maps-meta-v6-full-1';
const starTabs = Array.from({ length: 15 }, (_, i) => 15 - i);

const sampleMaps: RankedMap[] = [
  {
    id: 'sample-1', leaderboardId: 0, songHash: '', title: '랭크맵을 불러오는 중입니다', songName: '랭크맵을 불러오는 중입니다', artist: '-', mapper: '-', difficulty: 'ExpertPlus', stars: 15.02, maxScore: 0, coverUrl: ''
  }
];

function initialForm(): RecordForm {
  return { acc: '', score: '', pp: '', rightAcc: '', leftAcc: '', fullCombo: false, memo: '' };
}

function formFromRecord(record: ManualRecord): RecordForm {
  return {
    acc: String(record.acc ?? ''),
    score: record.score ? String(record.score) : '',
    pp: record.pp !== undefined ? String(record.pp) : '',
    rightAcc: record.rightAcc !== undefined ? String(record.rightAcc) : '',
    leftAcc: record.leftAcc !== undefined ? String(record.leftAcc) : '',
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

function formatPercent(value?: number) {
  if (value === undefined || Number.isNaN(value)) return '-';
  return `${value.toFixed(2)}%`;
}

function keepSupplementedValue<T>(oldValue: T | undefined, newValue: T | undefined) {
  return oldValue !== undefined && oldValue !== null ? oldValue : newValue;
}

export default function LogbookPage() {
  const [activeStar, setActiveStar] = useState(15);
  const [records, setRecords] = useState<ManualRecord[]>([]);
  const [maps, setMaps] = useState<RankedMap[]>(sampleMaps);
  const [selected, setSelected] = useState<RankedMap | null>(null);
  const [editingRecord, setEditingRecord] = useState<ManualRecord | null>(null);
  const [form, setForm] = useState<RecordForm>(initialForm());
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'recorded' | 'unrecorded' | 'fc'>('all');
  const [loadingMaps, setLoadingMaps] = useState(false);
  const [mapsMessage, setMapsMessage] = useState('');
  const [playerInput, setPlayerInput] = useState('');
  const [importingScores, setImportingScores] = useState(false);

  useEffect(() => {
    const savedRecords = localStorage.getItem(RECORDS_KEY) ?? localStorage.getItem(LEGACY_RECORDS_KEY);
    if (savedRecords) setRecords(JSON.parse(savedRecords));

    const savedMaps = localStorage.getItem(MAPS_KEY);
    const savedMeta = localStorage.getItem(MAPS_META_KEY);
    if (savedMaps) {
      const parsed = JSON.parse(savedMaps) as RankedMap[];
      if (Array.isArray(parsed) && parsed.length) {
        setMaps(parsed);
        setMapsMessage(savedMeta ? `저장된 랭크맵 캐시 사용 중 · ${savedMeta}` : `저장된 랭크맵 ${parsed.length.toLocaleString()}개 사용 중`);
      }
    } else {
      void refreshRankedMaps();
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(RECORDS_KEY, JSON.stringify(records));
  }, [records]);

  async function refreshRankedMaps(maxPages = 2000) {
    setLoadingMaps(true);
    setMapsMessage('ScoreSaber 랭크맵 전체 목록을 가져오는 중입니다. 오래된 맵까지 끝까지 확인하므로 시간이 조금 걸릴 수 있습니다.');
    try {
      const res = await fetch(`/api/ranked-maps?limit=100&maxPages=${maxPages}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? '랭크맵 목록을 가져오지 못했습니다.');
      setMaps(data.maps);
      localStorage.setItem(MAPS_KEY, JSON.stringify(data.maps));
      const lastUpdated = data.metadata.lastUpdated ? new Date(data.metadata.lastUpdated).toLocaleString('ko-KR') : new Date().toLocaleString('ko-KR');
      const metaText = `${data.metadata.loaded.toLocaleString()}개 · ${data.metadata.pagesLoaded}/${data.metadata.targetPages}페이지 · ${lastUpdated} 갱신`;
      localStorage.setItem(MAPS_META_KEY, metaText);
      setMapsMessage(`ScoreSaber 랭크맵 캐시 완료 · ${metaText}`);
    } catch (error) {
      setMapsMessage(error instanceof Error ? error.message : '랭크맵 목록을 가져오지 못했습니다.');
    } finally {
      setLoadingMaps(false);
    }
  }

  async function importScoresFromScoreSaber() {
    if (!playerInput.trim()) {
      alert('ScoreSaber ID 또는 프로필 URL을 입력해 주세요.');
      return;
    }
    setImportingScores(true);
    try {
      const res = await fetch(`/api/player-ranked-scores?player=${encodeURIComponent(playerInput)}&maxPages=160`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'ScoreSaber 기록을 가져오지 못했습니다.');
      const incoming = data.records as ManualRecord[];
      setRecords((prev) => {
        const byId = new Map(prev.map((r) => [r.id, r]));
        incoming.forEach((next) => {
          const old = byId.get(next.id);
          if (!old) {
            byId.set(next.id, next);
            return;
          }

          // ScoreSaber에서 다시 가져와도 사용자가 직접 보완한 L/R ACC, 메모, FC 체크는 보존합니다.
          byId.set(next.id, {
            ...old,
            acc: next.acc,
            score: next.score,
            pp: next.pp,
            createdAt: next.createdAt,
            source: next.source,
            mapId: next.mapId,
            rightAcc: keepSupplementedValue(old.rightAcc, next.rightAcc),
            leftAcc: keepSupplementedValue(old.leftAcc, next.leftAcc),
            memo: old.memo && old.memo !== 'ScoreSaber에서 가져온 기록' ? old.memo : next.memo,
            fullCombo: old.fullCombo || next.fullCombo
          });
        });
        return [...byId.values()].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      });
      alert(`ScoreSaber 기록 ${incoming.length.toLocaleString()}개를 가져왔습니다. 이미 보완한 오른손/왼손 ACC와 메모는 유지됩니다.`);
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
        rightAcc: form.rightAcc ? Number(form.rightAcc) : undefined,
        leftAcc: form.leftAcc ? Number(form.leftAcc) : undefined,
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
      rightAcc: form.rightAcc ? Number(form.rightAcc) : undefined,
      leftAcc: form.leftAcc ? Number(form.leftAcc) : undefined,
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
    const blob = new Blob([JSON.stringify({ records, mapsMeta: localStorage.getItem(MAPS_META_KEY) }, null, 2)], { type: 'application/json' });
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
          <p className="eyebrow">BS-Archive</p>
          <h1>랭크맵 기록장</h1>
          <p className="heroText">ScoreSaber 실제 랭크맵을 별 난이도별로 보고, ACC·점수·PP·오른손/왼손 정확도·FC 여부를 저장합니다.</p>
        </div>
        <Link className="navButton" href="/">ScoreSaber 분석으로 이동</Link>
      </header>

      <section className="panel warningPanel">
        <strong>v6 업데이트 안내</strong>
        <p>랭크맵 목록을 페이지 제한 없이 최대한 끝까지 수집하고, 같은 곡의 여러 난이도를 leaderboard id 기준으로 따로 보존합니다. ScoreSaber에서 가져온 기록도 수정해서 R/L 정확도와 메모를 보완할 수 있습니다.</p>
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
          <p className="muted">내 ScoreSaber ID/URL을 넣으면 Top 기록을 기록장에 가져옵니다. 이미 보완한 R/L ACC와 메모는 다시 가져와도 유지됩니다.</p>
        </div>
        <input value={playerInput} onChange={(e) => setPlayerInput(e.target.value)} placeholder="ScoreSaber ID 또는 프로필 URL" />
        <button onClick={importScoresFromScoreSaber} disabled={importingScores}>{importingScores ? '가져오는 중' : '기록 가져오기'}</button>
      </section>

      {mapsMessage && <p className="muted statusText">{mapsMessage}</p>}

      <section className="starTabs">
        {starTabs.map((star) => (
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
              <input value={form.rightAcc} onChange={(e) => setForm({ ...form, rightAcc: e.target.value })} placeholder="오른손 ACC" />
              <input value={form.leftAcc} onChange={(e) => setForm({ ...form, leftAcc: e.target.value })} placeholder="왼손 ACC" />
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
                    <p>{todayText(r.createdAt)} · 점수 {r.score.toLocaleString()} · PP {r.pp !== undefined ? r.pp.toFixed(2) : '-'} · R {formatPercent(r.rightAcc)} / L {formatPercent(r.leftAcc)}</p>
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
