// useLiveEmotionTemp: 1 min 拉 Cloudflare Pages Function /api/emotion-temp
// 拿到 5 维温度,前端用这个覆盖 baseData 的 marketTemperature
// v2.0.7bv

import { useEffect, useState, useRef } from 'react';

export interface LiveEmotionTemp {
  temperature: number;
  status: string;
  statusDesc: string;
  details: {
    limit_up: number;
    limit_down: number;
    max_boards: number;
    broken_count: number;
    broken_rate: string;
    yest_perf: string;
    promote_rate: string;
    limit_ratio: string;
  };
  dimension_scores: {
    '涨跌停对比': number;
    '连板高度': number;
    '炸板率': number;
    '昨日涨停今日': number;
    '晋级率': number;
  };
  source: 'live' | 'fallback' | 'cache';
  fetchedAt: string;
  latency_ms: number;
}

export function useLiveEmotionTemp(enabled = true): { data: LiveEmotionTemp | null; fetchedAt: number; isStale: boolean } {
  const [data, setData] = useState<LiveEmotionTemp | null>(null);
  const [fetchedAt, setFetchedAt] = useState(0);
  const intervalRef = useRef<any>(null);

  useEffect(() => {
    if (!enabled) return;
    
    let cancelled = false;
    
    const fetchOnce = async () => {
      try {
        const res = await fetch('/api/emotion-temp', { cache: 'no-store' });
        if (!res.ok) return;
        const json = await res.json();
        if (cancelled) return;
        if (json && !json.error && typeof json.temperature === 'number') {
          setData(json);
          setFetchedAt(Date.now());
        }
      } catch (e) {
        console.warn('[useLiveEmotionTemp] fetch error:', e);
      }
    };
    
    // 立即拉一次
    fetchOnce();
    
    // 1 min 拉一次
    intervalRef.current = setInterval(fetchOnce, 60000);
    
    return () => {
      cancelled = true;
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [enabled]);

  // 是否 stale(超过 2 min 没更新)
  const isStale = fetchedAt > 0 && (Date.now() - fetchedAt) > 120000;

  return { data, fetchedAt, isStale };
}
