import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = { title: '집간격 · 나의 부동산 거리', description: '내 집과 관심단지의 가격, 그리고 그 사이의 변화를 기록합니다.' };
export default function Layout({ children }: {children: React.ReactNode}) { return <html lang="ko"><body>{children}</body></html> }
