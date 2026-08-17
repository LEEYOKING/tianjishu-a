// Cloudflare Pages Function 共享工具: em push2 + 多域名 fallback
// v2.0.7cs: 跟 emotion-temp 同款架构,出口 IP 走 Cloudflare Workers(绕开 sandbox/user 浏览器直连 IP 限流)
// v2.0.7ct: em 限流严重(8/17 11:00 返 520),加 5+ 备用域名 + 加重试间隔

export const EM_DOMAINS = [
  'https://push2.eastmoney.com',
  'https://82.push2.eastmoney.com',
  'https://push2his.eastmoney.com',
  // v2.0.7ct:加备用域名(不同 IP 段 — em push2 不同子域解析到不同 IP)
  'https://25.push2.eastmoney.com',
  'https://44.push2.eastmoney.com',
  'https://hsmarketwg.eastmoney.com',
];

export const BROWSER_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Referer': 'https://quote.eastmoney.com/',
  'Accept': 'application/json, text/plain, */*',
  'Accept-Language': 'zh-CN,zh;q=0.9',
};

// v2.0.7cs: 拉到 pz=6000 全市场 1-2s,留 20s 余量(避免 Cloudflare Function 30s CPU limit)
export const TIMEOUT_MS = 20000;

export async function fetchWithTimeout(url: string, options: any = {}, timeoutMs = TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
}

// 多域名 fallback fetch JSON + 5xx 换域名重试
// v2.0.7ct:加重试间隔(200ms → 1500ms)— em 限流冷却时间更长
// — 5xx 立即换域名(没必要重试同一个被屏蔽的)
// — 4xx 抛错(不重试)
export async function fetchJsonWithFallback(path: string, maxRetries = 1): Promise<any> {
  let lastError: any;
  for (const domain of EM_DOMAINS) {
    const url = `${domain}${path}`;
    for (let i = 0; i <= maxRetries; i++) {
      try {
        const res = await fetchWithTimeout(url, { headers: BROWSER_HEADERS });
        if (res.ok) {
          return await res.json();
        }
        if (res.status >= 500) {
          lastError = new Error(`HTTP ${res.status} from ${domain}`);
          break;  // 5xx 换域名,不重试同一个
        }
        throw new Error(`HTTP ${res.status} from ${domain}`);
      } catch (e) {
        lastError = e;
        if (i < maxRetries) {
          await new Promise(r => setTimeout(r, 1500));  // 1.5s 间隔
        }
      }
    }
  }
  throw lastError || new Error('All EM domains failed');
}

// 东八区日期/时间(避免海外 user 错)
export function nowCN(): Date {
  return new Date(Date.now() + 8 * 3600 * 1000);
}

export function isWeekendCN(): boolean {
  const d = nowCN();
  const w = d.getUTCDay();
  return w === 0 || w === 6;
}

export function ymdCN(): string {
  const d = nowCN();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

// 涨跌停阈值(同花顺算法) — v2.0.7ay
export function isLimitUp(cp: number): boolean {
  return (cp >= 9.97 && cp < 11) || (cp >= 19.97 && cp < 21);
}
export function isLimitDown(cp: number): boolean {
  return (cp <= -9.97 && cp > -11) || (cp <= -19.97 && cp > -21);
}

// CORS 头
export const CORS_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export function jsonResponse(data: any, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: CORS_HEADERS });
}

// 处理 OPTIONS preflight
export async function handleOptions(): Promise<Response> {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}
