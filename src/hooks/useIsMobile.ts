import { useEffect, useState } from 'react';

// v2.0.7fd:移动端响应式 hook — 768px 断点
// PC 端(≥ 769px)零变化;≤ 768px 切移动端布局
// SSR 安全:服务端无 window,默认 false(走 PC 布局)— 避免 hydration mismatch
const MOBILE_MAX = 768;

export function useIsMobile(): boolean {
  const [m, setM] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.innerWidth <= MOBILE_MAX;
  });

  useEffect(() => {
    const onR = () => setM(window.innerWidth <= MOBILE_MAX);
    window.addEventListener('resize', onR);
    // 进入页面时再校准一次(防止初始值在 SSR / 早期 effect 之前与实际不符)
    onR();
    return () => window.removeEventListener('resize', onR);
  }, []);

  return m;
}
