// 盘中实时数据层:通过 CORS 公开接口拉取实时数据
// 数据源:
//   - 指数实时: 腾讯 qt.gtimg.cn (GBK, CORS ✓) - 6 个核心指数
//   - 成分股列表: 新浪 vip.stock.finance.sina.com.cn/quotes_service/api/... (CORS ✓)
//     - node=hs_a 拿全市场个股(算 upCount/downCount/totalTurnover)
//     - node=new_xxxx 拿板块成分股(算板块涨跌幅 + 领涨股)
//   - 行业板块代码: 49 个新浪行业(new_blhy, new_dlhy 等)
//
// 静态 data.json 提供基础数据(净流入/领涨股详情/涨停股池/龙虎榜等),
// live data 覆盖 "指数涨跌幅 + 板块涨跌幅 + 全市场家数" 等实时变化快的字段。

/** 49 个新浪行业板块的 label(从 akshare sector_spot 取) */
export const SINA_INDUSTRY_LABELS = [
  'new_blhy',   // 玻璃行业
  'new_cbzz',   // 船舶制造
  'new_cmyl',   // 传媒娱乐
  'new_dlhy',   // 电力行业
  'new_dqhy',   // 电器行业
  'new_dzqj',   // 电子器件
  'new_dzxx',   // 电子信息
  'new_fdc',    // 房地产
  'new_fdsb',   // 发电设备
  'new_fjzz',   // 飞机制造
  'new_gthy',   // 钢铁行业
  'new_hbhy',   // 环保行业
  'new_hqhy',   // 化纤行业
  'new_hxxgy',  // 化工行业
  'new_jdhy',   // 家电行业
  'new_jjhy',   // 家具行业
  'new_jrhy',   // 金融行业
  'new_jxhy',   // 机械行业
  'new_jzqg',   // 建筑材料
  'new_jzzs',   // 建筑装饰
  'new_kfq',    // 开发区
  'new_lsjs',   // 绿色节能
  'new_lthy',   // 煤炭行业
  'new_mtc',    // 摩托车
  'new_ncpc',   // 农产品加工
  'new_nlmy',   // 农林牧渔
  'new_nyhy',   // 农药化肥
  'new_qczz',   // 汽车制造
  'new_qtgg',   // 其他工业
  'new_slhy',   // 食品行业
  'new_snhy',   // 塑料行业
  'new_sphy',   // 商业百货
  'new_syhy',   // 石油行业
  'new_tchy',   // 陶瓷行业
  'new_txfw',   // 通信服务
  'new_wlys',   // 物流行业
  'new_xfhy',   // 消费电子
  'new_xnyhy',  // 新能源
  'new_ylqx',   // 医疗器械
  'new_yqhy',   // 仪器仪表
  'new_yysc',   // 印刷包装
  'new_yshy',   // 印刷行业
  'new_zjhy',   // 造纸行业
  'new_zncd',   // 智能穿戴
  'new_zqqy',   // 证券期货
  'new_zyjs',   // 专业技术服务
  'new_zyyd',   // 中药行业
  'new_gghy1',  // 公共事业
  'new_gqhg',   // 股权变更
];

/** 6 个核心指数代码(对应 data.json indices 顺序) */
export const INDEX_CODES = ['sh000001', 'sz399001', 'sz399006', 'sh000688', 'sh000300', 'sz399303'];

const TENCENT_BASE = 'https://qt.gtimg.cn/q=';
const SINA_API = 'https://vip.stock.finance.sina.com.cn/quotes_service/api/json_v2.php/Market_Center.getHQNodeData';

/** 单只股票数据(sina) */
interface SinaStock {
  symbol: string;
  code: string;
  name: string;
  trade: string;            // 最新价
  pricechange: string;      // 涨跌额
  changepercent: string;    // 涨跌幅
  settlement: string;       // 昨收
  open: string;             // 今开
  high: string;             // 最高
  low: string;              // 最低
  volume: number;           // 成交量(股)
  amount: number;           // 成交额(元)
  turnoverratio: string;    // 换手率
  ticktime: string;         // 最后成交时间
  per?: number;             // 市盈率
  pb?: number;              // 市净率
  mktcap?: number;          // 总市值(万)
  nmc?: number;             // 流通市值(万)
}

