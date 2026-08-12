// 情绪温度计组件 — v2.0.7u(半圆弧 + 上下布局 + 删边框 + 颜色随温度变)
// 修复 v2.0.7s 问题:宽度溢出 + 改上下布局

export interface EmotionThermometerProps {
  temperature: number;  // 0-100
  details: {
    limit_up: number;
    limit_down: number;
    max_boards: number;
    broken_rate: string;
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

function getDescription(t: number): string {
  if (t <= 20) return '市场冰点,谨慎参与';
  if (t <= 40) return '温度低迷,情绪修复中';
  if (t <= 60) return '温度温和,无明显主线';
  if (t <= 80) return '温度温暖,赚钱效应扩散';
  return '温度炽热,警惕退潮风险';
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

export function EmotionThermometer({ temperature, details, limitUpCount, upCount, downCount }: EmotionThermometerProps) {
  // v2.0.7w:删 hover(useState 不用了)
  const safeT = Math.max(0, Math.min(100, temperature));
  const color = getColor(safeT);
  const description = getDescription(safeT);
  // status 现在未用(删 Tooltip 后),保留以备后用

  const lu = limitUpCount ?? details.limit_up;
  const ld = details.limit_down;
  const valuation = getValuationTag(lu, upCount ?? 0, downCount ?? 0);
  const sentiment = getSentimentTag(lu, ld);

  // 半圆弧参数 — viewBox 固定 200x120,SVG 用 width="100%" 自适应
  // 圆心 (100, 100), 半径 70
  const cx = 100;
  const cy = 100;
  const r = 70;
  // 比例 0-1 映射到角度 180° → 0°(顺时针扫 180°)
  const angle = 180 - (safeT / 100) * 180;
  const angleRad = (angle * Math.PI) / 180;
  const endX = cx + r * Math.cos(angleRad);
  const endY = cy - r * Math.sin(angleRad);

  // 指针端点
  const needleLength = 56;
  const needleX = cx + needleLength * Math.cos(angleRad);
  const needleY = cy - needleLength * Math.sin(angleRad);

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',       // v2.0.7u:撑满父容器(避免溢出 200px 侧栏)
        padding: '12px 8px 8px',
        borderRadius: 10,
        background: 'transparent',   // v2.0.7u:无背景
        cursor: 'help',
      }}
      
      
    >
      {/* v2.0.7w:删标题栏 + 半圆弧 + 文字(上下布局) */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        {/* 半圆弧 SVG */}
        {/* v2.0.7w:viewBox 高度加到 120,给 0° / 100° 留位置 */}
        <svg width="100%" height="92" viewBox="0 0 200 120" style={{ display: 'block' }}>
          {/* 灰色背景弧 */}
          <path
            d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
            fill="none"
            stroke="#F3F4F6"
            strokeWidth="14"
            strokeLinecap="round"
          />
          {/* 填充弧 */}
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
          {/* 指针 */}
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
          {/* 中心点 */}
          <circle cx={cx} cy={cy} r="5" fill="#111827" />
          {/* v2.0.7w:0° / 100° 标记 — 移到弧外(y = 116) */}
          <text x={cx - r - 4} y={116} textAnchor="end" fontSize="11" fill="#6b7280" fontWeight={600}>0°</text>
          <text x={cx + r + 4} y={116} textAnchor="start" fontSize="11" fill="#6b7280" fontWeight={600}>100°</text>
        </svg>

        {/* 文字:大数字 + 描述 + 估值/情绪 */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, marginTop: 4 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 2 }}>
            <span style={{ fontSize: 26, fontWeight: 800, color, lineHeight: 1, fontFamily: 'system-ui, -apple-system, sans-serif', fontVariantNumeric: 'tabular-nums' }}>
              {safeT}
            </span>
            <span style={{ fontSize: 13, color, fontWeight: 600 }}>°</span>
          </div>
          <div style={{ fontSize: 11, color: '#6b7280', lineHeight: 1.3, textAlign: 'center' }}>
            {description}
          </div>
        </div>

        {/* v2.0.7w:估值 / 情绪 标签 — 字号 +3 (11→14) + 加粗 */}
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

    </div>
  );
}
