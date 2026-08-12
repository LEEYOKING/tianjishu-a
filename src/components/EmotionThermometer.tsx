// 情绪温度计组件 — v2.0.7r
// 垂直 SVG 温度计 + 数值 + 状态文字 + Hover Tooltip 显示 5 维数据
// 使用 Tailwind CSS + 极简风格

import { useState } from 'react';
export interface EmotionThermometerProps {
  temperature: number;  // 0-100
  status: string;       // 状态描述文字
  details: {
    limit_up: number;
    limit_down: number;
    max_boards: number;
    broken_rate: string;
    yest_perf?: string;
    promote_rate?: string;
  };
}

// 根据温度返回颜色(冷蓝→暖黄→热红)
function getColor(t: number): string {
  if (t <= 20) return '#2563eb';   // 蓝
  if (t <= 40) return '#06b6d4';   // 青
  if (t <= 60) return '#eab308';   // 黄
  if (t <= 80) return '#f97316';   // 橙
  return '#dc2626';                // 红
}

function getGradient(t: number): string {
  if (t <= 20) return 'linear-gradient(180deg, #2563eb 0%, #1e3a8a 100%)';
  if (t <= 40) return 'linear-gradient(180deg, #06b6d4 0%, #0e7490 100%)';
  if (t <= 60) return 'linear-gradient(180deg, #eab308 0%, #a16207 100%)';
  if (t <= 80) return 'linear-gradient(180deg, #f97316 0%, #c2410c 100%)';
  return 'linear-gradient(180deg, #dc2626 0%, #991b1b 100%)';
}

export function EmotionThermometer({ temperature, status, details }: EmotionThermometerProps) {
  const [hover, setHover] = useState(false);
  const safeT = Math.max(0, Math.min(100, temperature));
  const color = getColor(safeT);
  const gradient = getGradient(safeT);
  // 填充比例
  const fillHeight = (safeT / 100) * 64;  // SVG 内部高度 64px

  return (
    <div
      style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 12, padding: '8px 10px', borderRadius: 10, cursor: 'help' }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      {/* 左侧:垂直温度计 SVG */}
      <svg width="28" height="80" viewBox="0 0 28 80" style={{ flexShrink: 0, filter: `drop-shadow(0 0 6px ${color}55)` }}>
        {/* 圆角矩形外框 */}
        <rect x="6" y="2" width="16" height="64" rx="8" ry="8" fill="none" stroke={color} strokeWidth="1.5" opacity="0.4" />
        {/* 内部填充(从底部向上) */}
        <defs>
          <clipPath id={`thermo-clip-${safeT}`}>
            <rect x="6" y="2" width="16" height="64" rx="8" ry="8" />
          </clipPath>
        </defs>
        <rect
          x="6"
          y={2 + (64 - fillHeight)}
          width="16"
          height={fillHeight}
          fill={gradient}
          clipPath={`url(#thermo-clip-${safeT})`}
          style={{ transition: 'all 0.6s cubic-bezier(0.4, 0, 0.2, 1)' }}
        />
        {/* 刻度线 */}
        {[0, 25, 50, 75, 100].map((mark) => {
          const y = 2 + 64 - (mark / 100) * 64;
          return (
            <line key={mark} x1="2" y1={y} x2="6" y2={y} stroke="#9ca3af" strokeWidth="0.5" opacity="0.6" />
          );
        })}
        {/* 底部圆球 */}
        <circle cx="14" cy="74" r="6" fill={color} style={{ filter: `drop-shadow(0 0 4px ${color}88)` }} />
      </svg>

      {/* 右侧:数值 + 状态 */}
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
          <span style={{ fontSize: 26, fontWeight: 800, color, lineHeight: 1, fontFamily: 'system-ui, -apple-system, sans-serif', fontVariantNumeric: 'tabular-nums' }}>
            {safeT}
          </span>
          <span style={{ fontSize: 11, color: '#9ca3af', fontWeight: 500 }}>/ 100</span>
        </div>
        <div style={{ fontSize: 11, color, fontWeight: 600, marginTop: 2 }}>
          🌡 {status}
        </div>
      </div>

      {/* Hover Tooltip */}
      {hover && (
        <div
          style={{
            position: 'absolute',
            left: '100%',
            top: '50%',
            transform: 'translateY(-50%)',
            marginLeft: 8,
            background: 'rgba(17, 24, 39, 0.96)',
            color: '#fff',
            padding: '10px 14px',
            borderRadius: 8,
            fontSize: 11,
            lineHeight: 1.7,
            whiteSpace: 'nowrap',
            zIndex: 1000,
            boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
            pointerEvents: 'none',
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6, color: color }}>
            情绪温度详情
          </div>
          <div>📈 涨停: <strong style={{ color: '#ff4d4f' }}>{details.limit_up}</strong> 只</div>
          <div>📉 跌停: <strong style={{ color: '#0ecd70' }}>{details.limit_down}</strong> 只</div>
          <div>🏆 最高连板: <strong>{details.max_boards}</strong> 板</div>
          <div>💥 炸板率: <strong>{details.broken_rate}</strong></div>
          {details.yest_perf && <div>📊 昨日涨停今日: <strong>{details.yest_perf}</strong></div>}
          {details.promote_rate && <div>🚀 晋级率: <strong>{details.promote_rate}</strong></div>}
        </div>
      )}
    </div>
  );
}
