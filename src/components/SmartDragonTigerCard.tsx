// 龙虎榜智能解读卡片 — v2.0.7q
// 接收 Python DragonTigerInterpreter.analyze_stock() 输出的结构化 JSON
// UI 极简:L1 结论 + L2 买卖对比 + L3 资金性质分布

// ============================================================
// 类型定义
// ============================================================
export interface SeatInfo {
  seat: string;
  name: string;
  type: string;        // 一线游资 / 机构 / 外资 / 散户集中营 / 量化基金 / 普通营业部
  style: string;
  icon: string;
  net_amount: number;  // 元
}

export interface ForceDistribution {
  [type: string]: number;  // 占比 %
}

export interface InterpretedData {
  stock_info: {
    code: string;
    name: string;
    reason: string;
  };
  tags: string[];
  summary_text: string;
  structured_buy_list: SeatInfo[];
  structured_sell_list: SeatInfo[];
  force_distribution: ForceDistribution;
}

// ============================================================
// 颜色配置
// ============================================================
const TAG_COLORS: Record<string, { bg: string; text: string }> = {
  '游资合力': { bg: '#F63638', text: '#fff' },
  '溢价预期': { bg: '#BF4044', text: '#fff' },
  '游资接力': { bg: '#F63638', text: '#fff' },
  '次新博弈': { bg: '#BF4044', text: '#fff' },
  '机构博弈': { bg: '#50a2fe', text: '#fff' },
  '游资出货': { bg: '#8C444F', text: '#fff' },
  '警惕低开': { bg: '#8C444F', text: '#fff' },
  '北向买入': { bg: '#9a81fc', text: '#fff' },
  '冷门': { bg: '#9ca3af', text: '#fff' },
  '普通': { bg: '#E5E7EB', text: '#4b5563' },
};

const TYPE_COLORS: Record<string, string> = {
  '一线游资': '#F63638',
  '机构': '#50a2fe',
  '外资': '#9a81fc',
  '散户集中营': '#0ecd70',
  '量化基金': '#13c2c2',
  '普通营业部': '#9ca3af',
};


// 标签 chip 样式:背景 = bg 色的 10% 透明度,文字默认用 bg(深色字)
function makeChipStyle(bg: string, text?: string) {
  const r = parseInt(bg.slice(1, 3), 16);
  const g = parseInt(bg.slice(3, 5), 16);
  const b = parseInt(bg.slice(5, 7), 16);
  return {
    padding: '3px 10px',
    borderRadius: 4,
    fontSize: 12,
    fontWeight: 600,
    background: `rgba(${r},${g},${b},0.10)`,
    // 默认 color = bg(深色字);只有显式传 text 才覆盖(用于"普通"这种浅底)
    color: text ?? bg,
  };
}

