// React hook:盘中每 10s 拉全市场 + ETF + 可转债 + 涨跌停;60s 拉指数 + 49 行业
import { useEffect, useState, useRef } from 'react';
import {
  fetchLiveIndices,
  fetchSinaIndustries,
  fetchTodaySnapshot,
  fetchEMMarketStats,
  fetchEMEtfStats,
  fetchEMBondStats,
  fetchEMIndustries,
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
// v2.0.7bc:用东八区时间判断(海外 user 浏览器本地时间 < 9:30 会被误判为 preMarket)
// 之前用 new Date() 本地时间 — 海外 user 看到 0(强制清 0 触发)
export function isPreMarket(): boolean {
  const now = new Date(Date.now() + 8 * 3600 * 1000);
  const day = now.getUTCDay();
  if (day === 0 || day === 6) return false;
  const mins = now.getUTCHours() * 60 + now.getUTCMinutes();
  return mins < 9 * 60 + 30;  // 东八区 9:30 之前
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
  // v2.0.7ax:em 申万 90 行业(跟 ths 90 细分类 一一对应,60s 实时)
  emIndustries?: Map<string, { name: string; changePercent: number; leaderName: string; totalTurnover: number; leaderChangePercent: number; stockCount: number }>;
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
    // 60s 拉慢:行业(v2.0.7ax:em 申万 90 行业,跟 ths 90 细分类 一一对应,不是 sina 49 行业聚合)
    const slowTick = async () => {
      try {
        const emIndResult = await safe(fetchEMIndustries(), new Map());
        setSnap((prev) => ({
          ...prev,
          emIndustries: emIndResult,
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
    emIndustries: new Map(),
    today: null,
    fetchedAt: 0,
    isFirstLoad: true,
    fastFetchedAt: 0,
  });

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    const safe = async <T,>(p: Promise<T>, fallback: T): Promise<T> => {
      try { return await p; } catch { return fallback; }
    };
    (async () => {
      try {
        const [idxResult, mkt, etf, bond, sinaResult, emIndResult, todayResult] = await Promise.all([
          fetchLiveIndices(),
          fetchEMMarketStats(),
          fetchEMEtfStats(),
          fetchEMBondStats(),
          fetchSinaIndustries(SINA_INDUSTRY_LABELS),
          safe(fetchEMIndustries(), new Map()),
          fetchTodaySnapshot(),
        ]);
        if (cancelled) return;
        setSnap({
          indices: idxResult,
          market: mkt,
          etfStats: etf,
          bondStats: bond,
          sinaIndustries: sinaResult,
          emIndustries: emIndResult,
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
      // v2.0.7d:成交量也实时刷新 + turnoverDiff 由 fetch_real_data 5 cron 算(末 1 vs 末 2 收盘对比)
      // v2.0.7bb:em 不覆盖 turnoverDiff(避免 8/13 跑出 25659 - 25673 = -14.46 自减)
      next.marketOverview.marketTurnover = live.market!.totalTurnover;
      next.marketOverview.upCount = live.market!.upCount;
      next.marketOverview.downCount = live.market!.downCount;
      next.marketOverview.flatCount = live.market!.flatCount;
      // v2.0.7aw:涨跌停 = em 9% 阈值全市场(sina changepercent 字段 9% 阈值最接近 akshare 涨停池)
      // — 8/13 12:38 sandbox:em 9% 算 59 ≈ 涨停池 54(差 5)≈ 涨停过 76 减 zbgc 22 不可见部分
      // — 跟同花顺 56 接近(差 3)
      // — 盘中 10s 实时(涨停数跳变:8:30 0 → 9:30 30 → 10:30 50 → 11:30 80 → 13:30 100)
      // — preMarket / 跨日 时 mergeLiveData _isCrossDay 分支已清 0
      if (live.market!.limitUpCount > 0) {
        next.marketOverview.limitUpCount = live.market!.limitUpCount;
      }
      if (live.market!.limitDownCount > 0) {
        next.marketOverview.limitDownCount = live.market!.limitDownCount;
      }
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
  // 5. v2.0.7ax:行业板块用 em 申万 90 行业实时覆盖 ths 90 细分类
  // — em "m:90+t:2" 申万二级行业(约 90 个),跟 ths 90 细分类 一一对应(医疗服务/医疗器械/化学制药 等都分开)
  // — 不再用 sina 49 行业(那是聚合,自动化设备/通用设备/.../电机 都归到 new_jxhy,会导致多个 ths 细分类被覆盖成同一值)
  // — em 申万按 name 模糊匹配覆盖 ths 90 细分类(60s 实时,无重复)
  if (live.emIndustries && live.emIndustries.size > 0) {
    for (const s of next.sectors) {
      const thsName = s.name || '';
      if (!thsName) continue;
      let bestMatch: { name: string; changePercent: number; leaderName: string } | null = null;
      let bestLen = 0;
      for (const [emName, emItem] of live.emIndustries) {
        if (!emName) continue;
        // 完全相等或包含
        if (thsName === emName || thsName.includes(emName) || emName.includes(thsName)) {
          // 取最长的匹配(避免"医疗服务"误匹配到"医疗器械"等)
          if (emName.length > bestLen) {
            bestLen = emName.length;
            bestMatch = emItem;
          }
        }
      }
      if (bestMatch) {
        s.changePercent = bestMatch.changePercent;
        if (bestMatch.leaderName && bestMatch.leaderName !== '-') s.leaderName = bestMatch.leaderName;
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
