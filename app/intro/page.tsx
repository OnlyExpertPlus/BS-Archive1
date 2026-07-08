import Link from 'next/link';

export default function IntroPage() {
  return (
    <main className="page introPage">
      <header className="hero">
        <div>
          <p className="eyebrow">BS-Analyzer / BS-Archive</p>
          <h1 className="brandTitle">소개</h1>
          <p className="brandSub">비트세이버 기록 분석과 랭크맵 기록장</p>
        </div>
        <div className="heroActions">
          <Link className="navButton" href="/">Dashboard</Link>
          <Link className="navButton" href="/logbook">BS-Archive</Link>
        </div>
      </header>

      <section className="panel introPanel">
        <h2>🎉 소개</h2>
        <p>
          <b>BS-Analyzer</b>는 ScoreSaber 기록을 분석해 성과표, 추천곡, 티어와 통계를 보여주는 대시보드입니다.
          <b> BS-Archive</b>는 실제 ScoreSaber 랭크맵 기준으로 ACC, 점수, PP, L/R 평균 컷, FC 여부와 메모를 관리하는 기록장입니다.
        </p>
        <div className="introBox">
          <b>🏆 BS-Analyzer와 BS-Archive는 비트세이버를 좋아하는 플레이어를 위해 만들어가고 있습니다.</b>
          <p>공식 서비스가 아니며, ScoreSaber 공개 데이터를 활용해 개인 기록 관리와 성장 분석을 돕는 도구입니다.</p>
        </div>
      </section>

      <section className="panel introPanel">
        <h2>💡 주요 기능</h2>
        <ul className="featureList">
          <li>ScoreSaber ID, 커스텀 ID, 프로필 URL로 유저 기록 분석</li>
          <li>총 PP, 글로벌/국가 랭킹, 평균 정확도, Top PP 확인</li>
          <li>BS-Archive 전용 PP 티어와 Top 30 카드형 성과표 표시</li>
          <li>난이도 구간별 기록 통계와 최근 기록 확인</li>
          <li>기록 갱신 추천, 미기록 PP 효율곡, 오래된 기록 추천 제공</li>
          <li>ScoreSaber PP 커브 기반 추정 PP와 예상 증가량 표시</li>
          <li>ScoreSaber 실제 랭크맵 기반 BS-Archive 기록장 제공</li>
          <li>유저별 기록 분리 저장, 수동 기록·메모·JSON 백업/복원 지원</li>
          <li>L/R 평균 컷 수동 입력 및 이전 기록 대비 증감량 표시</li>
          <li>BeatSaver / ScoreSaber 바로가기 지원</li>
        </ul>
      </section>

      <section className="panel introPanel">
        <h2>❓ 자주 묻는 질문</h2>
        <h3>기록 입력은 어떻게 하나요?</h3>
        <p>BS-Archive에서 맵 카드를 누른 뒤 ACC, 점수, PP, L/R 평균 컷, FC 여부와 메모를 입력하면 됩니다.</p>
        <h3>ScoreSaber 기록을 자동으로 가져올 수 있나요?</h3>
        <p>BS-Archive의 “ScoreSaber 기록 가져오기”에 ID나 프로필 URL을 넣으면 기존 ScoreSaber 기록을 가져올 수 있습니다.</p>
        <h3>L/R 평균 컷도 자동으로 가져오나요?</h3>
        <p>현재는 안정적으로 가져오지 못해 수동 보완 입력 방식으로 관리합니다.</p>
      </section>
    </main>
  );
}
