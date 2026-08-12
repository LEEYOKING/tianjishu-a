// 涨跌分布柱状图 — v2.0.7ae
// 11 档分桶:跌 5 / 平 1 / 涨 5,色:跌绿 / 平灰 / 涨红
// v2.0.7ae:左右外边距 35/底部左右 45/柱子 1.4x(=36)/横线 10px+圆角最大+3 色间 2px 间距/底部整体底部对齐卡片

import ReactECharts from 'echarts-for-react';
import { useMemo } from 'react';
import type { ReportData } from '../data/loader';

interface Props {
  data: ReportData;
}

const RED = '#ff4d4f';
const GREEN = '#0ecd70';
const GRAY = '#9ca3af';

const BUCKETS: Array<{
  key: keyof NonNullable<NonNullable<ReportData['marketOverview']>['changeDistribution']>;
  label: string;
  type: 'down' | 'flat' | 'up';
}> = [
  { key: 'down_ge_10',   label: '>10%',  type: 'down' },
  { key: 'down_10_to_7', label: '10~7',  type: 'down' },
  { key: 'down_7_to_5',  label: '7~5',   type: 'down' },
  { key: 'down_5_to_3',  label: '5~3',   type: 'down' },
  { key: 'down_3_to_0',  label: '3~0',   type: 'down' },
  { key: 'flat',         label: '0',     type: 'flat' },
  { key: 'up_0_to_3',    label: '0~3',   type: 'up' },
  { key: 'up_3_to_5',    label: '3~5',   type: 'up' },
  { key: 'up_5_to_7',    label: '5~7',   type: 'up' },
  { key: 'up_7_to_10',   label: '7~10',  type: 'up' },
  { key: 'up_ge_10',     label: '>10%',  type: 'up' },
];

function barColor(type: 'down' | 'flat' | 'up'): string {
  if (type === 'down') return GREEN;
  if (type === 'flat') return GRAY;
  return RED;
}

export function ChangeDistributionCard({ data }: Props) {
  const dist = data.marketOverview.changeDistribution;
  const upCount = data.marketOverview.upCount ?? 0;
  const downCount = data.marketOverview.downCount ?? 0;
  const flatCount = data.marketOverview.flatCount ?? 0;
  const limitUp = data.marketOverview.limitUpCount ?? 0;
  const limitDown = data.marketOverview.limitDownCount ?? 0;
  const total = upCount + downCount + flatCount;

  const downPct = total > 0 ? downCount / total : 0;
  const flatPct = total > 0 ? flatCount / total : 0;
  const upPct = total > 0 ? upCount / total : 0;

  const option = useMemo(() => {
    if (!dist) return {};
    const labels = BUCKETS.map((b) => b.label);
    const values = BUCKETS.map((b) => dist[b.key] ?? 0);
    const colors = BUCKETS.map((b) => barColor(b.type));

    return {
      animation: false,
      // v2.0.7ae:左右外边距 35
      grid: { top: 22, right: 35, left: 35, bottom: 20 },
      tooltip: { show: false },
      xAxis: {
        type: 'category' as const,
        data: labels,
        axisLine: { show: true, lineStyle: { color: '#E5E7EB', width: 1 } },
        axisTick: { show: false },
        axisLabel: { color: '#6b7280', fontSize: 12, fontWeight: 600 },
      },
      yAxis: { type: 'value' as const, show: false },
      series: [
        {
          type: 'bar' as const,
          data: values.map((v, i) => ({
            value: v,
            itemStyle: {
              color: colors[i],
              // v2.0.7af:柱子上方圆角参数 2 倍(2→4)
              borderRadius: [4, 4, 0, 0],
              opacity: v === 0 ? 0.6 : 1,
            },
            label: { color: colors[i] },
          })),
          // v2.0.7ae:柱子 1.4x(原 26 → 36)
          barWidth: 36,
          label: {
            show: true,
            position: 'top' as const,
            fontSize: 11,
            fontWeight: 700,
            formatter: (p: any) => p.value >= 0 ? p.value : '',
          },
        },
      ],
    };
  }, [dist]);

  if (!dist) {
    return <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af' }}>暂无数据</div>;
  }

  return (
    // v2.0.7af:卡片 padding-bottom 25px — 让底部横线区距离卡片底 25px
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', paddingBottom: 25 }}>
      {/* 柱状图 — 固定高度 260px */}
      <div style={{ height: 260 }}>
        <ReactECharts
          option={option}
          style={{ height: '100%', width: '100%' }}
          notMerge={true}
          lazyUpdate={true}
        />
      </div>

      {/* 撑开 spacer — 让底部整体靠下 */}
      <div style={{ flex: 1 }} />

      {/* 底部 1:涨跌家数 + 涨停跌停 — v2.0.7ae:左右 45 + 全部居左 */}
      <div style={{ display: 'flex', gap: 16, padding: '0 45px 4px', fontSize: 13, color: '#4b5563' }}>
        <span>
          <span style={{ color: '#111827', fontWeight: 600 }}>涨跌</span>{' '}
          <span style={{ color: GREEN }}>跌{downCount}家</span>
          <span style={{ color: '#d1d5db' }}> · </span>
          <span style={{ color: RED }}>涨{upCount}家</span>
        </span>
        <span>
          <span style={{ color: GREEN }}>跌停{limitDown}家</span>
          <span style={{ color: '#d1d5db' }}>·</span>
          <span style={{ color: RED }}>涨停{limitUp}家</span>
        </span>
      </div>

      {/* v2.0.7af:底部 2:涨跌家数比例横条 — 左右 45 + 高 10px + 直角 + 3 色间 2px 间距 */}
      <div style={{ display: 'flex', height: 10, margin: '4px 45px 0', background: '#F3F4F6', gap: 2 }}>
        {downPct > 0 && (
          <div
            style={{
              width: `${downPct * 100}%`, background: GREEN,
              // 左侧 2 角圆角(0°位置),右侧 2 角直角(贴近平/涨部分)
              borderTopLeftRadius: 999, borderBottomLeftRadius: 999,
              borderTopRightRadius: 0, borderBottomRightRadius: 0,
            }}
            title={`跌 ${(downPct * 100).toFixed(1)}%`}
          />
        )}
        {flatPct > 0 && (
          <div style={{ width: `${flatPct * 100}%`, background: GRAY, borderRadius: 0 }} title={`平 ${(flatPct * 100).toFixed(1)}%`} />
        )}
        {upPct > 0 && (
          <div
            style={{
              width: `${upPct * 100}%`, background: RED,
              // 左侧 2 角直角(贴近平/跌部分),右侧 2 角圆角(100°位置)
              borderTopLeftRadius: 0, borderBottomLeftRadius: 0,
              borderTopRightRadius: 999, borderBottomRightRadius: 999,
            }}
            title={`涨 ${(upPct * 100).toFixed(1)}%`}
          />
        )}
      </div>
    </div>
  );
}
