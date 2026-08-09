// A股复盘系统全局类型定义

/** 基础股票信息 */
export interface StockBase {
  code: string;
  name: string;
  industry?: string;
}

/** K 线数据点(用于"所处位置"量化判断 v1.9.3) */
export interface KLinePoint {
  date: string;
  open: number;
  close: number;
  high: number;
  low: number;
  amount: number;  // 成交额(用 amount 代理 volume,因为腾讯 K 线无 volume 字段)
}

/** 行情数据 */
export interface QuoteData extends StockBase {
  closePrice: number;
  changePercent: number;
  turnover: number; // 亿元
  volumeRatio?: number;
  turnoverRate?: number; // 换手率 %
  amount?: number; // 成交额(亿)
  sealedAmount?: number; // 封单/封板资金
  bombedCount?: number; // 炸板次数
  firstSealTime?: string; // 首次封板时间
}

/** 大盘总览 */
export interface MarketOverview {
  tradeDate: string; // 交易日 YYYYMMDD
  tradeDateSlash: string; // yy/mm/dd
  generatedAt: string; // 生成时间
  marketTurnover: number; // 全市场成交额(亿)
  turnoverDiff: number; // 较上一日增量(亿)
  shTurnover: number;
  szTurnover: number;
  bjTurnover: number;
  upCount: number;
  downCount: number;
  flatCount: number;
  upPercent: number; // 上涨占比 %
  stockTotal: number;
  limitUpCount: number;
  limitDownCount: number;
  indices: IndexQuote[];
  // 可转债 / ETF 涨跌家数(akshare 静态)
  etfUp?: number;
  etfDown?: number;
  etfFlat?: number;
  bondUp?: number;
  bondDown?: number;
  bondFlat?: number;
  // 可转债对应正股 涨/跌/平
  bondStockUp?: number;
  bondStockDown?: number;
  bondStockFlat?: number;
}

export interface IndexQuote {
  name: string;
  point: number;
  changeAmount: number; // 涨跌额
  changePercent: number;
  turnover: number; // 成交额(亿)
}

/** 历史日线数据(用于折线图) */
export interface HistoryPoint {
  date: string;
  volume: number; // 当日成交额(亿)
  limitUp: number;
  limitDown: number;
  up: number;
  down: number;
}

/** 涨跌停梯队 */
export interface LadderGroup {
  level: string; // "6板" / "2个跌停"
  count: number;
}

export interface LimitUpStock extends QuoteData {
  consecutiveDays: number;
  limitUpStats: string; // "6/6"
}

export interface LimitDownStock extends QuoteData {
  consecutiveDownDays: number;
}

/** 板块 */
export interface SectorItem {
  name: string;
  changePercent: number;
  stockCount: number;
  totalTurnover: number; // 亿
  leaderName: string;
  leaderChangePercent: number;
  limitUpCount?: number; // 今日板块内涨停股数
  upCount?: number;       // 板块内上涨家数(同花顺 summary 自带)
  downCount?: number;     // 板块内下跌家数
  netInflow?: number;     // 主力净流入(亿)— 现在已用全市场实时数据替换
  topStocks?: string[];   // 领涨个股前 2 名
}

/** 异动选股 */
export interface BreakoutStock extends QuoteData {
  volumeMultiple?: number; // 量比倍数
  breakoutPercent?: number; // 突破幅度 %
  rangePosition?: number; // 250日区间位置 %
  isNewHigh?: boolean; // 是否创 60 日新高(v1.9.1)
  isLimitUp?: boolean; // 是否涨停(v1.9.1)
}

/** 龙虎榜 */
export interface DragonTigerStock extends QuoteData {
  netBuy: number; // 净买额(亿)
  buyAmount: number;
  sellAmount: number;
  reason: string;
  details: {
    buys: SeatRow[];
    sells: SeatRow[];
  };
}

export interface SeatRow {
  direction: 'buy' | 'sell';
  seat: string;
  buyAmount: number; // 亿
  sellAmount: number; // 亿
  netAmount: number; // 亿
}
