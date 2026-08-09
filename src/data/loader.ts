// 运行时数据加载:启动时从 /data.json 拉取,作为全局只读快照
// 盘中时间(9:30-15:00)支持 60s 自动刷新
import type {
  MarketOverview,
  LadderGroup,
  LimitUpStock,
  LimitDownStock,
  SectorItem,
  BreakoutStock,
  DragonTigerStock,
  QuoteData,
  HistoryPoint,
  KLinePoint,
} from '../types';

export interface ReportData {
  meta: {
    generatedAt: string;
    tradeDate: string;
    tradeDateSlash: string;
    dataSource: string;
  };
  marketOverview: MarketOverview;
  history: HistoryPoint[];
  limitUpLadders: LadderGroup[];
  limitUpStocks: LimitUpStock[];
  firstBoardStocks: QuoteData[];
  limitDownLadders: LadderGroup[];
  limitDownStocks: LimitDownStock[];
  sectors: SectorItem[];
  conceptSectors: SectorItem[];   // 概念板块(同花顺)
  regionSectors: SectorItem[];   // 地域板块(按市场)
  breakoutStocks: BreakoutStock[];
  highBreakStocks: BreakoutStock[];
  lowPositionStocks: BreakoutStock[];
  allStrongStocks?: BreakoutStock[]; // v1.9.1:全量候选股(给客户端自定义筛选)
  sectorKlines?: Record<string, { leaderName: string; code?: string; kline: KLinePoint[] }>; // v1.9.3:行业 leader K 线(用于所处位置量化判断)
  dragonTigerStocks: DragonTigerStock[];
  surgery?: any;                 // 全景手术台数据(从 surgery.json 合并)
}

let cached: ReportData | null = null;
let inflight: Promise<ReportData> | null = null;

function normalize(j: any): ReportData {
  return {
    ...j,
    conceptSectors: j.conceptSectors || [],
    regionSectors: j.regionSectors || [],
    surgery: j.surgery,
  } as ReportData;
}

export function loadReportData(force = false): Promise<ReportData> {
  if (cached && !force) return Promise.resolve(cached);
  if (inflight) return inflight;
  // v1.9.8:加 ?t=timestamp cache busting,让每 60s reload 能拉到最新 fetch 静态
  inflight = fetch(import.meta.env.BASE_URL + 'data.json?t=' + Date.now(), { cache: 'no-cache' })
    .then((r) => {
      if (!r.ok) throw new Error(`data.json 拉取失败: ${r.status}`);
      return r.json();
    })
    .then((j) => {
      const norm = normalize(j);
      cached = norm;
      inflight = null;
      return cached;
    })
    .catch((e) => {
      inflight = null;
      throw e;
    });
  return inflight;
}

/** 强制刷新(清除缓存,重新 fetch) */
export function refreshReportData(): Promise<ReportData> {
  cached = null;
  inflight = null;
  return loadReportData(true);
}

/** 判断是否在 A 股交易时段 */
export function isLiveMarket(): boolean {
  const now = new Date();
  const day = now.getDay();
  if (day === 0 || day === 6) return false;  // 周末
  const mins = now.getHours() * 60 + now.getMinutes();
  return mins >= 9 * 60 + 30 && mins < 15 * 60;
}
