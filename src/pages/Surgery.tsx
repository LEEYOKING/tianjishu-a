import { useState } from 'react';
import { Card, Tooltip, Modal, Popover } from 'antd';
import ReactECharts from 'echarts-for-react';
import { COLOR_UP, COLOR_DOWN, COLOR_TEXT, COLOR_PURPLE, COLOR_BLUE, COLOR_ORANGE } from '../utils/format';
import type { ReportData } from '../data/loader';

interface SealCard {
  code: string;
  name: string;
  industry: string;
  consecutiveDays: number;
  firstSealTime: string;
  bombedCount: number;
  sealedAmount: number;
  turnover: number;
  changePercent: number;
  closePrice: number;
  ratio: number;
  grade: 'S' | 'A' | 'B' | 'C';
  isLateSeal: boolean;
}

interface BigLoser {
  code: string;
  name: string;
  industry: string;
  changePercent: number;
  turnoverRate: number;
}

interface LoserChainItem {
  from: { code: string; name: string; consecutiveDays: number };
  to: BigLoser;
}

interface LoserIntersection {
  code: string;
  name: string;
  industry: string;
  changePercent: number;
  turnoverRate: number;
  prevStatus: string;
}

interface SurgeryData {
  meta: { generatedAt: string; tradeDate: string; tradeDateSlash: string };
  sealCards: SealCard[];
  bigLoser: BigLoser[];
  loserChain: LoserChainItem[];
  loserIntersection: LoserIntersection[];
  prevLimitUpCount: number;
  systemWarning: boolean;
  north: { type: string; netBuy: number; netInflow: number; index: string; indexChange: number }[];
  northTotal: number;
}

// 评级配色(S紫、A蓝、B橙、C浅绿),背景色统一变浅
const COLOR_C_LIGHT = '#52c41a';
const GRADE_STYLE: Record<string, { bg: string; border: string; letter: string; badge: string }> = {
  S: { bg: '#F4ECFF', border: COLOR_PURPLE, letter: COLOR_PURPLE, badge: COLOR_PURPLE },
  A: { bg: '#E8F0FF', border: COLOR_BLUE, letter: COLOR_BLUE, badge: COLOR_BLUE },
  B: { bg: '#FFF1DC', border: COLOR_ORANGE, letter: COLOR_ORANGE, badge: COLOR_ORANGE },
  C: { bg: '#EAFAE0', border: COLOR_C_LIGHT, letter: COLOR_C_LIGHT, badge: COLOR_C_LIGHT },
};

// 气泡提示(用户 #13 反馈:hover 即弹出)
const HelpPopover = (
  <div style={{ width: 280, fontSize: 12, lineHeight: 1.7, color: '#4E5969' }}>
    <div style={{ fontWeight: 600, color: COLOR_TEXT, marginBottom: 6 }}>封成比 = 收盘封单金额 / 全天成交额</div>
    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
      <span style={{ color: COLOR_PURPLE, fontWeight: 600 }}>S级</span>
      <span>封成比 &gt; 3(极致缩量)</span>
    </div>
    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
      <span style={{ color: COLOR_BLUE, fontWeight: 600 }}>A级</span>
      <span>封成比 1-3(健康换手)</span>
    </div>
    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
      <span style={{ color: COLOR_ORANGE, fontWeight: 600 }}>B级</span>
      <span>封成比 0.3-1(分歧较大)</span>
    </div>
    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
      <span style={{ color: COLOR_C_LIGHT, fontWeight: 600 }}>C级</span>
      <span>封成比 &lt; 0.3(烂板/弱势)</span>
    </div>
    <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid #F0F0F0', color: '#86909C' }}>
      14:00 后首封标记"<span style={{ color: COLOR_UP }}>尾盘偷鸡</span>"并降一级
    </div>
  </div>
);

export default function Surgery(_props: { data?: ReportData }) {
  // 通过 useLive 拿 data(实际 props 也会传,但更稳的获取是从全局 context)
  // Surgery 数据来自 baseData.surgery(已合并到 data.json)
  // 我们需要从 useLive 找到 data(没直接暴露)— 通过 React 顶层 props 拿
  // 注:Surgery 数据 static,没法 live 更新;但页面通过父组件 props.data 拿到
  // 这里通过 context 拿不到 baseData,我们用 props
  // 改用 props
  return <SurgeryInner data={_props.data} />;
}

