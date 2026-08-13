// React hook:盘中每 10s 拉全市场 + ETF + 可转债 + 涨跌停;60s 拉指数 + 49 行业
import { useEffect, useState, useRef } from 'react';
import {
  fetchLiveIndices,
  fetchSinaIndustries,
  fetchTodaySnapshot,
  fetchEMMarketStats,
  fetchEMEtfStats,
  fetchEMBondStats,
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

// v2.0.7p:9:30 集合竞价前(交易日)— 9:15 集合竞价开始,但 sina 在 9:05 也能拉到少量"集合竞价预报价"
// 看着像"半数据"(如 1 涨 / 5499 平盘)。这段时间清零 A 股统计(避免显示半数据),
// 等 9:30 正式开盘后用 live 实时数据
export function isPreMarket(): boolean {
  const now = new Date();
  const day = now.getDay();
  if (day === 0 || day === 6) return false;
  const mins = now.getHours() * 60 + now.getMinutes();
  return mins < 9 * 60 + 30;  // 9:30 之前
}

export interface LiveSnapshot {
  /** 6 个指数实时数据(顺序对应 data.indices) */
  indices: { point: number; changeAmount: number; changePercent: number; turnover: number }[];
  /** 全市场汇总(EM push2:含涨跌停) */
  market: {
    upCount: number;
    downCount: number;
    flatCount: number;
    totalTurnover: number;
    limitUpCount: number;
    limitDownCount: number;
    // v2.0.7ab:涨跌分布分桶(11 档)
    changeDistribution?: {
      down_ge_10: number; down_10_to_7: number; down_7_to_5: number;
      down_5_to_3: number; down_3_to_0: number; flat: number;
      up_0_to_3: number; up_3_to_5: number; up_5_to_7: number;
      up_7_to_10: number; up_ge_10: number;
    };
  } | null;
  /** ETF 涨跌分布(EM push2) */
  etfStats: { up: number; down: number; flat: number } | null;
  /** 可转债 涨跌分布(EM push2) */
  bondStats: { up: number; down: number; flat: number } | null;
  /** 49 个 sina 行业实时数据(60s 拉) */
  sinaIndustries: Map<string, { changePercent: number; totalTurnover: number; leaderName: string; leaderChangePercent: number; stockCount: number } | null>;
  /** 今日实时快照(用于把今天数据 push 到 history 末尾) */
  today: { date: string; volume: number; up: number; down: number } | null;
  /** 数据源时间戳 */
  fetchedAt: number;
  /** 是否还在首次拉取(初始 false) */
  isFirstLoad: boolean;
  /** 上次"快速拉"(10s)时间戳 */
  fastFetchedAt: number;
}

/** 实时数据 hook — 盘中(9:30-15:00)10s 拉全市场/ETF/可转债,60s 拉指数+行业;非盘中 5min
 * 默认 enabled=true */
export function useLiveData(enabled = true): LiveSnapshot {
  const [snap, setSnap] = useState<LiveSnapshot>({
    indices: [],
    market: null,
    etfStats: null,
    bondStats: null,
    sinaIndustries: new Map(),
    today: null,
    fetchedAt: 0,
    isFirstLoad: true,
    fastFetchedAt: 0,
  });
  const inflightRef = useRef(false);

  useEffect(() => {
    if (!enabled) return;
    // 10s 拉快:全市场 + ETF + 可转债 + 指数 + today(v2.0.7g:加 today 同步,避免曲线图落后)
    const safe = async <T,>(p: Promise<T>, fallback: T): Promise<T> => {
      try { return await p; } catch (e) { console.warn('[useLiveData] sub-fetch fail:', e); return fallback; }
    };
    const fastTick = async () => {
      if (inflightRef.current) return;
      inflightRef.current = true;
      try {
        const [mkt, etf, bond, idxResult, todayResult] = await Promise.all([
          safe(fetchEMMarketStats(), null),
          safe(fetchEMEtfStats(), null),
          safe(fetchEMBondStats(), null),
          safe(fetchLiveIndices(), []),
          safe(fetchTodaySnapshot(), null),
        ]);
        setSnap((prev) => {
          // 任何一个有数据都算成功
          const hasAny = mkt || etf || bond || (idxResult && idxResult.length > 0) || todayResult;
          return {
            ...prev,
            market: mkt ?? prev.market,
            etfStats: etf ?? prev.etfStats,
            bondStats: bond ?? prev.bondStats,
            indices: (idxResult && idxResult.length > 0) ? idxResult : prev.indices,
            today: todayResult ?? prev.today,  // v2.0.7g:today 进 fast tick
            fastFetchedAt: hasAny ? Date.now() : prev.fastFetchedAt,
            fetchedAt: hasAny ? Date.now() : prev.fetchedAt,
            isFirstLoad: hasAny ? false : prev.isFirstLoad,
          };
        });
      } catch (e) {
        console.warn('[useLiveData] fast tick error:', e);
      } finally {
        inflightRef.current = false;
      }
    };
    // 60s 拉慢:行业(v2.0.7g:today 已进 fast tick 同步,不再在慢 tick 拉)
    const slowTick = async () => {
      try {
        const sinaResult = await safe(fetchSinaIndustries(SINA_INDUSTRY_LABELS), new Map());
        setSnap((prev) => ({
          ...prev,
          sinaIndustries: sinaResult,
        }));
      } catch (e) {
        console.warn('[useLiveData] slow tick error:', e);
      }
    };

    fastTick();
    slowTick();

    // 盘中 10s 拉快 + 60s 拉慢,非盘中 5min 拉慢
    const isLive = isLiveMarket();
    const fastIntv = setInterval(fastTick, isLive ? 20_000 : 60_000);
    const slowIntv = setInterval(slowTick, isLive ? 60_000 : 300_000);
    return () => {
      clearInterval(fastIntv);
      clearInterval(slowIntv);
    };
  }, [enabled]);

  return snap;
}

/** 仅拉 1 次的 live hook */
export function useLiveDataOnce(enabled = true): LiveSnapshot {
  const [snap, setSnap] = useState<LiveSnapshot>({
    indices: [],
    market: null,
    etfStats: null,
    bondStats: null,
    sinaIndustries: new Map(),
    today: null,
    fetchedAt: 0,
    isFirstLoad: true,
    fastFetchedAt: 0,
  });

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    (async () => {
      try {
        const [idxResult, mkt, etf, bond, sinaResult, todayResult] = await Promise.all([
          fetchLiveIndices(),
          fetchEMMarketStats(),
          fetchEMEtfStats(),
          fetchEMBondStats(),
          fetchSinaIndustries(SINA_INDUSTRY_LABELS),
          fetchTodaySnapshot(),
        ]);
        if (cancelled) return;
        setSnap({
          indices: idxResult,
          market: mkt,
          etfStats: etf,
          bondStats: bond,
          sinaIndustries: sinaResult,
          today: todayResult,
          fetchedAt: Date.now(),
          isFirstLoad: false,
          fastFetchedAt: Date.now(),
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
 * v2.0.7:全市场/ETF/可转债 涨跌停数也用 live 覆盖(10s 实时) */
export function mergeLiveData(data: ReportData, live: LiveSnapshot): ReportData {
  if (live.fetchedAt === 0) return data;
  const next: ReportData = JSON.parse(JSON.stringify(data));
  // 1. 指数
  if (live.indices.length > 0 && live.indices.some((li) => li.point > 0)) {
    for (let i = 0; i < next.marketOverview.indices.length && i < live.indices.length; i++) {
      const li = live.indices[i];
      if (li.point > 0) {
        next.marketOverview.indices[i].point = li.point;
        next.marketOverview.indices[i].changeAmount = li.changeAmount;
        next.marketOverview.indices[i].changePercent = li.changePercent;
        next.marketOverview.indices[i].turnover = li.turnover;
      }
    }
  }
  // 2. 全市场汇总 — v2.0.7p:9:30 集合竞价前清零(避免显示 sina "半数据" 如 1 涨 5499 平)
  // 9:30 之后用 live 实时
  // v2.0.7av:跨日时(8:00 hook 切日期后但 baseData 还没 cron 更新)也清 0 涨跌停
  // — 否则 8/14 9:30-9:35 会显示 8/13 收盘涨停池 56(错,应 0)
  const _now8 = new Date(Date.now() + 8 * 3600 * 1000);
  const _todayYMD = `${_now8.getUTCFullYear()}${String(_now8.getUTCMonth() + 1).padStart(2, '0')}${String(_now8.getUTCDate()).padStart(2, '0')}`;
  const _baseTradeDate = (next.marketOverview as any).tradeDate || '';
  const _isCrossDay = _baseTradeDate && _baseTradeDate !== _todayYMD;
  if (isPreMarket() || _isCrossDay) {
    next.marketOverview.marketTurnover = 0;
    next.marketOverview.turnoverDiff = 0;
    next.marketOverview.upCount = 0;
    next.marketOverview.downCount = 0;
    next.marketOverview.flatCount = 0;
    next.marketOverview.limitUpCount = 0;
    next.marketOverview.limitDownCount = 0;
    next.marketOverview.upPercent = 0;
  } else {
    // v2.0.7e:兜底 — fs 编码错时返回空/总数 < 1000,fallback 到 data.json 静态值
    const mktTotal = live.market ? (live.market.upCount + live.market.downCount + live.market.flatCount) : 0;
    const mktValid = live.market && mktTotal >= 600;
    if (mktValid) {
      // v2.0.7d:成交量也实时刷新 + 自动算 turnoverDiff(用 history 末 1 日作为对照)
      const prevDayVol = next.history && next.history.length >= 1
        ? next.history[next.history.length - 1].volume
        : 0;
      next.marketOverview.marketTurnover = live.market!.totalTurnover;
      next.marketOverview.turnoverDiff = prevDayVol > 0
        ? Math.round((live.market!.totalTurnover - prevDayVol) * 100) / 100
        : next.marketOverview.turnoverDiff;
      next.marketOverview.upCount = live.market!.upCount;
      next.marketOverview.downCount = live.market!.downCount;
      next.marketOverview.flatCount = live.market!.flatCount;
      // v2.0.7av:limitUpCount/limitDownCount 不被 em 覆盖(盘中"当前涨停"37 vs 涨停池"涨停过"56 是两个数)
      // — 涨跌停卡片显示的是"涨停过"总数(akshare 涨停池长度,跟同花顺一致)
      // — em 9.95% 阈值算的 37 是"当前涨幅 >= 9.95%"(含未封板+已开板),跟 user 期望的 56 不同
      // — 全天用涨停池(5 cron 跑出的真值),盘中变化小(5 cron/日 跳变)
      next.marketOverview.upPercent = mktTotal > 0
        ? Math.round(live.market!.upCount * 10000 / mktTotal) / 100
        : 0;
      // v2.0.7ab:涨跌分布分桶也实时刷新
      if (live.market!.changeDistribution) {
        next.marketOverview.changeDistribution = live.market!.changeDistribution;
      }
    }
  }
  // v2.0.7at:limitUpCount/limitDownCount 不被 fast tick(em 实时算)覆盖
  // — fetch_real_data 用 akshare 涨停池算(同花顺一致),em 实时算 9.9% 阈值会偏(70 vs 56)
  // — 让涨停池真值生效(15:35 cron 跑出来,盘后定格)
  // 3. ETF 涨跌分布(EM push2 — 10s 实时,fs 错时 fallback)
  const etfTotal = live.etfStats ? (live.etfStats.up + live.etfStats.down + live.etfStats.flat) : 0;
  if (live.etfStats && etfTotal >= 200) {
    next.marketOverview.etfUp = live.etfStats.up;
    next.marketOverview.etfDown = live.etfStats.down;
    next.marketOverview.etfFlat = live.etfStats.flat;
  }
  // 4. 可转债 涨跌分布(EM push2 — 10s 实时,fs 错时 fallback)
  const bondTotal = live.bondStats ? (live.bondStats.up + live.bondStats.down + live.bondStats.flat) : 0;
  if (live.bondStats && bondTotal >= 100) {
    next.marketOverview.bondUp = live.bondStats.up;
    next.marketOverview.bondDown = live.bondStats.down;
    next.marketOverview.bondFlat = live.bondStats.flat;
  }
  // 5. 行业板块(按 sinaLabel 覆盖,60s 刷新)
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
  // 6. 把今日实时数据 push 到 history 末尾(让曲线图含当日点)
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
        volume: todayData.volume,
        up: todayData.up,
        down: todayData.down,
        limitUp: next.marketOverview.limitUpCount,
        limitDown: next.marketOverview.limitDownCount,
      });
    } else {
      // v2.0.7g:date 相同时也更新 limitUp/limitDown(1.3 涨跌停曲线图 bug 修复)
      const liveLimits = (live.market && (live.market.upCount + live.market.downCount + live.market.flatCount) >= 600)
        ? { limitUp: live.market.limitUpCount, limitDown: live.market.limitDownCount }
        : { limitUp: next.marketOverview.limitUpCount, limitDown: next.marketOverview.limitDownCount };
      next.history[next.history.length - 1] = {
        ...next.history[next.history.length - 1],
        volume: todayData.volume,
        up: todayData.up,
        down: todayData.down,
        limitUp: liveLimits.limitUp,
        limitDown: liveLimits.limitDown,
      };
    }
  }
  return next;
}
