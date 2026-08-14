// Cloudflare Pages Function: 情绪温度计 5 维实时数据
// v2.0.7bx:加 User-Agent + Referer + 多域名 fallback(避免 Cloudflare Workers IP 被 em 限流)

interface Env {
  EMOTION_CACHE?: KVNamespace;
}

interface EmotionTempData {
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
  debug?: any;
}

const BASE_SCORE = 50;
const TIMEOUT_MS = 8000;
const CACHE_TTL = 60;

// em push2 多个域名(主域被限流时 fallback)
const EM_DOMAINS = [
  'https://push2.eastmoney.com',
  'https://82.push2.eastmoney.com',
  'https://push2his.eastmoney.com',
];

// 真实浏览器 UA + Referer(em 信任这些)
const BROWSER_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Referer': 'https://quote.eastmoney.com/',
  'Accept': 'application/json, text/plain, */*',
  'Accept-Language': 'zh-CN,zh;q=0.9',
};

const STATUS_MAP: Array<[number, string, string]> = [
  [10, '极度恐慌', '市场情绪极冷'],
  [25, '恐慌', '情绪极冷'],
  [40, '偏冷', '情绪偏冷,机会酝酿'],
  [55, '常温震荡', '中性'],
  [70, '偏热', '情绪转暖'],
  [85, '亢奋', '情绪过热'],
  [100, '极度亢奋', '情绪极端'],
];

async function fetchWithTimeout(url: string, options: any = {}, timeoutMs = TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
}

// 多域名 fallback fetch JSON
async function fetchJsonWithFallback(path: string, maxRetries = 2): Promise<any> {
  let lastError: any;
  // 尝试每个域名
  for (const domain of EM_DOMAINS) {
    const url = `${domain}${path}`;
    for (let i = 0; i < maxRetries; i++) {
      try {
        const res = await fetchWithTimeout(url, { headers: BROWSER_HEADERS });
        if (res.ok) {
          return await res.json();
        }
        // 502/503/504 等服务错误,换域名重试
        if (res.status >= 500) {
          lastError = new Error(`HTTP ${res.status} from ${domain}`);
          continue;
        }
        // 4xx 不重试,直接抛
        throw new Error(`HTTP ${res.status} from ${domain}`);
      } catch (e) {
        lastError = e;
        if (i < maxRetries - 1) {
          await new Promise(r => setTimeout(r, 200 * (i + 1)));
        }
      }
    }
  }
  throw lastError || new Error('All EM domains failed');
}

function calcDim1(limitUp: number, limitDown: number): number {
  const ratio = limitUp / Math.max(limitDown, 1);
  if (ratio > 10) return 15;
  if (ratio > 5) return 10;
  if (ratio > 2) return 5;
  if (ratio >= 1) return 0;
  return -15;
}

function calcDim2(maxBoards: number): number {
  if (maxBoards >= 7) return 10;
  if (maxBoards >= 5) return 8;
  if (maxBoards >= 4) return 5;
  if (maxBoards >= 3) return 0;
  return -10;
}

function calcDim3(broken: number, limitUp: number): number {
  if (limitUp + broken > 0) {
    const brokenRate = broken / (limitUp + broken);
    if (brokenRate < 0.15) return 10;
    if (brokenRate < 0.30) return 5;
    if (brokenRate < 0.50) return -5;
    return -10;
  }
  return 0;
}

function calcDim4(avgChange: number): number {
  if (avgChange > 3) return 10;
  if (avgChange >= 0) return 5;
  if (avgChange > -2) return -5;
  return -10;
}

function calcDim5(todayN2: number, yestN1: number): number {
  if (yestN1 > 0) {
    const promoteRate = todayN2 / yestN1;
    if (promoteRate > 0.5) return 5;
    if (promoteRate >= 0.3) return 2;
    return -5;
  }
  return 0;
}

function getStatus(temp: number): [string, string] {
  for (const [threshold, name, desc] of STATUS_MAP) {
    if (temp <= threshold) return [name, desc];
  }
  return ['极度亢奋', '情绪极端'];
}

// ===== 1. em push2 今日涨停/跌停股池(实时)=====
async function fetchTodayLimitStocks(): Promise<{ upCount: number; downCount: number; upCodes: string[] }> {
  const path = '/api/qt/clist/get?pn=1&pz=6000&po=1&fid=f3&fs=m:0+t:6,m:0+t:80,m:1+t:2,m:1+t:23&fields=f12,f3';
  const data = await fetchJsonWithFallback(path);
  if (!data?.data?.diff) return { upCount: 0, downCount: 0, upCodes: [] };
  let upCount = 0, downCount = 0;
  const upCodes: string[] = [];
  for (const s of data.data.diff) {
    const pct = parseFloat(s.f3);
    if (pct >= 9.97) {
      upCount++;
      upCodes.push(String(s.f12).padStart(6, '0'));
    } else if (pct <= -9.97) {
      downCount++;
    }
  }
  return { upCount, downCount, upCodes };
}