function SurgeryInner({ data }: { data?: ReportData }) {
  const surgery = data?.surgery;
  const [selectedCard, setSelectedCard] = useState<SealCard | null>(null);

  if (!surgery) {
    return <div style={{ padding: 24, color: '#86909C' }}>加载中...</div>;
  }

  const { sealCards, loserChain, systemWarning, prevLimitUpCount, meta } = surgery as SurgeryData;
  const { tradeDateSlash } = meta;
  // v2.0.7ad:用 meta.generatedAt(数据本身生成时间) + tradeDate(数据交易日)
  // 不再用 live.fetchedAt(那是页面 fetch 时间,会跟着每次 live tick 变)
  // generatedTime 格式: HH:MM
  const generatedTime = (meta.generatedAt || '').split(' ')[1] || '';

  return (
    <div>
      {/* 页面头(标题+副标题作为整体) — 跟其他页一致:sticky 顶部悬浮 + paddingTop 20 全局外边距 + 背景 #F7F9FC */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 100,
        background: '#F7F9FC',
        paddingTop: 20,
        paddingBottom: 12,
        marginBottom: 16,
      }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <h2 style={{ fontSize: 20, fontWeight: 600, color: COLOR_TEXT, margin: 0 }}>全景手术台</h2>
          {/* 用户 #4 反馈:标签文字色 #4b5563 */}
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            fontSize: 11, color: '#4b5563', background: '#F0F1F2',
            padding: '3px 8px', borderRadius: 10,
          }}>
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#4b5563' }} />
            收盘复盘数据
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ fontSize: 12, color: '#86909C' }}>
            报告日期 <span style={{ color: COLOR_TEXT, fontWeight: 500 }}>{tradeDateSlash}</span>
            <span style={{ margin: '0 12px' }}>·</span>
            生成时间 <span style={{ color: COLOR_TEXT, fontWeight: 500 }}>{tradeDateSlash} {generatedTime}</span>
          </div>
          <button
            onClick={() => location.reload()}
            style={{
              border: '1px solid #E5E6EB', background: '#fff', color: COLOR_TEXT,
              borderRadius: 6, padding: '4px 12px', fontSize: 12, cursor: 'pointer',
              display: 'inline-flex', alignItems: 'center', gap: 4,
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 12a9 9 0 1 0 3-6.7M3 4v5h5" />
            </svg>
            刷新
          </button>
        </div>
      </div>
      <div style={{ fontSize: 12, color: '#86909C' }}>
        盘后深度复盘 · 涨停封成比 / 亏钱传导 / 北向真假外资 · 更新于 {generatedTime}
      </div>
      </div>

      {systemWarning && (
        <div
          style={{
            background: '#FFF1F0', border: '1px solid #FFA39E', borderRadius: 8,
            padding: '12px 20px', marginBottom: 16,
            display: 'flex', alignItems: 'center', gap: 12, color: '#CF1322', fontSize: 13,
          }}
        >
          <span style={{ fontSize: 18 }}>⚠️</span>
          <span><b>【系统性退潮警告】</b>昨日涨停股今日大面积跌停,亏钱效应炸裂。建议:今日所有追高操作胜率低于 20%,请清空短线仓位或逆回购。</span>
        </div>
      )}

      {/* 涨跌停封成比动态评分 — 用户 #13 反馈:删"S 紫 / A 蓝 / B 橙 / C 浅绿"文案,改 hover 气泡 */}
      <Card
        bodyStyle={{ padding: 20 }}
        style={{ borderRadius: 14, marginBottom: 16 }}
        title={
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 15, fontWeight: 600, color: COLOR_TEXT }}>
              涨跌停封成比动态评分 ({sealCards.length}只)
            </span>
            <Popover
              content={HelpPopover}
              trigger="hover"
              placement="leftTop"
            >
              {/* 用户 #13 反馈:浅灰色感叹号 icon,hover 即弹出气泡
                  用户 #12 反馈:去掉 cursor:help(不显示"?"icon) */}
              <span
                style={{
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  width: 22, height: 22, borderRadius: '50%',
                  color: '#C9CDD4',
                }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="16" x2="12" y2="12" />
                  <line x1="12" y1="8" x2="12.01" y2="8" />
                </svg>
              </span>
            </Popover>
          </div>
        }
      >
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 10 }}>
          {sealCards.map((card) => (
            <SealCardItem key={card.code} card={card} onClick={() => setSelectedCard(card)} />
          ))}
        </div>
      </Card>

      {/* 亏钱效应传导链 */}
      <Card
        bodyStyle={{ padding: 20 }}
        style={{ borderRadius: 14, marginBottom: 16 }}
        title={
          <span style={{ fontSize: 15, fontWeight: 600, color: COLOR_TEXT }}>
            亏钱效应传导链 (大盘股 {loserChain.length} 只 · 昨日涨停 → 今日大跌 {(surgery as SurgeryData).loserIntersection.length} 只)
          </span>
        }
      >
        {loserChain.length === 0 ? (
          <div style={{ padding: '24px 0', textAlign: 'center', color: '#86909C', fontSize: 13 }}>
            今日无明显亏钱传导,昨日涨停 {prevLimitUpCount} 只中无大跌股,情绪稳定
          </div>
        ) : (
          <div>
            <div style={{ fontSize: 12, color: '#86909C', marginBottom: 12 }}>
              以下是昨日涨停(连板龙头) → 今日跌幅 &gt; 7% 且换手率 &gt; 15% 的传导路径
            </div>
            <LoserChainTable chain={loserChain} />
          </div>
        )}
      </Card>

      {/* 封板心电图弹窗 */}
      <Modal
        open={!!selectedCard}
        onCancel={() => setSelectedCard(null)}
        footer={null}
        width={600}
        title={selectedCard ? `${selectedCard.name} (${selectedCard.code}) 封板心电图` : ''}
      >
        {selectedCard && <SealCardDetail card={selectedCard} />}
      </Modal>
    </div>
  );
}

