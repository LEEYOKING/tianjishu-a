// Cloudflare Pages Function: A 股全市场汇总
// v2.0.7cs: 走 em push2 + 3 域名 fallback,Cloudflare Workers 出口 IP(绕开 user 浏览器/sandbox IP 限流)
// 返回: upCount / downCount / flatCount / totalTurnover / limitUpCount / limitDownCount / changeDistribution

import { fetchJsonWithFallback, isLimitUp, isLimitDown, isWeekendCN, jsonResponse, handleOptions } from '../_lib/em';

// v2.0.7di:CACHE_TTL 0(不写 cache)— 之前 10s cache 在 em 限流时残留 stale 8/17 数据
// React useLiveData 20s 拉一次,每次命中 8/17 cache → user 一直看到 8/17 收盘数字
// 修法:不写 cache,em 拉失败时直接返 null(React 走 baseData)
const CACHE_TTL = 0;  // 0 = 不 cache(盘中 10s 实时改用每次 fetch)

export async function onRequestGet(context: { request: Request; env: any }): Promise<Response> {
  const startTime = Date.now();

  // OPTIONS preflight
  if (context.request.method === 'OPTIONS') return handleOptions();

  // 周末返 null(让前端走 baseData)
  if (isWeekendCN()) {
    return jsonResponse({
      source: 'weekend',
      isWeekend: true,
      data: null,
      fetchedAt: new Date().toISOString(),
      latency_ms: Date.now() - startTime,
    });
  }

  // v2.0.7di:cache 检查 — CACHE_TTL=0 时跳过(不命中任何 cache,避免 stale 残留)
  const cacheKey = 'https://tianjishu-api/market-stats';
  const cache = caches.default;
  if (CACHE_TTL > 0) {
    const cached = await cache.match(cacheKey);
    if (cached) {
      const ageHeader = cached.headers.get('X-Cache-Age');
      const age = ageHeader ? parseInt(ageHeader) : 999;
      if (age < CACHE_TTL) {
        const data = await cached.json();
        return jsonResponse({ ...data, source: 'cache', latency_ms: Date.now() - startTime });
      }
    }
  }

  // 2. 拉 em push2 沪深 A 股全市场
  // m:0+t:6,m:0+t:80,m:1+t:2,m:1+t:23 = 沪深 A 股(全市场约 5400 只)
  // f3=涨跌幅 f2=最新价 f6=成交额(元) f17=首次涨停时间
  // pz=6000 拉全市场(参考 emotion-temp 验证过)
  const path = '/api/qt/clist/get?pn=1&pz=6000&po=1&fid=f3&fs=m:0+t:6,m:0+t:80,m:1+t:2,m:1+t:23&fields=f12,f3,f6,f17';
  try {
    const json = await fetchJsonWithFallback(path);
    const list = json?.data?.diff || [];
    let up = 0, down = 0, flat = 0, total = 0, lu = 0, ld = 0;
    const dist = {
      down_ge_10: 0, down_10_to_7: 0, down_7_to_5: 0, down_5_to_3: 0, down_3_to_0: 0,
      flat: 0,
      up_0_to_3: 0, up_3_to_5: 0, up_5_to_7: 0, up_7_to_10: 0, up_ge_10: 0,
    };
    for (const s of list) {
      const cp = parseFloat(s.f3);
      const amt = parseFloat(s.f6) || 0;
      if (cp > 0) up++;
      else if (cp < 0) down++;
      else flat++;
      // 涨跌分布 11 档分桶
      if (cp < -10) dist.down_ge_10++;
      else if (cp < -7) dist.down_10_to_7++;
      else if (cp < -5) dist.down_7_to_5++;
      else if (cp < -3) dist.down_5_to_3++;
      else if (cp < 0) dist.down_3_to_0++;
      else if (cp === 0) dist.flat++;
      else if (cp < 3) dist.up_0_to_3++;
      else if (cp < 5) dist.up_3_to_5++;
      else if (cp < 7) dist.up_5_to_7++;
      else if (cp < 10) dist.up_7_to_10++;
      else dist.up_ge_10++;
      // 涨跌停
      if (isLimitUp(cp)) lu++;
      else if (isLimitDown(cp)) ld++;
      total += amt;
    }
    // em pz=200 只算前 200(按涨跌幅排序),不够全市场 - 但作为盘中实时指示够用
    // 实际全市场 5400 只,em 默认 pz=200 - 这只算涨幅最高的 200 + 跌幅最低的
    // 改成 pz=200 翻页?太慢,先 pz=200 试试
    const result = {
      source: 'live',
      isWeekend: false,
      data: {
        upCount: up,
        downCount: down,
        flatCount: flat,
        totalTurnover: Math.round(total / 1e8),  // 元 → 亿
        limitUpCount: lu,
        limitDownCount: ld,
        changeDistribution: dist,
        stockTotal: up + down + flat,
        note: 'em push2 pz=6000 全市场(5400+ 只)实时累加',
      },
      fetchedAt: new Date().toISOString(),
      latency_ms: Date.now() - startTime,
    };

    // 写 cache — v2.0.7di:CACHE_TTL=0 时不写(避免 em 限流后 cache 残留 stale 8/17)
    const resp = new Response(JSON.stringify(result), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'X-Cache-Age': '0',
      },
    });
    if (CACHE_TTL > 0) {
      context.executionCtx?.waitUntil(cache.put(cacheKey, resp.clone()));
    }
    return resp;
  } catch (e: any) {
    // v2.0.7di:em 拉失败时删 cache(防止 stale 8/17 cache 残留)
    if (CACHE_TTL > 0) {
      context.executionCtx?.waitUntil(cache.delete(cacheKey));
    }
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
