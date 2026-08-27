'use client';
import { useVisualViewportHeight } from '@/hooks/useVisualViewportHeight';

export function AppShell({ children }: { children: React.ReactNode }) {
  useVisualViewportHeight();
  return <>{children}</>;
}