/** 拉取腾讯指数实时数据
 * 字段位置(0-indexed): 3=现价, 4=昨收, 5=今开, 6=成交量(手)
 *                       31=涨跌额, 32=涨跌幅, 33=最高, 34=最低
 *                       35="现价/成交量(手)/成交额(元)" 复合字段 */
export async function fetchLiveIndices(): Promise<{ point: number; changeAmount: number; changePercent: number; turnover: number }[]> {
  try {
    const url = TENCENT_BASE + INDEX_CODES.join(',');
    const resp = await fetch(url);
    const buf = await resp.arrayBuffer();
    const text = new TextDecoder('gbk').decode(buf);
    const lines = text.split(';').map((s) => s.trim()).filter(Boolean);
    const results: any[] = [];
    for (const line of lines) {
      const m = line.match(/="([^"]+)"/);
      if (!m) continue;
      const parts = m[1].split('~');
      if (parts.length < 36) continue;
      const point = parseFloat(parts[3]) || 0;
      const changeAmount = parseFloat(parts[31]) || 0;
      const changePercent = parseFloat(parts[32]) || 0;
      // 成交额: 解析 parts[35] 复合字段 "现价/成交量/成交额(元)"
      const amountStr = parts[35]?.split('/')[2] || '0';
      const amountYuan = parseFloat(amountStr) || 0;
      const turnover = Math.round(amountYuan / 1e8);  // 元 → 亿
      results.push({ point, changeAmount, changePercent, turnover });
    }
    return results;
  } catch (e) {
    console.warn('[live] fetchLiveIndices 失败:', e);
    return [];
  }
}

/** 拉取 sina 节点(全市场 / 板块)成分股 */
async function fetchSinaNode(node: string, num = 100): Promise<SinaStock[]> {
  return fetchSinaNodeByPage(node, num, 1);
}

async function fetchSinaNodeByPage(node: string, num: number, page: number): Promise<SinaStock[]> {
  return fetchSinaNodeByPageCustom(node, num, page, 'changepercent', 0);
}

async function fetchSinaNodeByPageCustom(node: string, num: number, page: number, sort: string, asc: number): Promise<SinaStock[]> {
  try {
    const url = `${SINA_API}?num=${num}&page=${page}&sort=${sort}&asc=${asc}&node=${node}&_=${Date.now()}`;
    const resp = await fetch(url);
    const buf = await resp.arrayBuffer();
    const text = new TextDecoder('gbk').decode(buf);
    const decoded = text.replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
    if (!decoded.trim() || decoded.trim() === '[]') return [];
    return JSON.parse(decoded) as SinaStock[];
  } catch (e) {
    console.warn(`[live] fetchSinaNode ${node} p${page} 失败:`, e);
    return [];
  }
}

/** v2.0.7cs:东八区"今天"周几(0=周日,1=周一,...,6=周六)
 * — 海外 user 浏览器本地时间可能不是北京时间,统一用 UTC+8 算 */
function _isWeekendCN(): boolean {
  const d = new Date(Date.now() + 8 * 3600 * 1000);
  const w = d.getUTCDay();
  return w === 0 || w === 6;
}

/** 拉取全市场汇总 — 通过并发拉 50 个 page (按代码排序,每页 100 = 5000 只 ≈ 全市场)
 * sina 限制 num=100 但支持 page=1..50, sort=code 时按代码顺序翻页
 * 并发 10 个 page, 总耗时 ~5s
 *
 * v2.0.7h:同时返回 limitUpCount/limitDownCount(让 fetchEMMarketStats / fetchTodaySnapshot 共享同源)
 * 上/跌/平/成交/涨跌停 一致用 sina 实时累加,卡片和曲线图必然一致
 *
 * v2.0.7cs:周末直接返 null — sina 周末返空,调它浪费配额,直接让 useLiveData 走 baseData */
