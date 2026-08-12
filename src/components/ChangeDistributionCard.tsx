// 涨跌分布柱状图 — v2.0.7ac
// 11 档分桶:跌 5 / 平 1 / 涨 5,色:跌绿 / 平灰 / 涨红
// 实时刷新(从 data.live 通过 useLive merge 进来 — 10s 节奏)

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

  // 涨跌家数比例
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
      // v2.0.7ac:左右间距 1.5x(原 6 → 9),底部加大
      grid: { top: 22, right: 9, left: 9, bottom: 20 },
      tooltip: { show: false },  // v2.0.7ac:取消 hover(tooltip + axisPointer)
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
              // v2.0.7ac:整柱+数字统一色(跌绿/平灰/涨红)
              color: colors[i],
              borderRadius: [2, 2, 0, 0],
              opacity: v === 0 ? 0.6 : 1,
            },
          })),
          // v2.0.7ac:柱子宽 1.2x(原 22 → 26)
          barWidth: 26,
          label: {
            show: true,
            position: 'top' as const,
            // v2.0.7ac:数字用对应颜色(跟柱子同色)
            color: (params: any) => {
              const i = params.dataIndex;
              return colors[i];
            },
            fontSize: 11,
            fontWeight: 700,
            // v2.0.7ac:0 也显示
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
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* 柱状图 — 撑满高度(高度 2x) */}
      <div style={{ flex: 1, minHeight: 0, height: 240 }}>
        <ReactECharts
          option={option}
          style={{ height: '100%', width: '100%' }}
          notMerge={true}
          lazyUpdate={true}
        />
      </div>

      {/* 底部 1:涨跌家数 + 涨停跌停 — 宽度与柱状图统一(左右各 9px) */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 9px 4px', fontSize: 13, color: '#4b5563' }}>
        <span>
          <span style={{ color: '#111827', fontWeight: 600 }}>涨跌</span>{' '}
          <span style={{ color: GREEN }}>跌{downCount}家</span>
          <span style={{ color: '#d1d5db' }}> · </span>
          <span style={{ color: RED }}>涨{upCount}家</span>
        </span>
        <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ color: GREEN }}>跌停{limitDown}家</span>
          <span style={{ color: '#d1d5db' }}>·</span>
          <span style={{ color: RED }}>涨停{limitUp}家</span>
        </span>
      </div>

      {/* 底部 2:涨跌家数比例横条 — 同样左右 9px */}
      <div style={{ display: 'flex', height: 6, margin: '4px 9px 0', borderRadius: 3, overflow: 'hidden', background: '#F3F4F6' }}>
        {downPct > 0 && (
          <div style={{ width: `${downPct * 100}%`, background: GREEN }} title={`跌 ${(downPct * 100).toFixed(1)}%`} />
        )}
        {flatPct > 0 && (
          <div style={{ width: `${flatPct * 100}%`, background: GRAY }} title={`平 ${(flatPct * 100).toFixed(1)}%`} />
        )}
        {upPct > 0 && (
          <div style={{ width: `${upPct * 100}%`, background: RED }} title={`涨 ${(upPct * 100).toFixed(1)}%`} />
        )}
      </div>
    </div>
  );
}
