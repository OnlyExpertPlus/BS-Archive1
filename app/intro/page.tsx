import Link from 'next/link';

export default function IntroPage() {
  return (
    <main className="page introPage">
      <header className="hero">
        <div>
          <p className="eyebrow">비트세이버 기록 저장소</p>
          <h1 className="brandTitle">BS-Archive</h1>
          <p className="brandSub">비트세이버 기록 저장소</p>
        </div>
        <div className="heroActions">
          <Link className="navButton" href="/">ScoreSaber 분석</Link>
          <Link className="navButton" href="/logbook">랭크맵 기록장</Link>
        </div>
      </header>

      <section className="panel introPanel">
        <h2>🎉 소개</h2>
        <p>
          <b>BS-Archive</b>는 Beat Saber 플레이어를 위한 비공식 기록 저장소입니다.
          ScoreSaber 기록을 불러와 Top 성과표와 최근 기록을 확인하고, 랭크맵 기록장을 통해
          ACC, 점수, PP, 왼손/오른손 정확도, FC 여부와 메모를 관리할 수 있습니다.
        </p>
        <div className="introBox">
          <b>🏆 BS-Archive는 비트세이버를 좋아하는 플레이어를 위해 만들어가고 있습니다.</b>
          <p>공식 서비스가 아니며, ScoreSaber 공개 데이터를 활용해 개인 기록 관리와 성장 분석을 돕는 도구입니다.</p>
        </div>
      </section>

      <section className="panel introPanel">
        <h2>💡 주요 기능</h2>
        <ul className="featureList">
          <li>ScoreSaber ID/URL로 총 PP, 랭킹, 평균 정확도 확인</li>
          <li>Top 30 카드형 성과표 표시</li>
          <li>별 개수별 약점 분석과 최근 기록 확인</li>
          <li>ScoreSaber 실제 랭크맵 전체 기록장</li>
          <li>수동 기록 추가, ScoreSaber 기록 보완 입력, JSON 백업/복원</li>
          <li>BS-Archive 전용 PP 티어 표시</li>
        </ul>
      </section>

      <section className="panel introPanel">
        <h2>❓ 자주 묻는 질문</h2>
        <h3>기록 입력은 어떻게 하나요?</h3>
        <p>랭크맵 기록장에서 맵 카드를 누른 뒤 ACC, 점수, PP, 오른손/왼손 정확도, FC 여부를 입력하면 됩니다.</p>
        <h3>ScoreSaber 기록을 자동으로 가져올 수 있나요?</h3>
        <p>랭크맵 기록장의 “ScoreSaber 기록 가져오기”에 ID나 프로필 URL을 넣으면 기존 ScoreSaber 기록을 가져올 수 있습니다.</p>
        <h3>왼손/오른손 정확도도 자동으로 가져오나요?</h3>
        <p>현재 ScoreSaber 기본 기록 API에서 안정적으로 가져오지 못해 수동 보완 입력 방식으로 관리합니다.</p>
      </section>
    </main>
  );
}