export async function fetchMarketSummary(): Promise<{
  upCount: number; downCount: number; flatCount: number; totalTurnover: number;
  limitUpCount: number; limitDownCount: number;
  // v2.0.7ab:涨跌分布 11 档分桶
  changeDistribution?: {
    down_ge_10: number; down_10_to_7: number; down_7_to_5: number;
    down_5_to_3: number; down_3_to_0: number; flat: number;
    up_0_to_3: number; up_3_to_5: number; up_5_to_7: number;
    up_7_to_10: number; up_ge_10: number;
  };
} | null> {
  // v2.0.7cs:周末 sina 返空,直接 null(避免空数据被当成 stale 实时值)
  if (_isWeekendCN()) {
    return null;
  }
  const TOTAL_PAGES = 55;
  const CONCURRENCY = 10;
  const allStocks: SinaStock[] = [];
  for (let i = 1; i <= TOTAL_PAGES; i += CONCURRENCY) {
    const batch: Promise<SinaStock[]>[] = [];
    for (let p = i; p < Math.min(i + CONCURRENCY, TOTAL_PAGES + 1); p++) {
      batch.push(fetchSinaNodeByPageCustom('hs_a', 100, p, 'code', 1));
    }
    const results = await Promise.all(batch);
    for (const arr of results) {
      allStocks.push(...arr);
    }
    if (results.every((r) => r.length < 100)) break;
    // 10 并发,sina 容易限流,加 50ms 间隔
    if (i + CONCURRENCY < TOTAL_PAGES + 1) await new Promise((r) => setTimeout(r, 50));
  }
  let up = 0, down = 0, flat = 0, total = 0, lu = 0, ld = 0;
  // v2.0.7ab:涨跌分布 11 档分桶
  const dist = {
    down_ge_10: 0, down_10_to_7: 0, down_7_to_5: 0, down_5_to_3: 0, down_3_to_0: 0,
    flat: 0,
    up_0_to_3: 0, up_3_to_5: 0, up_5_to_7: 0, up_7_to_10: 0, up_ge_10: 0,
  };
  for (const s of allStocks) {
    const cp = parseFloat(s.changepercent);
    const amt = s.amount || 0;
    if (cp > 0) up++;
    else if (cp < 0) down++;
    else flat++;
    // v2.0.7ab:涨跌分布分桶
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
    // v2.0.7ay:涨停:主板 9.97~11%(跟同花顺涨停算法 9.97% 阈值完全一致)
    // — 8/13 13:05 sandbox sina 全市场 5542 只:9.97% 阈值算 56 == 同花顺 56
    // — 之前 v2.0.7aw 9% 阈值算 70-83(盘中变化大),跟同花顺 56 差 14-27
    // — 改 9.97% 阈值后盘中跳变:开盘 0 → 早盘 30 → 中盘 60 → 收盘 80
    // — 双创 19.97~21%
    if (cp >= 9.97 && cp < 11) lu++;
    else if (cp >= 19.97 && cp < 21) lu++;
    if (cp <= -9.97 && cp > -11) ld++;
    else if (cp <= -19.97 && cp > -21) ld++;
    total += amt;
  }
  return {
    upCount: up, downCount: down, flatCount: flat,
    totalTurnover: Math.round(total / 1e8),
    limitUpCount: lu, limitDownCount: ld,
    changeDistribution: dist,
  };
}

/** 拉取今日实时数据(用于把 8.6 当日数据 push 到 history 末尾)
 * 返回: { date, volume, up, down, limitUp, limitDown } */
