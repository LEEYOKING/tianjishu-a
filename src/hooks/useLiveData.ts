// React hook:盘中每 10s 拉全市场 + ETF + 可转债 + 涨跌停;60s 拉指数 + 49 行业
// v2.0.7cs:em 实时走 Cloudflare Pages Function /api/market-stats 等(同源 CORS,绕开 user 浏览器直连 em IP 限流)
// — 之前 user 浏览器直连 sina/em push2 经常被限流(看到 stale)
// — Function 走 Cloudflare Workers 出口 IP(已验证 em 能拉),10s cache
// — Function 拉失败时,fallback 直连 sina/em(双保险)
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
  // v2.0.7cs:Function 优先 + 直连 fallback
  fetchMarketStatsViaAPI,
  fetchEtfStatsViaAPI,
  fetchBondStatsViaAPI,
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
  /** 今日实时快照(用于把今天数据 push 到 history 末尾) — v2.0.7cu:加 limitUp/limitDown 字段(同源 sina 9.97% 阈值) */
  today: { date: string; volume: number; up: number; down: number; limitUp: number; limitDown: number } | null;
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
    // v2.0.7cs:safe 加重试 — em/sina 拉失败时 800ms 后重试 1 次
    // — 之前拉失败直接 fallback,看起来"上周五收盘"(user 反馈)
    // — 加重试后:网络抖动/限流 都能 recover,user 看到 8/17 实时
    const safe = async <T,>(p: Promise<T>, fallback: T, retryMs = 800): Promise<T> => {
      try { return await p; }
      catch (e) {
        console.warn('[useLiveData] sub-fetch fail, retrying in', retryMs, 'ms:', e);
        await new Promise((r) => setTimeout(r, retryMs));
        try { return await p; }
        catch (e2) {
          console.warn('[useLiveData] sub-fetch retry fail:', e2);
          return fallback;
        }
      }
    };
    const fastTick = async () => {
      if (inflightRef.current) return;
      inflightRef.current = true;
      try {
        // v2.0.7cs:Function 优先(em 实时走 Cloudflare Pages Function 出口 IP,绕开 user 浏览器/sandbox 直连 IP 限流)
        // — 内部已 fallback 直连 sina/em(Function 拉失败时)
        // — Function 10s cache,user 浏览器 20s 拉一次,em 实时准 10s
        const [mkt, etf, bond, idxResult, todayResult] = await Promise.all([
          safe(fetchMarketStatsViaAPI(), null),
          safe(fetchEtfStatsViaAPI(), null),
          safe(fetchBondStatsViaAPI(), null),
          safe(fetchLiveIndices(), []),
          safe(fetchTodaySnapshot(), null),
        ]);
        setSnap((prev) => {
          // 任何一个有数据都算成功
          const hasAny = mkt || etf || bond || (idxResult && idxResult.length > 0) || todayResult;
          return {
            ...prev,
            // v2.0.7cs:em 拉到 null(周末/失败)→ 保留 prev,不写死 null
            // — prev 是 React state,em 没拉到时 prev 保持上次成功的值(sticky)
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
  if (_isCrossDay) {
    // v2.0.7ci:跨日(baseData 是 8/14 但 today 8/15)只清 0 涨跌停
    // — upCount/downCount/flatCount/turnover 保留 8/14 收盘值(避免显示 0)
    // — 涨跌停 0:00-9:30 保留 baseData 8/14 收盘(用户还在看昨天的数据)
    // — 9:30 后 em 实时(fast tick)覆盖
    // 注意:这里不清 0 涨跌停,保留 baseData(0:00-9:30 期间显示昨天收盘值)
    // — 因为 8:00 hook 之后到 9:35 cron 之前,涨跌停应该还是昨天收盘的
  } else if (isPreMarket()) {
    // v2.0.7bd:preMarket(0:00-9:30 集合竞价前)清 0
    // 注意:实际 isPreMarket 在 _isCrossDay 之后判断
    // 0:00-9:30 但不是跨日(罕見) → 可能有 baseData 没同步情况,清 0 兜底
    next.marketOverview.marketTurnover = 0;
    next.marketOverview.turnoverDiff = 0;
    next.marketOverview.upCount = 0;
    next.marketOverview.downCount = 0;
    next.marketOverview.flatCount = 0;
    next.marketOverview.limitUpCount = 0;
    next.marketOverview.limitDownCount = 0;
    next.marketOverview.upPercent = 0;
  } else {
    // v2.0.7cu:live.today 优先覆盖(跟曲线图末点同源)
    // — 根因:fetchEMMarketStats 限流时 catch 返 {0,0,0,0},fetchTodaySnapshot 限流时返 null
    // — useState prev 保留机制:live.today 拉成功的值被 sticky 保留,live.market 被 0 覆盖
    // — 结果:曲线图末点 = live.today.volume(2.4 万亿 ✓ 8/17 实时),卡片 = next.marketOverview.marketTurnover(21561 ✗ 8/14 baseData)
    // — 修法:卡片也用 live.today 覆盖,跟曲线图末点同源
    // — 跟 v2.0.7bi 一样处理 limitUp/limitDown(同花顺"当前封板"近似)
    if (live.today && (live.today.up > 0 || live.today.down > 0) && live.today.volume > 0) {
      next.marketOverview.marketTurnover = live.today.volume;
      next.marketOverview.upCount = live.today.up;
      next.marketOverview.downCount = live.today.down;
      // 涨跌停 — fetchTodaySnapshot 也带 limitUp/limitDown(同源 sina 9.97% 阈值)
      if (live.today.limitUp !== undefined && live.today.limitUp > 0) {
        next.marketOverview.limitUpCount = live.today.limitUp;
      }
      if (live.today.limitDown !== undefined && live.today.limitDown > 0) {
        next.marketOverview.limitDownCount = live.today.limitDown;
      }
      const mktTotalToday = live.today.up + live.today.down;
      if (mktTotalToday > 0) {
        next.marketOverview.upPercent = Math.round(live.today.up * 10000 / mktTotalToday) / 100;
      }
    } else {
      // v2.0.7ct 兜底:live.today 没值时(live.today 为 null 一直没成功过),用 live.market
      // mktValid 阈值 600 → 100 — em 8/17 11:00 限流严,部分数据(100+ 只)也用
      const mktTotal = live.market ? (live.market.upCount + live.market.downCount + live.market.flatCount) : 0;
      const mktValid = live.market && mktTotal >= 100;
      if (mktValid) {
        // v2.0.7d:成交量也实时刷新 + turnoverDiff 由 fetch_real_data 5 cron 算(末 1 vs 末 2 收盘对比)
        // v2.0.7bb:em 不覆盖 turnoverDiff(避免 8/13 跑出 25659 - 25673 = -14.46 自减)
        next.marketOverview.marketTurnover = live.market!.totalTurnover;
        next.marketOverview.upCount = live.market!.upCount;
        next.marketOverview.downCount = live.market!.downCount;
        next.marketOverview.flatCount = live.market!.flatCount;
        // v2.0.7bi:涨跌停 = em 实时 9.99% 阈值 算(盘中 9:30-15:00)
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
  }
  // v2.0.7at:limitUpCount/limitDownCount 不被 fast tick(em 实时算)覆盖
  // — fetch_real_data 用 akshare 涨停池算(同花顺一致),em 实时算 9.9% 阈值会偏(70 vs 56)
  // — 让涨停池真值生效(15:35 cron 跑出来,盘后定格)
  // 3. ETF 涨跌分布(EM push2 — 10s 实时,fs 错时 fallback)
  // v2.0.7ct:阈值 200 → 30 — em 8/17 11:00 限流严,部分数据(30+ 只)也用
  const etfTotal = live.etfStats ? (live.etfStats.up + live.etfStats.down + live.etfStats.flat) : 0;
  if (live.etfStats && etfTotal >= 30) {
    next.marketOverview.etfUp = live.etfStats.up;
    next.marketOverview.etfDown = live.etfStats.down;
    next.marketOverview.etfFlat = live.etfStats.flat;
  }
  // 4. 可转债 涨跌分布(EM push2 — 10s 实时,fs 错时 fallback)
  // v2.0.7ct:阈值 100 → 20
  const bondTotal = live.bondStats ? (live.bondStats.up + live.bondStats.down + live.bondStats.flat) : 0;
  if (live.bondStats && bondTotal >= 20) {
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
  // v2.0.7cs:todayFallback 用东八区日期(海外 user 浏览器本地时间可能不是北京时间,导致曲线图末点日期错位)
  const todayFallback = {
    date: (() => {
      const now8 = new Date(Date.now() + 8 * 3600 * 1000);
      return `${now8.getUTCFullYear()}-${String(now8.getUTCMonth() + 1).padStart(2, '0')}-${String(now8.getUTCDate()).padStart(2, '0')}`;
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
