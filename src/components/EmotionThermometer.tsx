// 情绪温度计组件 — v2.0.7s(重设计:半圆弧仪表盘 + 估值/情绪双标签)
// 样式参考 user 提供的"市场温度"卡片:左半圆仪表盘 + 右侧大字 + 副标题 + 双标签

import { useState } from 'react';

export interface EmotionThermometerProps {
  temperature: number;  // 0-100 主体温度
  status: string;       // 状态描述
  details: {
    limit_up: number;
    limit_down: number;
    max_boards: number;
    broken_rate: string;
  };
  // 额外信息(可选)
  limitUpCount?: number;
  upCount?: number;
  downCount?: number;
}

// 颜色(0-100 渐变)
function getColor(t: number): string {
  if (t <= 20) return '#3b82f6';  // 冷蓝
  if (t <= 40) return '#06b6d4';  // 青
  if (t <= 60) return '#f59e0b';  // 暖黄
  if (t <= 80) return '#f97316';  // 橙
  return '#dc2626';               // 热红
}

// 描述文字(根据温度区间)
function getDescription(t: number): string {
  if (t <= 20) return '市场冰点,谨慎参与';
  if (t <= 40) return '温度低迷,情绪修复中';
  if (t <= 60) return '温度温和,无明显主线';
  if (t <= 80) return '温度温暖,赚钱效应扩散';
  return '温度炽热,警惕退潮风险';
}