export async function fetchTodaySnapshot(): Promise<{
  date: string;
  volume: number;
  up: number;
  down: number;
  limitUp: number;
  limitDown: number;
} | null> {
  try {
    // v2.0.7cs:用东八区判断周末(海外 user 浏览器本地时间可能不是北京时间)
    if (_isWeekendCN()) return null;
    // 日期格式 yyyy-MM-dd — 用东八区,跟海外 user 浏览器一致
    const now8 = new Date(Date.now() + 8 * 3600 * 1000);
    const y = now8.getUTCFullYear();
    const m = String(now8.getUTCMonth() + 1).padStart(2, '0');
    const d = String(now8.getUTCDate()).padStart(2, '0');
    const date = `${y}-${m}-${d}`;
    // 拉全市场(同源 fetchEMMarketStats,55 页 hs_a,卡片和曲线图必然一致)
    const summary = await fetchMarketSummary();
    if (!summary) return null;  // 周末/fetch 失败
    // v2.0.7cu:全 0 数据(限流)→ 返 null(让 useState sticky 保留 prev 成功值)
    // — 之前返 {0,0,0,0} → setSnap today: todayResult ?? prev.today ?? 不 sticky(0 不是 null)→ 覆盖了 2.4 万亿成功值
    if (summary.totalTurnover === 0 && summary.upCount === 0 && summary.downCount === 0) {
      console.warn('[fetchTodaySnapshot] 拉到的全是 0(sina/em 限流),返 null 让 useState sticky 保留 prev 成功值');
      return null;
    }
    return {
      date,
      volume: summary.totalTurnover,
      up: summary.upCount,
      down: summary.downCount,
      limitUp: summary.limitUpCount,
      limitDown: summary.limitDownCount,
    };
  } catch (e) {
    console.warn('[live] fetchTodaySnapshot 失败:', e);
    return null;
  }
}

/** 拉取单个 sina 行业板块的实时数据
 * 通过成分股计算: 总成交额(元) + 加权涨跌幅(成交额加权) + 领涨股(涨跌幅第一的成分股) */
export async function fetchSinaIndustry(sinaLabel: string): Promise<{
  changePercent: number;      // 加权涨跌幅
  totalTurnover: number;      // 总成交额(亿)
  leaderName: string;         // 领涨股
  leaderChangePercent: number; // 领涨股涨跌幅
  stockCount: number;
} | null> {
  const stocks = await fetchSinaNode(sinaLabel, 200);
  if (stocks.length === 0) return null;
  let totalAmount = 0, weightedSum = 0;
  for (const s of stocks) {
    const cp = parseFloat(s.changepercent);
    const amt = s.amount || 0;
    totalAmount += amt;
    weightedSum += cp * amt;
  }
  const weightedPct = totalAmount > 0 ? weightedSum / totalAmount : 0;
  const leader = stocks[0];  // 已按涨跌幅降序
  return {
    changePercent: Math.round(weightedPct * 100) / 100,
    totalTurnover: Math.round(totalAmount / 1e8 * 100) / 100,
    leaderName: leader.name,
    leaderChangePercent: parseFloat(leader.changepercent),
    stockCount: stocks.length,
  };
}

/** 拉取多个 sina 行业板块实时数据(并发) */
export async function fetchSinaIndustries(labels: string[]): Promise<Map<string, Awaited<ReturnType<typeof fetchSinaIndustry>>>> {
  const result = new Map<string, any>();
  const concurrency = 6;
  for (let i = 0; i < labels.length; i += concurrency) {
    const batch = labels.slice(i, i + concurrency);
    const results = await Promise.all(batch.map((label) => fetchSinaIndustry(label).then((data) => ({ label, data }))));
    for (const { label, data } of results) {
      if (data) result.set(label, data);
    }
    // 加个小延迟避免请求过快
    if (i + concurrency < labels.length) {
      await new Promise((r) => setTimeout(r, 100));
    }
  }
  return result;
}

