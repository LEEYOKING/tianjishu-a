// 情绪温度计组件 — v2.0.7z(5 维度直接相加,user 最新算法)
// 修复 v2.0.7u 溢出 + v2.0.7w 删标题/hover + v2.0.7y 修 0°/100° + 加维度得分明细

import { useState } from 'react';

export interface EmotionThermometerProps {
  temperature: number;  // 0-100
  status: string;       // "绝对冰点" / "低温分歧" / ...
  statusDesc: string;   // "退潮末期,试错期"
  details: {
    limit_up: number;
    limit_down: number;
    max_boards: number;
    broken_rate: string;
    broken_count: number;
    yest_perf: string;
    promote_rate: string;
    limit_ratio: string;
  };
  dimension_scores?: {
    '涨跌停对比': number;
    '连板高度': number;
    '炸板率': number;
    '昨日涨停今日': number;
    '晋级率': number;
  };
  limitUpCount?: number;
  upCount?: number;
  downCount?: number;
}

// 颜色(0-100 渐变)— 5 档:蓝 → 青 → 暖黄 → 橙 → 红
function getColor(t: number): string {
  if (t <= 20) return '#3b82f6';  // 冷蓝
  if (t <= 40) return '#06b6d4';  // 青
  if (t <= 60) return '#f59e0b';  // 暖黄
  if (t <= 80) return '#f97316';  // 橙
  return '#dc2626';               // 热红
}

function getValuationTag(limitUp: number, upCount: number, downCount: number): { text: string; color: string } {
  if (limitUp >= 80 || (upCount > downCount * 3 && upCount > 3000)) {
    return { text: '极高', color: '#dc2626' };
  }
  if (limitUp >= 30 || upCount > downCount * 1.5) {
    return { text: '偏高', color: '#f97316' };
  }
  if (limitUp >= 10) {
    return { text: '中位', color: '#f59e0b' };
  }
  return { text: '低位', color: '#06b6d4' };
}

function getSentimentTag(limitUp: number, limitDown: number): { text: string; color: string } {
  const ratio = limitUp / Math.max(limitDown, 1);
  if (limitDown >= 30) return { text: '恐慌', color: '#06b6d4' };
  if (ratio > 10) return { text: '亢奋', color: '#dc2626' };
  if (ratio > 5) return { text: '活跃', color: '#f97316' };
  if (ratio > 2) return { text: '乐观', color: '#f59e0b' };
  if (ratio > 1) return { text: '平稳', color: '#84cc16' };
  if (ratio > 0.5) return { text: '谨慎', color: '#06b6d4' };
  return { text: '低迷', color: '#3b82f6' };
}