function SealCardItem({ card, onClick }: { card: SealCard; onClick: () => void }) {
  const s = GRADE_STYLE[card.grade];
  return (
    <Tooltip title={`${card.name} (${card.code})\n封单 ${card.sealedAmount}亿 / 成交 ${card.turnover}亿\n首封 ${card.firstSealTime} ${card.isLateSeal ? '(尾盘偷鸡)' : ''}`}>
      <div
        onClick={onClick}
        style={{
          background: s.bg,
          opacity: 0.4,  // v2.0.7ad:卡片加不透明度
          border: `1.5px solid ${s.border}`,
          borderRadius: 8,
          padding: '12px 14px',
          cursor: 'pointer',
          transition: 'transform .15s, box-shadow .15s',
          position: 'relative',
          minHeight: 110,
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'translateY(-2px)';
          e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = '';
          e.currentTarget.style.boxShadow = '';
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: COLOR_TEXT }}>{card.name}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
            <span style={{
              fontSize: 22, fontWeight: 700, color: s.letter,
            }}>{card.ratio.toFixed(2)}</span>
            <span style={{ fontSize: 10, color: '#86909C' }}>封成比</span>
          </div>
          {/* 用户 #11 反馈:评级 S\A\B\C 字号 30px(原 36) + 加粗 */}
          <div style={{
            fontSize: 30, fontWeight: 900, color: s.letter,
            fontFamily: '"PingFang SC", "Microsoft YaHei", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
            lineHeight: 1, letterSpacing: 0,
          }}>{card.grade}</div>
        </div>
        <div style={{ fontSize: 11, color: '#86909C', lineHeight: 1.4 }}>
          连板{card.consecutiveDays} · 开板{card.bombedCount} · {card.firstSealTime}
          {card.isLateSeal && <span style={{ color: COLOR_UP, marginLeft: 4 }}>(尾盘偷鸡)</span>}
        </div>
      </div>
    </Tooltip>
  );
}

