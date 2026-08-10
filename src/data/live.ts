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

/** 拉取全市场汇总 — 通过并发拉 50 个 page (按代码排序,每页 100 = 5000 只 ≈ 全市场)
 * sina 限制 num=100 但支持 page=1..50, sort=code 时按代码顺序翻页
 * 并发 10 个 page, 总耗时 ~5s
 *
 * 注:limitUpCount/limitDownCount **不返回**(用 zt_pool 静态更准)
 *    上/跌/平/成交 用 sina 实时累加 */
export async function fetchMarketSummary(): Promise<{ upCount: number; downCount: number; flatCount: number; totalTurnover: number }> {
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
  }
  let up = 0, down = 0, flat = 0, total = 0;
  for (const s of allStocks) {
    const cp = parseFloat(s.changepercent);
    if (cp > 0) up++;
    else if (cp < 0) down++;
    else flat++;
    total += s.amount || 0;
  }
  return { upCount: up, downCount: down, flatCount: flat, totalTurnover: Math.round(total / 1e8) };
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
    // 检查是否为工作日
    const now = new Date();
    const day = now.getDay();
    if (day === 0 || day === 6) return null;  // 周末不返回
    // 日期格式 yyyy-MM-dd
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    const date = `${y}-${m}-${d}`;
    // 拉全市场
    const summary = await fetchMarketSummary();
    return {
      date,
      volume: summary.totalTurnover,
      up: summary.upCount,
      down: summary.downCount,
      limitUp: 0,  // 静态用 zt_pool 算更准
      limitDown: 0,
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
const EM_BASE = 'https://push2.eastmoney.com/api/qt/clist/get';
// f2=最新价 f3=涨跌幅% f6=成交额 f12=代码 f14=名称
const EM_FIELDS = 'f2,f3,f6,f12,f14';

interface EMStock {
  f2: number;  // 现价
  f3: number;  // 涨跌幅
  f6: number;  // 成交额
  f12: string; // 代码
  f14: string; // 名称
}

interface EMMarketResp {
  data?: { total?: number; diff?: EMStock[] };
}

interface EMMarketStats {
  upCount: number;
  downCount: number;
  flatCount: number;
  totalTurnover: number;  // 亿
  limitUpCount: number;
  limitDownCount: number;
}

async function emFetch(fs: string, pz = 5000): Promise<EMStock[]> {
  const url = `${EM_BASE}?pn=1&pz=${pz}&po=1&fid=f3&fs=${encodeURIComponent(fs)}&fields=${EM_FIELDS}`;
  const r = await fetch(url);
  if (!r.ok) throw new Error(`EM ${fs} HTTP ${r.status}`);
  const j: EMMarketResp = await r.json();
  return j.data?.diff || [];
}

/** 沪深 A 股全市场(5000 一次,漏 400 只≈7% 误差,可忽略) */
export async function fetchEMMarketStats(): Promise<EMMarketStats> {
  const fs = 'm:0+t:6,m:0+t:80,m:1+t:2,m:1+t:23';
  const list = await emFetch(fs, 5000);
  let up = 0, down = 0, flat = 0, total = 0;
  let lu = 0, ld = 0;
  for (const s of list) {
    const pct = s.f3 || 0;
    const turnover = s.f6 || 0;
    total += turnover;
    if (pct > 0) up++;
    else if (pct < 0) down++;
    else flat++;
    // 涨停:主板 9.9%~11%,创业板/科创板 19.9%~21%
    if (pct >= 9.9 && pct < 11) lu++;
    else if (pct >= 19.9 && pct < 21) lu++;
    // 跌停
    if (pct <= -9.9 && pct > -11) ld++;
    else if (pct <= -19.9 && pct > -21) ld++;
  }
  return {
    upCount: up,
    downCount: down,
    flatCount: flat,
    totalTurnover: Math.round(total / 1e8),
    limitUpCount: lu,
    limitDownCount: ld,
  };
}

/** 沪深 ETF 涨跌统计 */
export async function fetchEMEtfStats(): Promise<{ up: number; down: number; flat: number }> {
  const list = await emFetch('m:0+t:19,m:1+t:19', 1000);
  let up = 0, down = 0, flat = 0;
  for (const s of list) {
    const pct = s.f3 || 0;
    if (pct > 0) up++;
    else if (pct < 0) down++;
    else flat++;
  }
  return { up, down, flat };
}

/** 沪深可转债涨跌统计 */
export async function fetchEMBondStats(): Promise<{ up: number; down: number; flat: number }> {
  const list = await emFetch('m:0+t:11,m:1+t:11', 1000);
  let up = 0, down = 0, flat = 0;
  for (const s of list) {
    const pct = s.f3 || 0;
    if (pct > 0) up++;
    else if (pct < 0) down++;
    else flat++;
  }
  return { up, down, flat };
}
