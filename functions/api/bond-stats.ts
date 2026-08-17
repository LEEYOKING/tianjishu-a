// Cloudflare Pages Function: 沪深可转债涨跌统计
// v2.0.7cs: em push2 + 3 域名 fallback
// fs=m:128+t:4,m:129+t:4 = 沪深可转债(akshare bond_zh_hs_cov_spot 同源)

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

  const cacheKey = 'https://tianjishu-api/bond-stats';
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

  // em push2 沪深可转债
  // m:128+t:4 上交所可转债 + m:129+t:4 深交所可转债
  const path = '/api/qt/clist/get?pn=1&pz=2000&po=1&fid=f3&fs=m:128+t:4,m:129+t:4&fields=f12,f3';
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
