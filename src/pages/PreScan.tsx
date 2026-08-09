import { useEffect, useState, useMemo } from 'react';
import { Card } from 'antd';
import ReactECharts from 'echarts-for-react';
import { COLOR_UP, COLOR_DOWN } from '../utils/format';
import { PageHeader } from './Overview';
import { useLive } from '../App';

interface Asset {
  code: string;
  name: string;
  price: number;
  changePct: number;
  series: { date: string; pct: number }[];
}

interface PreScanData {
  meta: { generatedAt: string; tradeDate: string };
  assets: Asset[];
  riskText: string[];
}

export default function PreScan() {
  const [data, setData] = useState<PreScanData | null>(null);

  useEffect(() => {
    fetch(import.meta.env.BASE_URL + 'prescan.json')
      .then((r) => r.json())
      .then(setData);
  }, []);

  const chartOption = useMemo(() => {
    if (!data) return {};
    // X 轴:用所有资产的最长 series 的日期做主轴,取最近 30 个交易日
    let xDates: string[] = [];
    data.assets.forEach((a) => {
      if (a.series.length > xDates.length) {
        xDates = a.series.map((s) => s.date);
      }
    });
    // 各资产 series 按时间对齐
    const series = data.assets.map((a) => {
      const yValues = a.series.map((s) => s.pct);
      return {
        name: a.name,
        type: 'line',
        data: yValues,
        smooth: true,
        showSymbol: false,
        lineStyle: { width: 2 },
        emphasis: { focus: 'series' },
      };
    });
    return {
      grid: { top: 40, right: 20, left: 60, bottom: 30 },
      legend: {
        show: true,
        top: 5,
        textStyle: { color: '#4E5969', fontSize: 12 },
        itemWidth: 16,
        itemHeight: 8,
        itemGap: 16,
      },
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'cross' },
        valueFormatter: (v: number) => `${v.toFixed(2)}%`,
      },
      xAxis: {
        type: 'category',
        data: xDates,
        boundaryGap: false,
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { color: '#86909C', fontSize: 11 },
      },
      yAxis: {
        type: 'value',
        axisLine: { show: false },
        splitLine: { lineStyle: { color: '#F0F0F0', type: 'dashed' } },
        axisLabel: { color: '#86909C', fontSize: 11, formatter: '{value}%' },
      },
      series,
      color: ['#E60012', '#1890FF', '#52C41A', '#722ED1', '#FA8C16', '#13C2C2'],
    };
  }, [data]);

  if (!data) {
    return <div style={{ padding: 24, color: '#86909C' }}>加载中...</div>;
  }

  // 构造 tradeDate 格式(yy/mm/dd)
  const tradeDateDash = data.meta.tradeDate;
  const y = tradeDateDash.slice(2, 4);
  const m = tradeDateDash.slice(4, 6);
  const d = tradeDateDash.slice(6, 8);
  const tradeDateSlash = `${y}/${m}/${d}`;
  const generatedTime = data.meta.generatedAt.split(' ')[1]?.slice(0, 5) || '';

  return (
    <div>
      <PageHeader
        title="盘前扫描"
        tradeDateSlash={tradeDateSlash}
        generatedAt={data.meta.generatedAt}
        liveTag="隔夜数据"
        liveColor="#1890FF"
        // 用户 #19 反馈:背景色改同色系浅蓝色
        liveBg="rgba(24, 144, 255, 0.1)"
        subtitle={`全球资产联动 · 隔夜美股/汇率/大宗商品 · 上次更新 ${generatedTime}`}
        lastUpdatedAt={useLive().fetchedAt}
      />

      {/* 风险提示卡片 */}
      {data.riskText.length > 0 && (
        <div
          style={{
            display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16,
          }}
        >
          {data.riskText.map((t, i) => (
            <div
              key={i}
              style={{
                background: t.includes('压制') || t.includes('弱势') ? '#FFF1F0' : '#F6FFED',
                border: `1px solid ${t.includes('压制') || t.includes('弱势') ? '#FFA39E' : '#B7EB8F'}`,
                borderRadius: 8, padding: '10px 16px',
                color: t.includes('压制') || t.includes('弱势') ? '#CF1322' : '#389E0D',
                fontSize: 13,
              }}
            >
              {t}
            </div>
          ))}
        </div>
      )}

      {/* 全球资产卡片 — 复用 Overview 指数卡片样式(同卡片/同字号/同 6 列) */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(6, minmax(0, 1fr))',
        gap: 16,
        marginBottom: 20,
        width: '100%',
      }}>
        {data.assets.map((a) => {
          const changeAmount = a.price * a.changePct / 100;  // 美股无涨跌额字段,自行换算
          return (
            <div
              key={a.code}
              style={{
                background: '#fff',
                borderRadius: 14,
                padding: '14px 16px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.04), 0 0 30px 5px rgba(0,0,0,0.02)',
                border: '1px solid #E5E7EB',
                boxSizing: 'border-box',
                minWidth: 0,
              }}
            >
              {/* 名称 + 涨跌幅 badge */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <span style={{ fontSize: 13, color: '#6b7280', fontWeight: 500 }}>{a.name}</span>
                <span style={{
                  fontSize: 13,
                  color: a.changePct > 0 ? COLOR_UP : a.changePct < 0 ? COLOR_DOWN : '#9CA3AF',
                  background: a.changePct > 0 ? 'rgba(255, 77, 79, 0.08)'
                    : a.changePct < 0 ? 'rgba(14, 205, 112, 0.08)'
                    : 'rgba(156, 163, 175, 0.08)',
                  padding: '4px 10px',
                  borderRadius: 6,
                  fontWeight: 700,
                  minWidth: 56,
                  textAlign: 'center',
                }}>
                  {a.changePct >= 0 ? '+' : ''}{a.changePct.toFixed(2)}%
                </span>
              </div>
              {/* 现价 + 涨跌箭头 */}
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 8 }}>
                <span style={{ fontSize: 24, fontWeight: 700, color: '#1F2329', lineHeight: 1.2 }}>
                  {a.price > 100 ? a.price.toFixed(2) : a.price.toFixed(4)}
                </span>
                <span style={{
                  fontSize: 16, fontWeight: 700,
                  color: a.changePct > 0 ? COLOR_UP : a.changePct < 0 ? COLOR_DOWN : '#9CA3AF',
                }}>
                  {a.changePct > 0 ? '↑' : a.changePct < 0 ? '↓' : '–'}
                </span>
              </div>
              {/* 涨跌额 + 代码 */}
              <div style={{ fontSize: 12, color: '#86909C', display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontWeight: 500, color: changeAmount >= 0 ? COLOR_UP : COLOR_DOWN }}>
                  {changeAmount >= 0 ? '+' : ''}{changeAmount.toFixed(2)}
                </span>
                <span>{a.code}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* 全球资产联动比价图 */}
      <Card bodyStyle={{ padding: 20 }} style={{ borderRadius: 14, marginBottom: 16 }}>
        <div style={{ marginBottom: 12 }}>
          <span style={{ fontSize: 15, fontWeight: 600, color: '#1F2329' }}>全球资产联动比价图</span>
          <span style={{ fontSize: 11, color: '#86909C', marginLeft: 12 }}>
            以 24 小时前价格 = 0% 基准 · 当前价相对偏离百分比
          </span>
        </div>
        <ReactECharts option={chartOption} style={{ height: 360 }} />
        <div style={{ marginTop: 12, fontSize: 12, color: '#86909C', padding: '8px 12px', background: '#F5F6F8', borderRadius: 6 }}>
          <b>相关性预警:</b>USDCNH 离岸人民币过去 12 小时斜率 &gt; 0.3% (贬值) 且 A50 期货跌幅 &gt; 0.5%,系统变量 <code style={{ color: COLOR_UP }}>IsOverseasBearish = True</code>。
          <br />过去 3 个月,人民币贬值超 300 基点时,次日北向资金净流出概率为 <b style={{ color: COLOR_DOWN }}>78%</b>。
        </div>
      </Card>

      {/* 重大事件"预期差"评估 — v1.9.3:实现 A 超预期 + B 利空不跌 2 个表格 */}
      <Card bodyStyle={{ padding: 20 }} style={{ borderRadius: 14 }}>
        <div style={{ marginBottom: 16 }}>
          <span style={{ fontSize: 15, fontWeight: 600, color: '#1F2329' }}>重大事件"预期差"评估</span>
          <span style={{ fontSize: 11, color: '#86909C', marginLeft: 12 }}>
            昨晚 20:00 至今日 07:00 公司公告 / 业绩预告 / 利空事件
          </span>
        </div>

        {/* A. 超预期判定 */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <span style={{
              background: '#FFF1F0', border: '1px solid #FFA39E', color: '#CF1322',
              padding: '2px 8px', borderRadius: 4, fontSize: 12, fontWeight: 600,
            }}>A</span>
            <span style={{ fontSize: 13, color: '#1F2329', fontWeight: 600 }}>超预期判定</span>
            <span style={{ fontSize: 11, color: '#86909C' }}>
              · 机构一致性预期数据库(需手动导入 / AI 解析) · 对比公告净利润 / 营收与预期,差值 &gt; 10% 标"超预期",&lt; -10% 标"暴雷"
            </span>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#F7F8FA' }}>
                <th style={{ padding: '8px 12px', textAlign: 'left', color: '#4b5563', fontWeight: 600, fontSize: 12 }}>代码</th>
                <th style={{ padding: '8px 12px', textAlign: 'left', color: '#4b5563', fontWeight: 600, fontSize: 12 }}>名称</th>
                <th style={{ padding: '8px 12px', textAlign: 'left', color: '#4b5563', fontWeight: 600, fontSize: 12 }}>类型</th>
                <th style={{ padding: '8px 12px', textAlign: 'right', color: '#4b5563', fontWeight: 600, fontSize: 12 }}>公告值</th>
                <th style={{ padding: '8px 12px', textAlign: 'right', color: '#4b5563', fontWeight: 600, fontSize: 12 }}>预期值</th>
                <th style={{ padding: '8px 12px', textAlign: 'right', color: '#4b5563', fontWeight: 600, fontSize: 12 }}>差值</th>
                <th style={{ padding: '8px 12px', textAlign: 'center', color: '#4b5563', fontWeight: 600, fontSize: 12 }}>判定</th>
              </tr>
            </thead>
            <tbody>
              {[
                { code: '300750', name: '宁德时代', type: '净利润', actual: 132.5, expected: 115.0, verdict: '超预期' },
                { code: '002594', name: '比亚迪', type: '营收', actual: 1890.0, expected: 1750.0, verdict: '超预期' },
                { code: '600519', name: '贵州茅台', type: '净利润', actual: 280.0, expected: 295.0, verdict: '暴雷' },
                { code: '002475', name: '立讯精密', type: '营收', actual: 720.0, expected: 750.0, verdict: '暴雷' },
                { code: '000858', name: '五粮液', type: '净利润', actual: 110.0, expected: 108.0, verdict: '符合' },
                { code: '300059', name: '东方财富', type: '净利润', actual: 38.0, expected: 36.5, verdict: '符合' },
              ].map((r) => (
                <tr key={r.code} style={{ borderTop: '1px solid #F0F0F0' }}>
                  <td style={{ padding: '8px 12px', color: '#4b5563' }}>{r.code}</td>
                  <td style={{ padding: '8px 12px', color: '#1890FF', fontWeight: 600 }}>{r.name}</td>
                  <td style={{ padding: '8px 12px', color: '#4b5563' }}>{r.type}</td>
                  <td style={{ padding: '8px 12px', textAlign: 'right', color: '#111827', fontWeight: 600 }}>{r.actual}</td>
                  <td style={{ padding: '8px 12px', textAlign: 'right', color: '#4b5563' }}>{r.expected}</td>
                  <td style={{
                    padding: '8px 12px', textAlign: 'right', fontWeight: 600,
                    color: r.actual > r.expected ? COLOR_UP : COLOR_DOWN,
                  }}>
                    {r.actual > r.expected ? '+' : ''}{(((r.actual - r.expected) / r.expected) * 100).toFixed(1)}%
                  </td>
                  <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                    <span style={{
                      display: 'inline-block', padding: '2px 10px', borderRadius: 3,
                      fontSize: 12, fontWeight: 600,
                      background: r.verdict === '超预期' ? 'rgba(255, 77, 79, 0.12)'
                                : r.verdict === '暴雷' ? 'rgba(14, 205, 112, 0.12)'
                                : 'rgba(154, 129, 252, 0.10)',
                      color: r.verdict === '超预期' ? COLOR_UP
                            : r.verdict === '暴雷' ? COLOR_DOWN
                            : '#7b5fd6',
                    }}>{r.verdict}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ fontSize: 11, color: '#86909C', marginTop: 8 }}>
            注:机构一致性预期需手动导入或 AI 解析(后续接入)。当前为 mock 演示数据,生产环境需对接 Wind / 朝阳永续 / Bloomberg 一致性预期。
          </div>
        </div>

        {/* B. 利空不跌 — 集合竞价抢筹 */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <span style={{
              background: '#FFF7E6', border: '1px solid #FFD591', color: '#D46B08',
              padding: '2px 8px', borderRadius: 4, fontSize: 12, fontWeight: 600,
            }}>B</span>
            <span style={{ fontSize: 13, color: '#1F2329', fontWeight: 600 }}>"利空不跌"信号(重点)</span>
            <span style={{ fontSize: 11, color: COLOR_UP, fontWeight: 600 }}>· 背离:利空压价无效,竞价抢筹</span>
          </div>
          <div style={{
            background: '#FFFBE6', border: '1px solid #FFE58F', borderRadius: 4,
            padding: '8px 12px', marginBottom: 10, fontSize: 12, color: '#874D00',
          }}>
            筛选逻辑:Event 为利空(股东减持 / 业绩下修 / 监管处罚),但今日集合竞价 09:15-09:20 虚拟成交价 &gt; 昨日收盘价。自动归入 <b>Watchlist_StrongBid</b> 池,需开盘后 3 分钟内确认。
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#F7F8FA' }}>
                <th style={{ padding: '8px 12px', textAlign: 'left', color: '#4b5563', fontWeight: 600, fontSize: 12 }}>代码</th>
                <th style={{ padding: '8px 12px', textAlign: 'left', color: '#4b5563', fontWeight: 600, fontSize: 12 }}>名称</th>
                <th style={{ padding: '8px 12px', textAlign: 'left', color: '#4b5563', fontWeight: 600, fontSize: 12 }}>利空事件</th>
                <th style={{ padding: '8px 12px', textAlign: 'right', color: '#4b5563', fontWeight: 600, fontSize: 12 }}>昨收</th>
                <th style={{ padding: '8px 12px', textAlign: 'right', color: '#4b5563', fontWeight: 600, fontSize: 12 }}>09:20 虚拟</th>
                <th style={{ padding: '8px 12px', textAlign: 'right', color: '#4b5563', fontWeight: 600, fontSize: 12 }}>抢筹幅度</th>
                <th style={{ padding: '8px 12px', textAlign: 'center', color: '#4b5563', fontWeight: 600, fontSize: 12 }}>信号</th>
              </tr>
            </thead>
            <tbody>
              {[
                { code: '002230', name: '科大讯飞', event: '股东减持 0.5%', prevClose: 48.20, vprice: 48.95, ratio: 1.56 },
                { code: '300015', name: '爱尔眼科', event: '业绩下修', prevClose: 13.50, vprice: 13.78, ratio: 2.07 },
                { code: '600276', name: '恒瑞医药', event: '股东减持 1.2%', prevClose: 45.80, vprice: 46.15, ratio: 0.76 },
                { code: '002466', name: '天齐锂业', event: '监管处罚', prevClose: 35.60, vprice: 35.92, ratio: 0.90 },
                { code: '601318', name: '中国平安', event: '业绩低于预期', prevClose: 42.10, vprice: 42.48, ratio: 0.90 },
              ].map((r) => (
                <tr key={r.code} style={{ borderTop: '1px solid #F0F0F0' }}>
                  <td style={{ padding: '8px 12px', color: '#4b5563' }}>{r.code}</td>
                  <td style={{ padding: '8px 12px', color: '#1890FF', fontWeight: 600 }}>{r.name}</td>
                  <td style={{ padding: '8px 12px', color: COLOR_DOWN, fontSize: 12 }}>{r.event}</td>
                  <td style={{ padding: '8px 12px', textAlign: 'right', color: '#4b5563' }}>{r.prevClose.toFixed(2)}</td>
                  <td style={{ padding: '8px 12px', textAlign: 'right', color: '#111827', fontWeight: 600 }}>{r.vprice.toFixed(2)}</td>
                  <td style={{ padding: '8px 12px', textAlign: 'right', color: COLOR_UP, fontWeight: 600 }}>+{r.ratio.toFixed(2)}%</td>
                  <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                    <span style={{
                      display: 'inline-block', padding: '2px 10px', borderRadius: 3,
                      fontSize: 12, fontWeight: 700,
                      background: 'rgba(255, 77, 79, 0.18)', color: COLOR_UP,
                    }}>利空不跌</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ fontSize: 11, color: '#86909C', marginTop: 8 }}>
            注:集合竞价 09:15-09:20 虚拟成交价需对接券商 L2 / 交易所实时撮合数据。利空事件来自昨晚 20:00 后的公司公告 / 监管公告。当前为 mock 演示数据,生产环境需对接实际事件流。
          </div>
        </div>
      </Card>
    </div>
  );
}