// ===== 2. em push2 炸板股(实时)=====
async function fetchBrokenStocks(): Promise<number> {
  const path = '/api/qt/clist/get?pn=1&pz=6000&po=1&fid=f3&fs=m:0+t:6,m:0+t:80,m:1+t:2,m:1+t:23&fields=f12,f3,f17';
  const data = await fetchJsonWithFallback(path);
  if (!data?.data?.diff) return 0;
  let brokenCount = 0;
  for (const s of data.data.diff) {
    const pct = parseFloat(s.f3);
    const limitTime = parseFloat(s.f17);
    if (pct < 9.97 && limitTime > 0) {
      brokenCount++;
    }
  }
  return brokenCount;
}

// ===== 3. em datacenter RPT_ZTJQ 历史涨停股池 =====
async function fetchHistoryLimitUp(dateStr: string): Promise<string[]> {
  // 多个 datacenter 域名
  const paths = [
    `/api/data/v1/get?reportName=RPT_ZTJQ&columns=ALL&pageNumber=1&pageSize=200&filter=(TRADE_DATE%3D%27${dateStr}%27)&source=HSF10&client=PC`,
  ];
  for (const path of paths) {
    try {
      const data = await fetchJsonWithFallback(path);
      if (data?.result?.data) {
        return data.result.data
          .map((s: any) => String(s.SECURITY_CODE || '').padStart(6, '0'))
          .filter((c: string) => c.length === 6);
      }
    } catch (e) {
      // 继续尝试
    }
  }
  return [];
}

// ===== 4. em push2 ulist 批量实时价(算昨日涨停今日表现)=====
async function fetchStocksRealtimePercent(codes: string[]): Promise<{ [code: string]: number }> {
  if (codes.length === 0) return {};
  const secids = codes.map(code => {
    const isSH = code.startsWith('6') || code.startsWith('9') || code.startsWith('5');
    return `${isSH ? '1' : '0'}.${code}`;
  }).join(',');
  const path = `/api/qt/ulist.nd/get?secids=${secids}&fields=f3`;
  const data = await fetchJsonWithFallback(path);
  if (!data?.data?.diff) return {};
  const result: { [code: string]: number } = {};
  for (const s of data.data.diff) {
    const code = String(s.code || '').padStart(6, '0');
    result[code] = parseFloat(s.f3) || 0;
  }
  return result;
}

function calcMaxBoards(todayCodes: string[], historyCodesList: string[][]): number {
  let max = 1;
  let currentSet = new Set(todayCodes);
  for (let day = 0; day < historyCodesList.length; day++) {
    const histSet = new Set(historyCodesList[day]);
    const intersected = new Set([...currentSet].filter(x => histSet.has(x)));
    if (intersected.size === 0) break;
    max = day + 2;
    currentSet = intersected;
  }
  return max;
}

function calcPromote(todayCodes: string[], yestCodes: string[]): { todayN2: number; yestN1: number; promoteRate: number } {
  const yestSet = new Set(yestCodes);
  const todayN2 = todayCodes.filter(c => yestSet.has(c)).length;
  const yestN1 = yestCodes.length;
  const promoteRate = yestN1 > 0 ? todayN2 / yestN1 : 0;
  return { todayN2, yestN1, promoteRate };
}

