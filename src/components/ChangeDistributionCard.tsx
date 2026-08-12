// 涨跌分布柱状图 — v2.0.7aa
// 11 档(跌 5 档 / 平 1 档 / 涨 5 档),色:跌绿 / 平灰 / 涨红

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
  key: keyof NonNullable<ReportData['marketOverview']['changeDistribution']>;
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
  const limitUp = data.marketOverview.limitUpCount ?? 0;
  const limitDown = data.marketOverview.limitDownCount ?? 0;

  const option = useMemo(() => {
    if (!dist) return {};
    const labels = BUCKETS.map((b) => b.label);
    const values = BUCKETS.map((b) => dist[b.key] ?? 0);
    const colors = BUCKETS.map((b) => barColor(b.type));

    return {
      grid: { top: 30, right: 12, left: 12, bottom: 28 },
      tooltip: {
        trigger: 'axis' as const,
        axisPointer: { type: 'shadow' as const },
        formatter: (params: any) => {
          const i = params[0].dataIndex;
          return `${BUCKETS[i].label}<br/>家数: <b>${values[i]}</b>`;
        },
      },
      xAxis: {
        type: 'category' as const,
        data: labels,
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { color: '#6b7280', fontSize: 10 },
      },
      yAxis: { type: 'value' as const, show: false },
      series: [
        {
          type: 'bar' as const,
          data: values.map((v, i) => ({ value: v, itemStyle: { color: colors[i], borderRadius: [2, 2, 0, 0] } })),
          barWidth: 22,
          label: {
            show: true,
            position: 'top' as const,
            color: colors[0],
            fontSize: 11,
            fontWeight: 600,
            formatter: (p: any) => p.value > 0 ? p.value : '',
          },
        },
      ],
    };
  }, [dist]);

  if (!dist) {
    return <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af' }}>暂无数据</div>;
  }

  return (
    <div>
      <ReactECharts option={option} style={{ height: 140, width: '100%' }} notMerge={true} lazyUpdate={true} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 4px 0', fontSize: 12, color: '#4b5563' }}>
        <span><span style={{ color: '#9ca3af' }}>涨跌</span> <strong style={{ color: GREEN }}>跌 {downCount}</strong> 家 · <strong style={{ color: RED }}>涨 {upCount}</strong> 家</span>
        <span style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
          <span><span style={{ color: '#9ca3af' }}>跌停</span> <strong style={{ color: GREEN }}>{limitDown}</strong></span>
          <span><span style={{ color: '#9ca3af' }}>涨停</span> <strong style={{ color: RED }}>{limitUp}</strong></span>
        </span>
      </div>
    </div>
  );
}
