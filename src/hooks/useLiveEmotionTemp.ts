// useLiveEmotionTemp: 交易日盘中(9:30-15:00)才拉
// 其他时段(盘前/盘后/午休/周末)一律不更新,保留 baseData
// v2.0.7co

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

// 是否在 A 股盘中(交易日 9:30-15:00)
function isIntraday(): boolean {
  const now = new Date(Date.now() + 8 * 3600 * 1000);  // 东八区
  const day = now.getUTCDay();
  if (day === 0 || day === 6) return false;  // 周六周日不拉
  const mins = now.getUTCHours() * 60 + now.getUTCMinutes();
  return mins >= 9 * 60 + 30 && mins < 15 * 60;  // 9:30-15:00
}

const POLL_INTERVAL_MS = 10 * 60 * 1000;  // 10 min

export function useLiveEmotionTemp(enabled = true): { data: LiveEmotionTemp | null; fetchedAt: number; isStale: boolean } {
  const [data, setData] = useState<LiveEmotionTemp | null>(null);
  const [fetchedAt, setFetchedAt] = useState(0);
  const intervalRef = useRef<any>(null);
  const scheduleRef = useRef<any>(null);

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;

    const fetchOnce = async () => {
      if (cancelled) return;
      // 每次 fetch 前再检查一次(可能在后台 tab 时间到了,etc)
      if (!isIntraday()) return;
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

    // v2.0.7co:启动/停止 interval
    const startPolling = () => {
      if (intervalRef.current) return;
      // 立即拉一次
      fetchOnce();
      // 10 min 拉
      intervalRef.current = setInterval(fetchOnce, POLL_INTERVAL_MS);
    };

    const stopPolling = () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };

    // 立即根据当前时间决定启动/停止
    if (isIntraday()) {
      startPolling();
    }

    // 每分钟检查时间,到 9:30 自动启,15:00 自动停
    scheduleRef.current = setInterval(() => {
      if (isIntraday()) {
        startPolling();
      } else {
        stopPolling();
      }
    }, 60 * 1000);

    return () => {
      cancelled = true;
      stopPolling();
      if (scheduleRef.current) clearInterval(scheduleRef.current);
    };
  }, [enabled]);

  // stale: 超过 15 min 没更新(盘中 10 min 拉 + 5 min buffer)
  const isStale = fetchedAt > 0 && (Date.now() - fetchedAt) > 15 * 60 * 1000;

  return { data, fetchedAt, isStale };
}