async function calcYestPerfAvg(yestCodes: string[]): Promise<number> {
  if (yestCodes.length === 0) return 0;
  const rets = await fetchStocksRealtimePercent(yestCodes);
  const values = Object.values(rets);
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function formatDateYMD(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

function getLastTradingDay(baseDate: Date): Date {
  const d = new Date(baseDate);
  d.setUTCDate(d.getUTCDate() - 1);
  while (d.getUTCDay() === 0 || d.getUTCDay() === 6) {
    d.setUTCDate(d.getUTCDate() - 1);
  }
  return d;
}

export async function onRequestGet(context: { request: Request; env: Env }) {
  const startTime = Date.now();
  const CACHE_KEY = 'emotion-temp:cache';
  const debug: any = { emDomains: EM_DOMAINS };

  // 1. cache 检查
  if (context.env.EMOTION_CACHE) {
    try {
      const cached = await context.env.EMOTION_CACHE.get(CACHE_KEY, 'json') as any;
      if (cached && cached.fetchedAt) {
        const age = (Date.now() - new Date(cached.fetchedAt).getTime()) / 1000;
        if (age < CACHE_TTL) {
          return new Response(JSON.stringify({ ...cached, source: 'cache', latency_ms: Date.now() - startTime }), {
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
          });
        }
      }
    } catch (e) {
      console.warn('[emotion-temp] cache read error:', e);
    }
  }

  try {
    // 2. 算日期(东八区)
    const _now8 = new Date(Date.now() + 8 * 3600 * 1000);
    const _today = new Date(_now8);
    const _yest = getLastTradingDay(_today);
    const _todayStr = formatDateYMD(_today);
    const _yestStr = formatDateYMD(_yest);
    debug.todayStr = _todayStr;
    debug.yestStr = _yestStr;

    // 3. 并行拉所有数据
    const [today, brokenCount, yestUpCodes] = await Promise.all([
      fetchTodayLimitStocks(),
      fetchBrokenStocks(),
      fetchHistoryLimitUp(_yestStr),
    ]);
    debug.todayUp = today.upCount;
    debug.todayDown = today.downCount;
    debug.brokenCount = brokenCount;
    debug.yestUpCount = yestUpCodes.length;

    // 4. 算维度 4 (昨日涨停今日表现)
    const yestPerf = await calcYestPerfAvg(yestUpCodes);
    debug.yestPerf = yestPerf;

    // 5. 算维度 5 (晋级率)
    const promote = calcPromote(today.upCodes, yestUpCodes);
    debug.promote = promote;

    // 6. 算维度 2 (连板高度)
    let maxBoards = 1;
    try {
      const dayBefore = new Date(_yest);
      dayBefore.setUTCDate(dayBefore.getUTCDate() - 1);
      while (dayBefore.getUTCDay() === 0 || dayBefore.getUTCDay() === 6) {
        dayBefore.setUTCDate(dayBefore.getUTCDate() - 1);
      }
      const dayBeforeUpCodes = await fetchHistoryLimitUp(formatDateYMD(dayBefore));
      maxBoards = calcMaxBoards(today.upCodes, [yestUpCodes, dayBeforeUpCodes]);
    } catch (e) {
      console.warn('[emotion-temp] maxBoards calc failed:', e);
    }
    debug.maxBoards = maxBoards;

    // 7. 算 5 维
    const s1 = calcDim1(today.upCount, today.downCount);
    const s2 = calcDim2(maxBoards);
    const s3 = calcDim3(brokenCount, today.upCount);
    const s4 = calcDim4(yestPerf);
    const s5 = calcDim5(promote.todayN2, promote.yestN1);

    const final = Math.max(0, Math.min(100, Math.round(BASE_SCORE + s1 + s2 + s3 + s4 + s5)));
    const [status, statusDesc] = getStatus(final);

    const result: EmotionTempData = {
      temperature: final,
      status,
      statusDesc,
      details: {
        limit_up: today.upCount,
        limit_down: today.downCount,
        max_boards: maxBoards,
        broken_count: brokenCount,
        broken_rate: (today.upCount + brokenCount > 0 ? (brokenCount / (today.upCount + brokenCount) * 100).toFixed(1) : '0.0') + '%',
        yest_perf: yestPerf.toFixed(2) + '%',
        promote_rate: (promote.promoteRate * 100).toFixed(1) + '%',
        limit_ratio: today.downCount > 0 ? (today.upCount / today.downCount).toFixed(1) : '99',
      },
      dimension_scores: {
        '涨跌停对比': s1,
        '连板高度': s2,
        '炸板率': s3,
        '昨日涨停今日': s4,
        '晋级率': s5,
      },
      source: 'live',
      fetchedAt: new Date().toISOString(),
      latency_ms: Date.now() - startTime,
      debug,
    };

    // 8. 写 cache
    if (context.env.EMOTION_CACHE) {
      try {
        await context.env.EMOTION_CACHE.put(CACHE_KEY, JSON.stringify(result), { expirationTtl: 300 });
      } catch (e) {
        console.warn('[emotion-temp] cache write error:', e);
      }
    }

    return new Response(JSON.stringify(result), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=60',
      }
    });
  } catch (e: any) {
    console.error('[emotion-temp] error:', e);
    return new Response(JSON.stringify({
      error: true,
      message: e.message,
      source: 'fallback',
      timestamp: new Date().toISOString(),
      debug,
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }
}