// =============================================================
// 东方财富 push2 实时全市场接口(浏览器直连,CORS ✓,10s 轮询稳定)
// =============================================================
// EMMarketStats 现在由 fetchSinaStatsByNode 填(虽然名字带 EM,但内部已切 sina)
// v2.0.7cs:接口本身不变,函数返回 | null(周末/null → useLiveData 不覆盖 baseData)
interface EMMarketStats {
  upCount: number;
  downCount: number;
  flatCount: number;
  totalTurnover: number;  // 亿
  limitUpCount: number;
  limitDownCount: number;
  // v2.0.7ab:涨跌分布分桶(11 档)
  changeDistribution?: {
    down_ge_10: number; down_10_to_7: number; down_7_to_5: number;
    down_5_to_3: number; down_3_to_0: number; flat: number;
    up_0_to_3: number; up_3_to_5: number; up_5_to_7: number;
    up_7_to_10: number; up_ge_10: number;
  };
}

// =============================================================
// v2.0.7f:全部改用 sina vip API(已验证浏览器 CORS ✓,跟 49 行业同源,稳定)
// 不再赌东方财富 push2(fs 编码容易失效,且有风控)
// =============================================================
/** 沪深 A 股全市场统计 — v2.0.7h:改用 fetchMarketSummary(55 页 hs_a 全量累加)
 * 跟 fetchTodaySnapshot 同源,卡片和曲线图数据必然一致
 *
 * v2.0.7cs:返回 EMMarketStats | null — 周末/null 时 useLiveData 走 baseData,避免写死 0
 * v2.0.7cu:全 0(限流)→ 返 null — 跟 fetchTodaySnapshot 一致,让 useState sticky 保留 prev 成功值 */
export async function fetchEMMarketStats(): Promise<EMMarketStats | null> {
  const r = await fetchMarketSummary();
  if (!r) return null;  // 周末/null
  // v2.0.7cu:全 0(限流)→ 返 null
  if (r.totalTurnover === 0 && r.upCount === 0 && r.downCount === 0) {
    return null;
  }
  // v2.0.7dj:涨跌停 = 0 但 mktTotal > 0(em/sina 限流返部分数据)— 返 null
  // — 8/18 11:30 早盘限流 → sina 55 页只前 5 页返 → upCount 500 但 limitUpCount=0
  // — 走 baseData 80:7(错,user 期望 sticky em 实时算的 56:4)
  // — 修法:涨跌停 0 + 涨/跌 > 0 → 限流信号 → 返 null → React state sticky prev
  if (r.limitUpCount === 0 && r.limitDownCount === 0 && (r.upCount > 0 || r.downCount > 0)) {
    console.warn('[fetchEMMarketStats] 涨跌停=0 但涨/跌>0(em/sina 限流部分数据),返 null 让 useState sticky 保留 prev 涨跌停');
    return null;
  }
  return {
    upCount: r.upCount,
    downCount: r.downCount,
    flatCount: r.flatCount,
    totalTurnover: r.totalTurnover,
    limitUpCount: r.limitUpCount,
    limitDownCount: r.limitDownCount,
    changeDistribution: r.changeDistribution,
  };
}

/** 沪深 ETF 涨跌统计 — v2.0.7ca:用 em push2 + 多域名 fallback
 * — em 拉 ETF:fs=m:0+t:9,m:1+t:9 沪深 ETF(覆盖 700+ 只)
 * — Cloudflare Workers 出口 IP 跟 sandbox 不同,可能能拉到(沙箱拉不到)
 * — 失败返 0 走 baseData(5 cron 跳变,akshare 真值)
 *
 * v2.0.7cs:返回 { up, down, flat } | null — 周末/em 都失败 → null(走 baseData 8/14 stale)
 * — 之前失败返 0 会被 useLiveData 当作"半数据 0:0"误判,看起来错 */