// ====== 封板心电图弹窗内容 ======
function SealCardDetail({ card }: { card: SealCard }) {
  const s = GRADE_STYLE[card.grade];
  // 模拟分时曲线:从 09:30 开始,在首封时间点拉升到涨停价,之后维持(开板则下跌)
  const firstMin = parseTimeMin(card.firstSealTime);
  const openPrice = card.closePrice / 1.1;
  const limitPrice = card.closePrice;
  // 生成分钟序列
  const points: { time: string; value: number; sealed: boolean }[] = [];
  for (let m = -5; m <= 242; m++) {
    const time = formatMin(m);
    let value: number;
    if (m < 0) {
      value = openPrice * (0.998 + 0.002 * Math.random());
    } else if (m < firstMin) {
      // 涨停前:缓慢上升
      const progress = m / firstMin;
      value = openPrice + (limitPrice - openPrice) * progress * 0.85;
    } else {
      // 涨停后:围绕涨停价波动,开板次数影响
      const bombEffect = card.bombedCount > 0 ? Math.sin(m * 0.05) * 0.02 : 0;
      value = limitPrice * (1 - bombEffect - 0.001 * Math.random());
    }
    points.push({ time, value, sealed: m >= firstMin });
  }
  // const _limitLine = Array(points.length).fill(limitPrice);

  const option = {
    animation: true,
    animationDuration: 1200,
    animationEasing: 'cubicOut' as const,
    grid: { top: 20, right: 30, left: 60, bottom: 30 },
    tooltip: {
      trigger: 'axis' as const,
      axisPointer: { type: 'cross' as const },
      backgroundColor: '#fff',
      borderColor: '#E5E6EB',
      borderWidth: 1,
      textStyle: { color: COLOR_TEXT, fontSize: 12 },
      formatter: (params: any) => {
        const p = params[0];
        return `<div style="font-weight:600;color:#111827;font-size:13px;margin-bottom:4px;">${p.name}</div><div style="color:#111827;font-size:13px;">价格: ${p.value.toFixed(2)}</div>`;
      },
    },
    xAxis: {
      type: 'category' as const,
      data: points.map((p) => p.time),
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { color: '#86909C', fontSize: 10, interval: Math.floor(points.length / 8) },
    },
    yAxis: {
      type: 'value' as const,
      scale: true,
      axisLine: { show: false },
      splitLine: { lineStyle: { color: '#F0F0F0', type: 'dashed' as const } },
      axisLabel: { color: '#86909C', fontSize: 11, formatter: (v: number) => v.toFixed(2) },
    },
    series: [
      {
        name: '分时价',
        type: 'line' as const,
        data: points.map((p) => p.value),
        smooth: true,
        symbol: 'none' as const,
        lineStyle: { color: s.letter, width: 2 },
        areaStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: `${s.letter}30` }, { offset: 1, color: `${s.letter}05` }] } },
        markLine: {
          symbol: 'none',
          data: [{ yAxis: limitPrice, label: { formatter: '涨停价', color: COLOR_UP, position: 'end' }, lineStyle: { color: COLOR_UP, type: 'dashed' as const } }],
        },
      },
    ],
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 16, padding: '12px 16px', background: s.bg, borderRadius: 8 }}>
        <span style={{ fontSize: 14, color: COLOR_TEXT }}>评级</span>
        <span style={{ fontSize: 48, fontWeight: 900, color: s.letter, lineHeight: 1 }}>{card.grade}</span>
        <div style={{ flex: 1, textAlign: 'right' }}>
          <div style={{ fontSize: 12, color: '#86909C' }}>封成比</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: s.letter }}>{card.ratio.toFixed(2)}</div>
        </div>
      </div>
      <ReactECharts option={option} style={{ height: 300 }} />
      <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, fontSize: 12 }}>
        <div><span style={{ color: '#86909C' }}>首封:</span> <span style={{ fontWeight: 600, color: COLOR_TEXT }}>{card.firstSealTime}</span></div>
        <div><span style={{ color: '#86909C' }}>开板:</span> <span style={{ fontWeight: 600, color: COLOR_TEXT }}>{card.bombedCount}次</span></div>
        <div><span style={{ color: '#86909C' }}>封单:</span> <span style={{ fontWeight: 600, color: COLOR_TEXT }}>{card.sealedAmount.toFixed(2)}亿</span></div>
        <div><span style={{ color: '#86909C' }}>成交:</span> <span style={{ fontWeight: 600, color: COLOR_TEXT }}>{card.turnover.toFixed(2)}亿</span></div>
      </div>
    </div>
  );
}

function LoserChainTable({ chain }: { chain: LoserChainItem[] }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {chain.map((c, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', background: '#F7F8FA', borderRadius: 8 }}>
          <span style={{ fontSize: 13, color: COLOR_TEXT, fontWeight: 600 }}>{c.from.name}</span>
          <span style={{ fontSize: 11, color: '#86909C' }}>({c.from.consecutiveDays}连板)</span>
          <span style={{ fontSize: 16, color: COLOR_DOWN }}>→</span>
          <span style={{ fontSize: 13, color: COLOR_DOWN, fontWeight: 600 }}>{c.to.name}</span>
          <span style={{ fontSize: 11, color: '#86909C' }}>({c.to.industry})</span>
          <span style={{ flex: 1 }} />
          <span style={{ fontSize: 12, color: COLOR_DOWN, fontWeight: 600 }}>{c.to.changePercent.toFixed(2)}%</span>
        </div>
      ))}
    </div>
  );
}

function parseTimeMin(t: string): number {
  // "09:30:45" -> 分钟(从 09:25 集合竞价开始计)
  if (!t || t.length < 5) return 60;
  const [h, m, s] = t.split(':').map(Number);
  return (h - 9) * 60 + m - 25 + (s ? s / 60 : 0);
}

function formatMin(m: number): string {
  const totalMin = 9 * 60 + 25 + m;
  const h = Math.floor(totalMin / 60);
  const min = Math.floor(totalMin % 60);
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}
