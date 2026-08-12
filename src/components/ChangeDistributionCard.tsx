// 涨跌分布柱状图 — v2.0.7ab
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
      grid: { top: 22, right: 6, left: 6, bottom: 22 },
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
        axisLine: { show: true, lineStyle: { color: '#E5E7EB', width: 1 } },  // 底部灰色实线
        axisTick: { show: false },
        axisLabel: { color: '#6b7280', fontSize: 12, fontWeight: 600 },  // v2.0.7ab:加大 1 号 + 加粗
      },
      yAxis: { type: 'value' as const, show: false },
      series: [
        {
          type: 'bar' as const,
          data: values.map((v, i) => ({
            value: v,
            itemStyle: {
              color: colors[i],
              borderRadius: [2, 2, 0, 0],
              // v2.0.7ab:0 数值仍显示(不透明)
              opacity: v === 0 ? 0.6 : 1,
            },
          })),
          barWidth: 22,
          label: {
            show: true,
            position: 'top' as const,
            // v2.0.7ab:数字用对应颜色(红涨/平灰/跌绿)
            color: (params: any) => {
              const i = params.dataIndex;
              return colors[i];
            },
            fontSize: 11,
            fontWeight: 600,
            // v2.0.7ab:0 也显示
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
      {/* 柱状图 — 撑满高度(响应卡片高度) */}
      <div style={{ flex: 1, minHeight: 0 }}>
        <ReactECharts option={option} style={{ height: '100%', minHeight: 120, width: '100%' }} notMerge={true} lazyUpdate={true} />
      </div>

      {/* 底部 1:涨跌家数 + 涨停跌停 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 2px 4px', fontSize: 13, color: '#4b5563' }}>
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

      {/* 底部 2:涨跌家数比例横条(参考 user 附件 2 红框) */}
      <div style={{ display: 'flex', height: 6, borderRadius: 3, overflow: 'hidden', background: '#F3F4F6' }}>
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
