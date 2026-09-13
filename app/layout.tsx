import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = { title: '집업 · 상급지 갈아타기 모니터링', description: '상급지 갈아타기를 위해 내 집과 관심단지의 가격 차이 변화를 모니터링합니다.' };
export default function Layout({ children }: {children: React.ReactNode}) { return <html lang="ko"><body>{children}</body></html> }