// 估值标签(根据涨停家数 + 涨跌比)
function getValuationTag(limitUp: number, upCount: number, downCount: number): { text: string; color: string } {
  // 估值 = 涨停 + 涨家数多 → 极高(过热)
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

// 情绪标签(根据涨跌停比)
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

export function EmotionThermometer({ temperature, status, details, limitUpCount, upCount, downCount }: EmotionThermometerProps) {
  const [hover, setHover] = useState(false);
  const safeT = Math.max(0, Math.min(100, temperature));
  const color = getColor(safeT);
  const description = getDescription(safeT);

  const lu = limitUpCount ?? details.limit_up;
  const ld = details.limit_down;
  const valuation = getValuationTag(lu, upCount ?? 0, downCount ?? 0);
  const sentiment = getSentimentTag(lu, ld);

  // 半圆弧参数
  // SVG: viewBox 0 0 200 120
  // 圆心 (100, 100), 半径 80
  // 半圆从左下 (0°, 180°) 到右下 (180°, 0°),上方拱起
  // 弧长 = π * 80 ≈ 251
  const cx = 100;
  const cy = 100;
  const r = 80;
  // 角度:0° 指向 12 点钟方向(向上),顺时针增加
  // 左下 = 180°(9 点钟方向),右下 = 0°(3 点钟方向,这里设为 360°/0° 实际是 0° 是 3 点)
  // 实际:180° → 左下端点,0° → 右下端点,半圆从 180° 顺时针到 0°
  // SVG path 中,半圆从 (cx-r, cy) 到 (cx+r, cy),上方拱起
  // 0% = (cx-r, cy) = (20, 100),100% = (cx+r, cy) = (180, 100)

  // 计算填充弧的端点
  // 比例 0-1 映射到角度 180° → 0°(顺时针扫 180°)
  const angle = 180 - (safeT / 100) * 180;  // 180° → 0°
  const angleRad = (angle * Math.PI) / 180;
  const endX = cx + r * Math.cos(angleRad);
  const endY = cy - r * Math.sin(angleRad);

  // 填充比例 large-arc-flag
  // safeT = 0 → 角度 180° → endX = 20, endY = 100 → 在起点
  // safeT = 100 → 角度 0° → endX = 180, endY = 100 → 在终点
  // 中间所有点都在上方(y < 100),所以 large-arc-flag 始终为 0,sweep-flag = 1(顺时针)

  // 指针角度(从中心向上偏右的角度)
  const needleAngle = 180 - (safeT / 100) * 180;  // 角度 0-180(从左到右)
  const needleRad = (needleAngle * Math.PI) / 180;
  const needleLength = 65;
  const needleX = cx + needleLength * Math.cos(needleRad);
  const needleY = cy - needleLength * Math.sin(needleRad);

  return (
    <div
      style={{ padding: '16px 20px', borderRadius: 12, background: '#fff', border: '1px solid #E5E7EB', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', marginTop: 8, cursor: 'help' }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      {/* 顶部标题栏 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: '#111827' }}>市场温度</div>
        <div style={{ fontSize: 18, color: '#9ca3af', lineHeight: 1 }}>›</div>
      </div>

      {/* 主体:半圆弧 + 文字 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {/* 半圆弧 SVG */}
        <svg width="180" height="110" viewBox="0 0 200 120" style={{ flexShrink: 0 }}>
          {/* 灰色背景弧(0-100) */}
          <path
            d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
            fill="none"
            stroke="#F3F4F6"
            strokeWidth="18"
            strokeLinecap="round"
          />
          {/* 填充弧(根据温度) */}
          {safeT > 0 && (
            <path
              d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${endX} ${endY}`}
              fill="none"
              stroke={color}
              strokeWidth="18"
              strokeLinecap="round"
              style={{ transition: 'all 0.6s cubic-bezier(0.4, 0, 0.2, 1)' }}
            />
          )}
          {/* 指针 */}
          <line
            x1={cx}
            y1={cy}
            x2={needleX}
            y2={needleY}
            stroke="#111827"
            strokeWidth="3"
            strokeLinecap="round"
            style={{ transition: 'all 0.6s cubic-bezier(0.4, 0, 0.2, 1)' }}
          />
          {/* 中心点 */}
          <circle cx={cx} cy={cy} r="6" fill="#111827" />
          {/* 0° / 100° 标记 */}
          <text x={cx - r - 5} y={cy + 18} textAnchor="end" fontSize="11" fill="#9ca3af" fontWeight={500}>0°</text>
          <text x={cx + r + 5} y={cy + 18} textAnchor="start" fontSize="11" fill="#9ca3af" fontWeight={500}>100°</text>
        </svg>

        {/* 右侧:大数字 + 描述 + 估值/情绪 */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 4 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 2 }}>
            <span style={{ fontSize: 32, fontWeight: 800, color, lineHeight: 1, fontFamily: 'system-ui, -apple-system, sans-serif', fontVariantNumeric: 'tabular-nums' }}>
              {safeT}
            </span>
            <span style={{ fontSize: 14, color, fontWeight: 600 }}>°</span>
          </div>
          <div style={{ fontSize: 11, color: '#6b7280', lineHeight: 1.4 }}>
            {description}
          </div>
          <div style={{ display: 'flex', gap: 6, marginTop: 4, fontSize: 12, alignItems: 'center' }}>
            <span style={{ color: '#6b7280' }}>估值</span>
            <span style={{ color: valuation.color, fontWeight: 700 }}>{valuation.text}</span>
            <span style={{ color: '#d1d5db', margin: '0 4px' }}>|</span>
            <span style={{ color: '#6b7280' }}>情绪</span>
            <span style={{ color: sentiment.color, fontWeight: 700 }}>{sentiment.text}</span>
          </div>
        </div>
      </div>

      {/* Hover Tooltip */}
      {hover && (
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
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6, color }}>
            情绪温度 {safeT}° · {status}
          </div>
          <div>📈 涨停: <strong style={{ color: '#ff4d4f' }}>{lu}</strong> 只</div>
          <div>📉 跌停: <strong style={{ color: '#0ecd70' }}>{ld}</strong> 只</div>
          <div>🏆 最高连板: <strong>{details.max_boards}</strong> 板</div>
          <div>💥 炸板率: <strong>{details.broken_rate}</strong></div>
          {upCount !== undefined && (
            <div>📊 涨/跌家数: <strong>{upCount} / {downCount}</strong></div>
          )}
        </div>
      )}
    </div>
  );
}
