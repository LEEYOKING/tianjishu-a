// Cloudflare Pages Function: 沪深 ETF 涨跌统计
// v2.0.7cs: em push2 + 3 域名 fallback
// 复用 market-stats 架构,只是 fs 不同

import { fetchJsonWithFallback, isWeekendCN, jsonResponse, handleOptions } from '../_lib/em';

const CACHE_TTL = 10;

export async function onRequestGet(context: { request: Request; env: any }): Promise<Response> {
  const startTime = Date.now();

  if (context.request.method === 'OPTIONS') return handleOptions();

  if (isWeekendCN()) {
    return jsonResponse({
      source: 'weekend',
      isWeekend: true,
      data: null,
      fetchedAt: new Date().toISOString(),
      latency_ms: Date.now() - startTime,
    });
  }

  // cache
  const cacheKey = 'https://tianjishu-api/etf-stats';
  const cache = caches.default;
  const cached = await cache.match(cacheKey);
  if (cached) {
    const ageHeader = cached.headers.get('X-Cache-Age');
    const age = ageHeader ? parseInt(ageHeader) : 999;
    if (age < CACHE_TTL) {
      const data = await cached.json();
      return jsonResponse({ ...data, source: 'cache', latency_ms: Date.now() - startTime });
    }
  }

  // em push2 沪深 ETF
  // m:0+t:9 沪 ETF + m:1+t:9 深 ETF
  // pz=2000 拉全市场(700+ 只 ETF)
  const path = '/api/qt/clist/get?pn=1&pz=2000&po=1&fid=f3&fs=m:0+t:9,m:1+t:9&fields=f12,f3';
  try {
    const json = await fetchJsonWithFallback(path);
    const list = json?.data?.diff || [];
    let up = 0, down = 0, flat = 0;
    for (const s of list) {
      const cp = parseFloat(s.f3);
      if (cp > 0.01) up++;
      else if (cp < -0.01) down++;
      else flat++;
    }
    const result = {
      source: 'live',
      isWeekend: false,
      data: { up, down, flat, total: up + down + flat },
      fetchedAt: new Date().toISOString(),
      latency_ms: Date.now() - startTime,
    };

    const resp = new Response(JSON.stringify(result), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'X-Cache-Age': '0',
      },
    });
    context.executionCtx?.waitUntil(cache.put(cacheKey, resp.clone()));
    return resp;
  } catch (e: any) {
    return jsonResponse({
      source: 'fallback',
      isWeekend: false,
      data: null,
      error: String(e?.message || e),
      fetchedAt: new Date().toISOString(),
      latency_ms: Date.now() - startTime,
    }, 200);
  }
}