export function EmotionThermometer({
  temperature,
  status,
  statusDesc,
  details,
  dimension_scores,
  limitUpCount,
  upCount,
  downCount,
}: EmotionThermometerProps) {
  const [hover, setHover] = useState(false);
  const safeT = Math.max(0, Math.min(100, temperature));
  const color = getColor(safeT);

  const lu = limitUpCount ?? details.limit_up;
  const ld = details.limit_down;
  const valuation = getValuationTag(lu, upCount ?? 0, downCount ?? 0);
  const sentiment = getSentimentTag(lu, ld);

  // 半圆弧参数
  const cx = 100;
  const cy = 100;
  const r = 70;
  const angle = 180 - (safeT / 100) * 180;
  const angleRad = (angle * Math.PI) / 180;
  const endX = cx + r * Math.cos(angleRad);
  const endY = cy - r * Math.sin(angleRad);
  const needleLength = 56;
  const needleX = cx + needleLength * Math.cos(angleRad);
  const needleY = cy - needleLength * Math.sin(angleRad);

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        padding: '12px 8px 8px',
        borderRadius: 10,
        background: 'transparent',
        cursor: 'help',
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        {/* 半圆弧 SVG */}
        <svg width="100%" height="92" viewBox="0 0 200 120" style={{ display: 'block' }}>
          <path
            d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
            fill="none"
            stroke="#F3F4F6"
            strokeWidth="14"
            strokeLinecap="round"
          />
          {safeT > 0 && (
            <path
              d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${endX} ${endY}`}
              fill="none"
              stroke={color}
              strokeWidth="14"
              strokeLinecap="round"
              style={{ transition: 'all 0.6s cubic-bezier(0.4, 0, 0.2, 1)' }}
            />
          )}
          <line
            x1={cx}
            y1={cy}
            x2={needleX}
            y2={needleY}
            stroke="#111827"
            strokeWidth="2.5"
            strokeLinecap="round"
            style={{ transition: 'all 0.6s cubic-bezier(0.4, 0, 0.2, 1)' }}
          />
          <circle cx={cx} cy={cy} r="5" fill="#111827" />
          <text x={cx - r - 4} y={116} textAnchor="end" fontSize="11" fill="#6b7280" fontWeight={600}>0°</text>
          <text x={cx + r + 4} y={116} textAnchor="start" fontSize="11" fill="#6b7280" fontWeight={600}>100°</text>
        </svg>

        {/* 大数字 + 状态名 */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, marginTop: 4 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 2 }}>
            <span style={{ fontSize: 26, fontWeight: 800, color, lineHeight: 1, fontFamily: 'system-ui, -apple-system, sans-serif', fontVariantNumeric: 'tabular-nums' }}>
              {safeT}
            </span>
            <span style={{ fontSize: 13, color, fontWeight: 600 }}>°</span>
          </div>
          {/* v2.0.7z:显示状态名 + 描述 */}
          <div style={{ fontSize: 12, color, fontWeight: 700, lineHeight: 1.3, textAlign: 'center' }}>
            {status}
          </div>
          <div style={{ fontSize: 10, color: '#9ca3af', lineHeight: 1.3, textAlign: 'center' }}>
            {statusDesc}
          </div>
        </div>

        {/* 估值 / 情绪 标签 */}
        <div style={{ display: 'flex', gap: 10, marginTop: 8, fontSize: 14, alignItems: 'center' }}>
          <span>
            <span style={{ color: '#6b7280' }}>估值</span>{' '}
            <strong style={{ color: valuation.color, fontWeight: 700 }}>{valuation.text}</strong>
          </span>
          <span style={{ color: '#d1d5db' }}>|</span>
          <span>
            <span style={{ color: '#6b7280' }}>情绪</span>{' '}
            <strong style={{ color: sentiment.color, fontWeight: 700 }}>{sentiment.text}</strong>
          </span>
        </div>
      </div>

      {/* v2.0.7z:Hover 显示 5 维度得分明细 */}
      {hover && dimension_scores && (
        <div
          style={{
            position: 'absolute',
            left: '50%',
            top: '100%',
            transform: 'translateX(-50%)',
            marginTop: 8,
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
            minWidth: 200,
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6, color }}>
            情绪温度 {safeT}° · 基础 50 + 维度得分
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '2px 12px' }}>
            <span>📊 涨跌停对比</span>
            <span style={{ color: dimension_scores['涨跌停对比'] > 0 ? '#86efac' : dimension_scores['涨跌停对比'] < 0 ? '#fca5a5' : '#9ca3af', fontWeight: 700, textAlign: 'right' }}>
              {dimension_scores['涨跌停对比'] > 0 ? '+' : ''}{dimension_scores['涨跌停对比']}
            </span>
            <span>🏆 连板高度</span>
            <span style={{ color: dimension_scores['连板高度'] > 0 ? '#86efac' : dimension_scores['连板高度'] < 0 ? '#fca5a5' : '#9ca3af', fontWeight: 700, textAlign: 'right' }}>
              {dimension_scores['连板高度'] > 0 ? '+' : ''}{dimension_scores['连板高度']}
            </span>
            <span>💥 炸板率</span>
            <span style={{ color: dimension_scores['炸板率'] > 0 ? '#86efac' : dimension_scores['炸板率'] < 0 ? '#fca5a5' : '#9ca3af', fontWeight: 700, textAlign: 'right' }}>
              {dimension_scores['炸板率'] > 0 ? '+' : ''}{dimension_scores['炸板率']}
            </span>
            <span>📈 昨日涨停今日</span>
            <span style={{ color: dimension_scores['昨日涨停今日'] > 0 ? '#86efac' : dimension_scores['昨日涨停今日'] < 0 ? '#fca5a5' : '#9ca3af', fontWeight: 700, textAlign: 'right' }}>
              {dimension_scores['昨日涨停今日'] > 0 ? '+' : ''}{dimension_scores['昨日涨停今日']}
            </span>
            <span>🚀 晋级率</span>
            <span style={{ color: dimension_scores['晋级率'] > 0 ? '#86efac' : dimension_scores['晋级率'] < 0 ? '#fca5a5' : '#9ca3af', fontWeight: 700, textAlign: 'right' }}>
              {dimension_scores['晋级率'] > 0 ? '+' : ''}{dimension_scores['晋级率']}
            </span>
          </div>
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.15)', marginTop: 6, paddingTop: 6, fontSize: 10, color: '#d1d5db' }}>
            涨跌停 {details.limit_up}/{details.limit_down} · 比例 {details.limit_ratio}<br />
            最高连板 {details.max_boards}板 · 炸板率 {details.broken_rate}<br />
            昨日涨停今日 {details.yest_perf} · 晋级率 {details.promote_rate}
          </div>
        </div>
      )}
    </div>
  );
}
