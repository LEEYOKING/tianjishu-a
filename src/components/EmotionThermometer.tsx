// 情绪温度计组件 — v2.0.7ac
// v2.0.7z:5 维度直接相加算法
// v2.0.7ac:删"极度沸点"文字/半圆弧缩到 80%/0°100° 位置/标题固定"市场情绪温度计"/取消 hover/20s 实时刷新

export interface EmotionThermometerProps {
  temperature: number;  // 0-100
  status?: string;
  statusDesc?: string;
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
  if (t <= 20) return '#3b82f6';
  if (t <= 40) return '#06b6d4';
  if (t <= 60) return '#f59e0b';
  if (t <= 80) return '#f97316';
  return '#dc2626';
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
  details,
  limitUpCount,
  upCount,
  downCount,
}: EmotionThermometerProps) {
  // v2.0.7ac:实时刷新 — 不存 hover state 了
  const safeT = Math.max(0, Math.min(100, temperature));
  const color = getColor(safeT);

  const lu = limitUpCount ?? details.limit_up;
  const ld = details.limit_down;
  const valuation = getValuationTag(lu, upCount ?? 0, downCount ?? 0);
  const sentiment = getSentimentTag(lu, ld);

  // v2.0.7ac:半圆弧半径 80%(原 r=70 → r=56)
  const cx = 100;
  const cy = 100;
  const r = 56;  // 80% of 70
  const angle = 180 - (safeT / 100) * 180;
  const angleRad = (angle * Math.PI) / 180;
  const endX = cx + r * Math.cos(angleRad);
  const endY = cy - r * Math.sin(angleRad);
  const needleLength = 44;  // 80% of 56
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
      }}
    >
      {/* v2.0.7ac:固定标题"市场情绪温度计" */}
      <div style={{ textAlign: 'center', fontSize: 12, color: '#6b7280', marginBottom: 2 }}>
        市场情绪温度计
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        {/* 半圆弧 SVG — 缩到 80%,0°/100° 位置修正 */}
        <svg width="100%" height="80" viewBox="0 0 200 100" style={{ display: 'block' }}>
          <path
            // v2.0.7ac:从 (cx-r) 到 (cx+r) 半圆弧 — 0°/100° 位置正确
            d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
            fill="none"
            stroke="#F3F4F6"
            strokeWidth="11"
            strokeLinecap="round"
          />
          {safeT > 0 && (
            <path
              d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${endX} ${endY}`}
              fill="none"
              stroke={color}
              strokeWidth="11"
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
            strokeWidth="2"
            strokeLinecap="round"
            style={{ transition: 'all 0.6s cubic-bezier(0.4, 0, 0.2, 1)' }}
          />
          <circle cx={cx} cy={cy} r="4" fill="#111827" />
          {/* v2.0.7ac:0° 在弧左端(cx-r),100° 在弧右端(cx+r) — 视觉对齐弧的起止点 */}
          <text x={cx - r} y={cy + 14} textAnchor="middle" fontSize="10" fill="#6b7280" fontWeight={600}>0°</text>
          <text x={cx + r} y={cy + 14} textAnchor="middle" fontSize="10" fill="#6b7280" fontWeight={600}>100°</text>
        </svg>

        {/* 温度数字(大) — v2.0.7ac:删"极度沸点"等状态名,只显示数字 */}
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 2, marginTop: 4 }}>
          <span style={{ fontSize: 26, fontWeight: 800, color, lineHeight: 1, fontFamily: 'system-ui, -apple-system, sans-serif', fontVariantNumeric: 'tabular-nums' }}>
            {safeT}
          </span>
          <span style={{ fontSize: 13, color, fontWeight: 600 }}>°</span>
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
    </div>
  );
}
