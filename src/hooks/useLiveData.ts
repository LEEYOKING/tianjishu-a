// React hook: 每 30s 拉一次实时数据,合并到 ReportData
import { useEffect, useState, useRef } from 'react';
import {
  fetchLiveIndices,
  fetchMarketSummary,
  fetchSinaIndustries,
  fetchTodaySnapshot,
  SINA_INDUSTRY_LABELS,
} from '../data/live';
import type { ReportData } from '../data/loader';

// 判断是否在 A 股交易时段(供组件 UI 用)
export function isLiveMarket(): boolean {
  const now = new Date();
  const day = now.getDay();
  if (day === 0 || day === 6) return false;
  const mins = now.getHours() * 60 + now.getMinutes();
  return mins >= 9 * 60 + 30 && mins < 15 * 60;
}

export interface LiveSnapshot {
  /** 6 个指数实时数据(顺序对应 data.indices) */
  indices: { point: number; changeAmount: number; changePercent: number; turnover: number }[];
  /** 全市场汇总(不含涨跌停数,涨跌停用静态 zt_pool) */
  market: { upCount: number; downCount: number; flatCount: number; totalTurnover: number } | null;
  /** 49 个 sina 行业实时数据 */
  sinaIndustries: Map<string, { changePercent: number; totalTurnover: number; leaderName: string; leaderChangePercent: number; stockCount: number } | null>;
  /** 今日实时快照(用于把 8.6 当日数据 push 到 history 末尾) */
  today: { date: string; volume: number; up: number; down: number } | null;
  /** 数据源时间戳 */
  fetchedAt: number;
  /** 是否还在首次拉取(初始 false) */
  isFirstLoad: boolean;
}

/** 实时数据 hook — 盘中(9:30-15:00)每 30s 拉一次,非盘中 5min 拉一次
 * 默认 enabled=true */
export function useLiveData(enabled = true): LiveSnapshot {
  const [snap, setSnap] = useState<LiveSnapshot>({
    indices: [],
    market: null,
    sinaIndustries: new Map(),
    today: null,
    fetchedAt: 0,
    isFirstLoad: true,
  });
  const inflightRef = useRef(false);

  useEffect(() => {
    if (!enabled) return;
    const tick = async () => {
      if (inflightRef.current) return;
      inflightRef.current = true;
      try {
        const [idxResult, mktResult, sinaResult, todayResult] = await Promise.all([
          fetchLiveIndices(),
          fetchMarketSummary(),
          fetchSinaIndustries(SINA_INDUSTRY_LABELS),
          fetchTodaySnapshot(),
        ]);
        setSnap({
          indices: idxResult,
          market: mktResult,
          sinaIndustries: sinaResult,
          today: todayResult,
          fetchedAt: Date.now(),
          isFirstLoad: false,
        });
      } catch (e) {
        console.warn('[useLiveData] tick error:', e);
      } finally {
        inflightRef.current = false;
      }
    };
    tick();
    // 盘中 30s,非盘中 5min
    const isLive = (() => {
      const now = new Date();
      const day = now.getDay();
      if (day === 0 || day === 6) return false;
      const mins = now.getHours() * 60 + now.getMinutes();
      return mins >= 9 * 60 + 30 && mins < 15 * 60;
    })();
    const interval = setInterval(tick, isLive ? 30_000 : 300_000);
    return () => clearInterval(interval);
  }, [enabled]);

  return snap;
}

/** 仅拉 1 次的 live hook */
export function useLiveDataOnce(enabled = true): LiveSnapshot {
  const [snap, setSnap] = useState<LiveSnapshot>({
    indices: [],
    market: null,
    sinaIndustries: new Map(),
    today: null,
    fetchedAt: 0,
    isFirstLoad: true,
  });

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    (async () => {
      try {
        const [idxResult, mktResult, sinaResult, todayResult] = await Promise.all([
          fetchLiveIndices(),
          fetchMarketSummary(),
          fetchSinaIndustries(SINA_INDUSTRY_LABELS),
          fetchTodaySnapshot(),
        ]);
        if (cancelled) return;
        setSnap({
          indices: idxResult,
          market: mktResult,
          sinaIndustries: sinaResult,
          today: todayResult,
          fetchedAt: Date.now(),
          isFirstLoad: false,
        });
      } catch (e) {
        console.warn('[useLiveDataOnce] error:', e);
      }
    })();
    return () => { cancelled = true; };
  }, [enabled]);

  return snap;
}

