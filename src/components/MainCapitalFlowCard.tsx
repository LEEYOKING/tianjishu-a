// 主力资金流卡片(20 日) — v2.0.7aa
// 顶部 4 数字(20/10/5/3 日净流入) + 柱状图 + hover 高亮(用 markPoint + showCrossHair)

import ReactECharts from 'echarts-for-react';
import { useMemo, useState } from 'react';
import type { ReportData } from '../data/loader';

interface Props {
  data: ReportData;
}

const RED = '#ff4d4f';
const GREEN = '#0ecd70';

export function MainCapitalFlowCard({ data }: Props) {
  const list = data.marketOverview.mainCapitalFlow20d;
  const [hoverInfo, setHoverInfo] = useState<{
    date: string; net: number; in_: number; out: number;
  } | null>(null);

  const sumN = (n: number) => {
    if (!list || list.length === 0) return 0;
    return list.slice(-n).reduce((s: number, x: any) => s + (x.main_net_inflow || 0), 0);
  };

  const renderTopStat = (label: string, n: number) => {
    const v = sumN(n);
    const color = v > 0 ? RED : v < 0 ? GREEN : '#6b7280';
    const sign = v > 0 ? '+' : '';
    return (
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ color: '#9ca3af', fontSize: 11, marginBottom: 2 }}>{label}</div>
        <div style={{ color, fontSize: 14, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
          {sign}{v.toFixed(2)}亿元
        </div>
      </div>
    );
  };

  const option = useMemo(() => {
    if (!list || list.length === 0) return {};
    const dates = list.map((x) => x.date);
    const values = list.map((x) => x.main_net_inflow);
    const maxAbs = Math.max(...values.map((v) => Math.abs(v)), 1);

    return {
      animation: false,
      grid: { top: 8, right: 6, left: 32, bottom: 22 },
      tooltip: {
        trigger: 'axis' as const,
        axisPointer: { type: 'shadow' as const },
        backgroundColor: 'rgba(255,255,255,0.98)',
        borderColor: '#E5E7EB',
        textStyle: { color: '#111827', fontSize: 12 },
        formatter: (params: any) => {
          const i = params[0].dataIndex;
          return `<div style="font-weight:600;color:#111827">${dates[i]}</div>主力净流入: <b style="color:${values[i] > 0 ? RED : GREEN}">${values[i] > 0 ? '+' : ''}${values[i].toFixed(2)}亿元</b>`;
        },
      },
      xAxis: {
        type: 'category' as const,
        data: dates,
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: {
          color: '#9ca3af', fontSize: 10,
          formatter: (v: string) => v.slice(5), // MM-DD
        },
      },
      yAxis: {
        type: 'value' as const,
        min: -maxAbs, max: maxAbs,
        axisLine: { show: false },
        axisTick: { show: false },
        splitLine: { lineStyle: { color: '#F3F4F6', type: 'dashed' as const } },
        axisLabel: {
          color: '#9ca3af', fontSize: 10,
          formatter: (v: number) => v.toFixed(0),
        },
      },
      series: [
        {
          name: '主力净流入',
          type: 'bar' as const,
          data: values.map((v) => ({
            value: v,
            itemStyle: {
              color: v >= 0 ? RED : GREEN,
              borderRadius: v >= 0 ? [2, 2, 0, 0] : [0, 0, 2, 2],
            },
          })),
          barWidth: '60%',
          emphasis: { focus: 'self' as const },
        },
      ],
    };
  }, [list]);

  if (!list || list.length === 0) {
    return (
      <div>
        <div style={{ display: 'flex', gap: 16, padding: '14px 16px', background: '#F7F8FA', borderRadius: 8, marginBottom: 12, fontSize: 12 }}>
          {renderTopStat('20日净流入', 20)}
          {renderTopStat('10日净流入', 10)}
          {renderTopStat('5日净流入', 5)}
          {renderTopStat('3日净流入', 3)}
        </div>
        <div style={{ padding: '40px 16px', textAlign: 'center', color: '#9ca3af', fontSize: 12, lineHeight: 1.7 }}>
          ⚠️ 主力资金流(20 日)暂未接入<br />
          <span style={{ fontSize: 11, color: '#d1d5db' }}>数据源限制(sandbox 环境),生产 Actions 部署后会显示</span>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 16, padding: '12px 14px', background: '#F7F8FA', borderRadius: 8, marginBottom: 8, fontSize: 12 }}>
        {renderTopStat('20日净流入', 20)}
        {renderTopStat('10日净流入', 10)}
        {renderTopStat('5日净流入', 5)}
        {renderTopStat('3日净流入', 3)}
      </div>
      <ReactECharts
        option={option}
        style={{ height: 200, width: '100%' }}
        notMerge={true}
        lazyUpdate={true}
        onEvents={{
          mouseover: (e: any) => {
            if (e?.dataIndex != null) {
              const item = list[e.dataIndex];
              if (item) {
                setHoverInfo({
                  date: item.date,
                  net: item.main_net_inflow,
                  in_: item.huge_net_inflow ?? 0,
                  out: item.big_net_inflow ?? 0,
                });
              }
            }
          },
          mouseout: () => setHoverInfo(null),
        }}
      />
      {hoverInfo && (
        <div style={{ marginTop: 4, padding: '6px 10px', background: '#F7F8FA', borderRadius: 6, fontSize: 11, color: '#4b5563' }}>
          <strong style={{ color: '#111827' }}>{hoverInfo.date}</strong> · 主力净流入{' '}
          <strong style={{ color: hoverInfo.net > 0 ? RED : GREEN }}>
            {hoverInfo.net > 0 ? '+' : ''}{hoverInfo.net.toFixed(2)}亿元
          </strong>
        </div>
      )}
    </div>
  );
}
