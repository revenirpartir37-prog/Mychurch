'use client';
import { useEffect } from 'react';

export function useVisualViewportHeight() {
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;

    const setHeight = () => {
      document.documentElement.style.setProperty('--app-height', `${vv.height}px`);
      document.documentElement.style.setProperty('--vv-offset-top', `${vv.offsetTop}px`);
    };

    setHeight();
    vv.addEventListener('resize', setHeight);
    vv.addEventListener('scroll', setHeight);

    return () => {
      vv.removeEventListener('resize', setHeight);
      vv.removeEventListener('scroll', setHeight);
    };
  }, []);
}