export async function fetchEMEtfStats(): Promise<{ up: number; down: number; flat: number } | null> {
  if (_isWeekendCN()) return null;  // 周末不调 em
  const EM_DOMAINS = [
    'https://push2.eastmoney.com',
    'https://82.push2.eastmoney.com',
    'https://push2his.eastmoney.com',
  ];
  const UA = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Referer': 'https://quote.eastmoney.com/',
    'Accept': 'application/json, text/plain, */*',
  };

  for (const domain of EM_DOMAINS) {
    try {
      // m:0+t:9 沪 ETF + m:1+t:9 深 ETF
      const url = `${domain}/api/qt/clist/get?pn=1&pz=2000&po=1&fid=f3&fs=m:0+t:9,m:1+t:9&fields=f12,f3`;
      const res = await fetch(url, { headers: UA });
      if (!res.ok) continue;
      const data = await res.json();
      if (!data?.data?.diff) continue;
      let up = 0, down = 0, flat = 0;
      for (const s of data.data.diff) {
        const pct = parseFloat(s.f3);
        if (pct > 0.01) up++;
        else if (pct < -0.01) down++;
        else flat++;
      }
      if (up + down + flat > 0) {
        return { up, down, flat };
      }
    } catch (e) {
      continue;
    }
  }
  // v2.0.7cs:都失败返 null(走 baseData 8/14 stale)— 之前返 0 会被当成"半数据 0:0"误判
  return null;
}


/** 沪深可转债涨跌统计 — v2.0.7ca:em push2 + 多域名 fallback
 * — em 可转债:fs=m:128+t:4,m:129+t:4 沪深可转债(akshare bond_zh_hs_cov_spot 同源)
 * — Cloudflare Workers 出口 IP 跟 sandbox 不同,可能能拉到(沙箱拉不到)
 * — 失败返 0 走 baseData(5 cron 跳变)虽然 stale 12-30 分钟,至少不是写死的 100:0
 *
 * v2.0.7cs:返回 null 替代 0,周末/em 失败时走 baseData 8/14 stale(显示"上周五收盘"是合理的) */
export async function fetchEMBondStats(): Promise<{ up: number; down: number; flat: number } | null> {
  if (_isWeekendCN()) return null;  // 周末不调 em
  const EM_DOMAINS = [
    'https://push2.eastmoney.com',
    'https://82.push2.eastmoney.com',
    'https://push2his.eastmoney.com',
  ];
  const UA = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Referer': 'https://quote.eastmoney.com/',
    'Accept': 'application/json, text/plain, */*',
  };

  for (const domain of EM_DOMAINS) {
    try {
      // m:128+t:4 上交所可转债 + m:129+t:4 深交所可转债
      const url = `${domain}/api/qt/clist/get?pn=1&pz=2000&po=1&fid=f3&fs=m:128+t:4,m:129+t:4&fields=f12,f3`;
      const res = await fetch(url, { headers: UA });
      if (!res.ok) continue;
      const data = await res.json();
      if (!data?.data?.diff) continue;
      let up = 0, down = 0, flat = 0;
      for (const s of data.data.diff) {
        const pct = parseFloat(s.f3);
        if (pct > 0.01) up++;
        else if (pct < -0.01) down++;
        else flat++;
      }
      if (up + down + flat > 0) {
        return { up, down, flat };
      }
    } catch (e) {
      continue;
    }
  }
  // v2.0.7cs:都失败返 null(走 baseData 8/14 stale)— 之前返 0 会被当成"半数据 0:0"误判
  return null;
}


// =============================================================
// v2.0.7ax:em 申万 90 行业实时(跟 ths 90 细分类 一一对应,不是 sina 49 行业聚合)
// — em "m:90+t:2" 申万二级行业(约 90 个)
// — 跟 ths 90 细分类 名字大部分一致(医疗服务/医疗器械/化学制药/中药 等都分开)
// — em 实时 10s 拉,按 name 模糊匹配覆盖 ths 90 细分类
// =============================================================


export interface EMIndustryItem {
  name: string;            // 申万行业名
  changePercent: number;   // 涨跌幅
  totalTurnover: number;   // 成交额(亿)
  leaderName: string;      // 领涨股
  leaderChangePercent: number;
  stockCount: number;
}

/** 拉取 em 申万 90 行业实时数据(单页 100 个,够用)
 * 返回: Map<name, EMIndustryItem> */