/** 把 live snapshot 合并到 ReportData(覆盖涨跌幅/家数等实时字段)
 * 注意:涨跌停数(limitUpCount/limitDownCount)用静态 zt_pool 的精确值,不覆盖
 * 可转债/ETF 家数:用静态 fetch_real_data.py 算的(不覆盖) */
export function mergeLiveData(data: ReportData, live: LiveSnapshot): ReportData {
  if (live.fetchedAt === 0) return data;
  const next: ReportData = JSON.parse(JSON.stringify(data));
  // 1. 指数(v1.9.6:live.indices 全 0 时不覆盖)
  if (live.indices.length > 0 && live.indices.some((li) => li.point > 0)) {
    for (let i = 0; i < next.marketOverview.indices.length && i < live.indices.length; i++) {
      const li = live.indices[i];
      // 单条指数也校验有效性(point > 0)
      if (li.point > 0) {
        next.marketOverview.indices[i].point = li.point;
        next.marketOverview.indices[i].changeAmount = li.changeAmount;
        next.marketOverview.indices[i].changePercent = li.changePercent;
        next.marketOverview.indices[i].turnover = li.turnover;
      }
    }
  }
  // 2. 全市场汇总(只覆盖 上涨/下跌/平/成交,涨跌停数不覆盖)
  // v1.9.9:live.market 失效(全 0)时不覆盖 fetch 数据,避免 sandbox CORS 失败时把 history todayData push 为 0
  if (live.market && (live.market.upCount > 0 || live.market.downCount > 0) && live.market.totalTurnover > 0) {
    next.marketOverview.marketTurnover = live.market.totalTurnover;
    next.marketOverview.upCount = live.market.upCount;
    next.marketOverview.downCount = live.market.downCount;
    next.marketOverview.flatCount = live.market.flatCount;
    // 注意:limitUpCount/limitDownCount 不覆盖 - 用 zt_pool 静态精确值
    next.marketOverview.upPercent = live.market.upCount > 0
      ? Math.round(live.market.upCount * 10000 / (live.market.upCount + live.market.downCount + live.market.flatCount)) / 100
      : 0;
  }
  // 3. 行业板块(按 sinaLabel 覆盖)
  if (live.sinaIndustries.size > 0) {
    for (const s of next.sectors) {
      const sl = (s as any).sinaLabel;
      if (sl && live.sinaIndustries.has(sl)) {
        const live_s = live.sinaIndustries.get(sl)!;
        s.changePercent = live_s.changePercent;
        if (live_s.totalTurnover > 0) s.totalTurnover = live_s.totalTurnover;
        if (live_s.leaderName && live_s.leaderName !== '-') s.leaderName = live_s.leaderName;
        if (live_s.leaderChangePercent) s.leaderChangePercent = live_s.leaderChangePercent;
      }
    }
  }
  // 4. 把今日实时数据 push 到 history 末尾(让曲线图含当日点)
  // v1.9.9:live.today 拉不到时(sandbox CORS 失败,fetchTodaySnapshot 返回 {volume:0,up:0,down:0} 不为 null)
  //   fallback 到 fetch 静态值(否则 history 末 8.7 会是 0,曲线图最后一点掉到 0)
  const todayFallback = {
    date: (() => {
      const now = new Date();
      return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    })(),
    volume: next.marketOverview.marketTurnover,
    up: next.marketOverview.upCount,
    down: next.marketOverview.downCount,
  };
  const todayData = (live.today && (live.today.up > 0 || live.today.down > 0) && live.today.volume > 0)
    ? live.today
    : todayFallback;
  if (next.history && next.history.length > 0) {
    const lastDate = next.history[next.history.length - 1].date;
    if (todayData.date !== lastDate) {
      next.history.push({
        date: todayData.date,
        volume: todayData.volume,  // 亿
        up: todayData.up,
        down: todayData.down,
        limitUp: next.marketOverview.limitUpCount,
        limitDown: next.marketOverview.limitDownCount,
      });
    } else {
      next.history[next.history.length - 1] = {
        ...next.history[next.history.length - 1],
        volume: todayData.volume,  // 亿
        up: todayData.up,
        down: todayData.down,
      };
    }
  }
  return next;
}