// ============================================================
// 组件
// ============================================================
export function SmartDragonTigerCard({ data }: { data: InterpretedData }) {
  // 按金额排序(买方降序,卖方按绝对值降序)
  const buys = [...data.structured_buy_list].sort((a, b) => b.net_amount - a.net_amount);
  const sells = [...data.structured_sell_list].sort((a, b) => Math.abs(b.net_amount) - Math.abs(a.net_amount));

  // 找最大金额(用于柱状图)
  const maxAmt = Math.max(
    ...buys.map(b => Math.abs(b.net_amount)),
    ...sells.map(s => Math.abs(s.net_amount)),
    1
  );

  return (
    <div
      style={{
        background: '#fff',
        border: '1px solid #E5E7EB',
        borderRadius: 14,
        padding: '20px 24px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.04), 0 0 30px 5px rgba(0,0,0,0.02)',
        marginBottom: 16,
      }}
    >
      {/* L1: 股票名 + Tags + Summary */}
      <div style={{ marginBottom: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
          <div>
            <span style={{ fontSize: 18, fontWeight: 700, color: '#111827' }}>{data.stock_info.name}</span>
            <span style={{ fontSize: 13, color: '#9ca3af', marginLeft: 10 }}>{data.stock_info.code}</span>
            {data.stock_info.reason && (
              <span style={{ fontSize: 12, color: '#6b7280', marginLeft: 10 }}>· {data.stock_info.reason}</span>
            )}
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {data.tags.map(t => {
              const c = TAG_COLORS[t] || TAG_COLORS['普通'];
              // v2.0.7x:只对"普通"这种浅底标签传 text(深灰),其他用默认 bg
              return (
                <span
                  key={t}
                  style={makeChipStyle(c.bg, t === '普通' ? c.text : undefined)}
                >
                  {t}
                </span>
              );
            })}
          </div>
        </div>
        <div
          style={{
            fontSize: 13,
            color: '#4b5563',
            lineHeight: 1.7,
            padding: '10px 14px',
            background: '#F7F8FA',
            borderRadius: 6,
            // v2.0.7t:删 borderLeft 蓝条(同色背景)
          }}
        >
          {data.summary_text}
        </div>
      </div>

      {/* L2: 买卖力量对比图 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 18 }}>
        <SeatColumn seats={buys} side="buy" maxAmt={maxAmt} />
        <SeatColumn seats={sells} side="sell" maxAmt={maxAmt} />
      </div>

      {/* L3: 资金性质分布(横条) */}
      {Object.keys(data.force_distribution).length > 0 && (
        <div>
          <div style={{ fontSize: 12, color: '#86909C', marginBottom: 8, fontWeight: 500 }}>
            买入资金性质分布
          </div>
          <div style={{ display: 'flex', height: 28, borderRadius: 4, overflow: 'hidden', background: '#F3F4F6' }}>
            {Object.entries(data.force_distribution).map(([type, pct]) => (
              <div
                key={type}
                style={{
                  width: `${pct}%`,
                  background: TYPE_COLORS[type] || '#9ca3af',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 11,
                  color: '#fff',
                  fontWeight: 600,
                  transition: 'width 0.3s',
                }}
                title={`${type} ${pct}%`}
              >
                {pct >= 8 ? `${type} ${pct}%` : ''}
              </div>
            ))}
          </div>
          {/* 图例 */}
          <div style={{ display: 'flex', gap: 14, marginTop: 8, flexWrap: 'wrap' }}>
            {Object.entries(data.force_distribution).map(([type, pct]) => (
              <span key={type} style={{ fontSize: 11, color: '#6b7280', display: 'flex', alignItems: 'center', gap: 4 }}>
                <span
                  style={{
                    display: 'inline-block',
                    width: 8,
                    height: 8,
                    borderRadius: 2,
                    background: TYPE_COLORS[type] || '#9ca3af',
                  }}
                />
                {type} <strong style={{ color: '#111827', marginLeft: 2 }}>{pct}%</strong>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// 买卖单方子组件
// ============================================================
function SeatColumn({ seats, side, maxAmt }: { seats: SeatInfo[]; side: 'buy' | 'sell'; maxAmt: number }) {
  const isBuy = side === 'buy';
  const color = isBuy ? '#ff4d4f' : '#0ecd70';
  const title = isBuy ? '买方阵营' : '卖方阵营';

  if (seats.length === 0) {
    return (
      <div>
        <div style={{ fontSize: 13, color, fontWeight: 600, marginBottom: 8 }}>{title}</div>
        <div style={{ fontSize: 12, color: '#9ca3af', padding: '12px 0' }}>无数据</div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ fontSize: 13, color, fontWeight: 600, marginBottom: 10 }}>{title}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {seats.map((s, i) => {
          const amt = s.net_amount;
          const absAmt = Math.abs(amt);
          const widthPct = (absAmt / maxAmt) * 100;
          const amtYi = (absAmt / 1e8).toFixed(2);
          const sign = isBuy ? '+' : '-';
          return (
            <div key={i}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                <span style={{ color: '#111827', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span>{s.name}</span>
                  <span
                    style={{
                      ...makeChipStyle(TYPE_COLORS[s.type] || '#9ca3af'),
                      fontSize: 10,
                      padding: '1px 6px',
                      fontWeight: 500,
                    }}
                  >
                    {s.type}
                  </span>
                </span>
                <span style={{ color, fontWeight: 600 }}>
                  {sign}{amtYi} 亿
                </span>
              </div>
              <div style={{ display: 'flex', height: 6, background: '#F3F4F6', borderRadius: 3, overflow: 'hidden' }}>
                <div
                  style={{
                    width: `${widthPct}%`,
                    // v2.0.7w:横向渐变(从浅到深)
                    background: isBuy
                      ? 'linear-gradient(90deg, #FFE7E7 0%, #ff4d4f 100%)'
                      : 'linear-gradient(90deg, #DFF7EA 0%, #0ecd70 100%)',
                    transition: 'width 0.3s',
                  }}
                />
              </div>
              <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 2 }}>{s.style}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
