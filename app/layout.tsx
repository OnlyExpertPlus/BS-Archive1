import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'BS-Archive',
  description: 'ScoreSaber 기반 Beat Saber 분석기와 수동 랭크맵 기록장 BS-Archive'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