export async function fetchEMIndustries(): Promise<Map<string, EMIndustryItem>> {
  const params = 'pn=1&pz=200&po=1&np=1&fltt=2&invt=2&fs=m:90+t:2&fields=f3,f12,f14,f128&fid=f3';
  const result = new Map<string, EMIndustryItem>();
  for (const domain of ['https://push2.eastmoney.com', 'https://push2delay.eastmoney.com', 'https://82.push2.eastmoney.com']) {
    try {
      const r = await fetch(`${domain}/api/qt/clist/get?${params}`, { cache: 'no-store' });
      const j = await r.json();
      if (j && j.data && j.data.diff && j.data.diff.length > 0) {
        for (const s of j.data.diff) {
          const name = s.f14 || '';
          if (!name) continue;
          result.set(name, {
            name,
            changePercent: Math.round((s.f3 || 0) * 100) / 100,
            totalTurnover: 0,  // em 这个接口没成交额,留着 0(用 ths 静态)
            leaderName: s.f128 || '-',
            leaderChangePercent: 0,
            stockCount: 0,
          });
        }
        break;
      }
    } catch (e) {
      continue;
    }
  }
  return result;
}

// =============================================================
// v2.0.7cs:Cloudflare Pages Function 优先(em 实时数据走 Function,绕开 user 浏览器直连 IP 限流)
// Function 拉失败时,fallback 直连 sina/em push2(双保险)
// =============================================================

interface MarketStatsAPIResponse {
  source: 'live' | 'cache' | 'fallback' | 'weekend';
  isWeekend: boolean;
  data: EMMarketStats | null;
  fetchedAt: string;
  latency_ms: number;
  error?: string;
}

/** 全市场汇总 — v2.0.7cs:优先 /api/market-stats Function,失败 fallback fetchEMMarketStats(直连 sina) */
export async function fetchMarketStatsViaAPI(): Promise<EMMarketStats | null> {
  try {
    const res = await fetch('/api/market-stats');
    if (!res.ok) {
      console.warn('[live] /api/market-stats 失败,fallback 直连 sina:', res.status);
      return await fetchEMMarketStats();
    }
    const json: MarketStatsAPIResponse = await res.json();
    if (json.isWeekend) {
      return null;  // 周末走 baseData
    }
    if (json.data) {
      return json.data;
    }
    // data 为 null(fallback/拉失败)→ fallback 直连
    console.warn('[live] /api/market-stats data=null,fallback 直连 sina');
    return await fetchEMMarketStats();
  } catch (e) {
    console.warn('[live] /api/market-stats 异常,fallback 直连 sina:', e);
    return await fetchEMMarketStats();
  }
}

/** ETF 涨跌分布 — 优先 /api/etf-stats,失败 fallback fetchEMEtfStats */
export async function fetchEtfStatsViaAPI(): Promise<{ up: number; down: number; flat: number } | null> {
  try {
    const res = await fetch('/api/etf-stats');
    if (!res.ok) {
      console.warn('[live] /api/etf-stats 失败,fallback 直连 em:', res.status);
      return await fetchEMEtfStats();
    }
    const json = await res.json();
    if (json.isWeekend) return null;
    if (json.data) return json.data;
    return await fetchEMEtfStats();
  } catch (e) {
    console.warn('[live] /api/etf-stats 异常,fallback 直连 em:', e);
    return await fetchEMEtfStats();
  }
}

/** 可转债 涨跌分布 — 优先 /api/bond-stats,失败 fallback fetchEMBondStats */
export async function fetchBondStatsViaAPI(): Promise<{ up: number; down: number; flat: number } | null> {
  try {
    const res = await fetch('/api/bond-stats');
    if (!res.ok) {
      console.warn('[live] /api/bond-stats 失败,fallback 直连 em:', res.status);
      return await fetchEMBondStats();
    }
    const json = await res.json();
    if (json.isWeekend) return null;
    if (json.data) return json.data;
    return await fetchEMBondStats();
  } catch (e) {
    console.warn('[live] /api/bond-stats 异常,fallback 直连 em:', e);
    return await fetchEMBondStats();
  }
}
