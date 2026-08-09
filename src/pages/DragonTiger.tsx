import { useState, useMemo } from 'react';
import { Button, Space, Pagination } from 'antd';
import { LeftOutlined, ArrowLeftOutlined, ArrowRightOutlined } from '@ant-design/icons';
import { PageHeader } from './Overview';
import ColorText from '../components/ColorText';
import { COLOR_UP, COLOR_DOWN, formatPrice } from '../utils/format';
import { HEAD_STYLE, CELL_STYLE } from '../components/DetailTable';
import type { ReportData } from '../data/loader';
import { useLive } from '../App';

// 表格容器样式(用户 #18 / #6 反馈:全站圆角 14 + 新阴影)
const TABLE_STYLE = { background: '#fff', borderRadius: 14, boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04), 0 0 30px 5px rgba(0, 0, 0, 0.02)', border: '1px solid #E5E7EB', padding: 4 };

export default function DragonTiger({ data }: { data: ReportData }) {
  const idx = data.marketOverview;
  const sorted = useMemo(() => [...data.dragonTigerStocks].sort((a, b) => b.netBuy - a.netBuy), [data.dragonTigerStocks]);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [page, setPage] = useState(1);
  const pageSize = 25;

  if (selectedIdx !== null) {
    const stock = sorted[selectedIdx];
    return (
      <div>
        <PageHeader
          title="龙虎榜"
          tradeDateSlash={idx.tradeDateSlash}
          generatedAt={idx.generatedAt}
          liveTag="收盘复盘数据"
          subtitle="机构/游资买卖席位"
          lastUpdatedAt={useLive().fetchedAt}
        />
        <div style={{ ...TABLE_STYLE, padding: 24 }}>
          <div style={{ fontSize: 13, color: '#86909C', marginBottom: 16 }}>
            {idx.tradeDate} 龙虎榜,按净买额排序,共 {sorted.length} 只
          </div>
          <Space style={{ marginBottom: 16 }}>
            <Button type="primary" danger icon={<LeftOutlined />} onClick={() => setSelectedIdx(null)}>
              返回列表
            </Button>
            <Button icon={<ArrowLeftOutlined />} disabled={selectedIdx === 0} onClick={() => setSelectedIdx(Math.max(0, selectedIdx - 1))}>
              上一条
            </Button>
            <Button icon={<ArrowRightOutlined />} disabled={selectedIdx === sorted.length - 1} onClick={() => setSelectedIdx(Math.min(sorted.length - 1, selectedIdx + 1))}>
              下一条
            </Button>
          </Space>
          <div style={{ fontSize: 18, fontWeight: 600, color: COLOR_UP, marginBottom: 16 }}>
            {stock.name}({stock.code}) 净买 <span style={{ fontSize: 22 }}>{Math.abs(stock.netBuy).toFixed(2)}</span>亿
          </div>
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#111827', marginBottom: 8 }}>买方前五</div>
            <Table
              dataSource={stock.details.buys}
              columns={[
                { key: 'direction', label: '方向', width: 80, render: () => <span style={{ color: COLOR_UP, fontWeight: 500 }}>买入</span> },
                { key: 'seat', label: '席位', align: 'left' as const, render: (v: string) => v },
                { key: 'buyAmount', label: '买入额', align: 'right' as const, render: (v: number) => `${v.toFixed(2)}亿` },
                { key: 'sellAmount', label: '卖出额', align: 'right' as const, render: (v: number) => `${v.toFixed(2)}亿` },
                { key: 'netAmount', label: '净额', align: 'right' as const, render: (v: number) => <ColorText value={v} withSign style={{ fontWeight: 500 }}>{`${Math.abs(v).toFixed(2)}亿`}</ColorText> },
              ]}
            />
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#111827', marginBottom: 8 }}>卖方前五</div>
            <Table
              dataSource={stock.details.sells}
              columns={[
                { key: 'direction', label: '方向', width: 80, render: () => <span style={{ color: COLOR_DOWN, fontWeight: 500 }}>卖出</span> },
                { key: 'seat', label: '席位', align: 'left' as const, render: (v: string) => v },
                { key: 'buyAmount', label: '买入额', align: 'right' as const, render: (v: number) => `${v.toFixed(2)}亿` },
                { key: 'sellAmount', label: '卖出额', align: 'right' as const, render: (v: number) => `${v.toFixed(2)}亿` },
                { key: 'netAmount', label: '净额', align: 'right' as const, render: (v: number) => <ColorText value={v} withSign style={{ fontWeight: 500 }}>{`${Math.abs(v).toFixed(2)}亿`}</ColorText> },
              ]}
            />
          </div>
        </div>
      </div>
    );
  }

  const paged = sorted.slice((page - 1) * pageSize, page * pageSize);

  return (
    <div>
      <PageHeader
        title="龙虎榜"
        tradeDateSlash={idx.tradeDateSlash}
        generatedAt={idx.generatedAt}
        liveTag="收盘复盘数据"
        subtitle="机构/游资买卖席位"
        lastUpdatedAt={useLive().fetchedAt}
      />
      <div style={TABLE_STYLE}>
        <div style={{ overflowX: 'auto' }}>
          {/* 用户 #12 反馈:列宽均衡(8 列)— 上榜原因保持左对齐 */}
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1100, tableLayout: 'fixed' }}>
            <colgroup>
              <col style={{ width: '10%' }} />    {/* 代码 */}
              <col style={{ width: '10%' }} />    {/* 名称 */}
              <col style={{ width: '10%' }} />    {/* 收盘价 */}
              <col style={{ width: '10%' }} />    {/* 涨跌幅 */}
              <col style={{ width: '12%' }} />    {/* 净买额 */}
              <col style={{ width: '12%' }} />    {/* 买入额 */}
              <col style={{ width: '12%' }} />    {/* 卖出额 */}
              <col style={{ width: '24%' }} />    {/* 上榜原因(更宽)— 保持左对齐 */}
            </colgroup>
            <thead>
              <tr>
                <th style={HEAD_STYLE}>代码</th>
                <th style={HEAD_STYLE}>名称</th>
                {/* 用户 #9 反馈:收盘价/涨跌幅/净买额/买入额/卖出额 文本居中 */}
                <th style={HEAD_STYLE}>收盘价</th>
                <th style={HEAD_STYLE}>涨跌幅</th>
                <th style={HEAD_STYLE}>净买额</th>
                <th style={HEAD_STYLE}>买入额</th>
                <th style={HEAD_STYLE}>卖出额</th>
                {/* 用户 #9 反馈:上榜原因表头也左对齐 */}
                <th style={{ ...HEAD_STYLE, textAlign: 'left' }}>上榜原因</th>
              </tr>
            </thead>
            <tbody>
              {sorted.length === 0 && (
                <tr><td colSpan={8} style={{ padding: 40, textAlign: 'center', color: '#86909C', fontSize: 13 }}>今日无龙虎榜数据(非交易日 / 数据未发布)</td></tr>
              )}
              {sorted.length > 0 && paged.map((s, i) => {
                const idxReal = (page - 1) * pageSize + i;
                return (
                  <tr key={s.code} onClick={() => setSelectedIdx(idxReal)} style={{ cursor: 'pointer' }}>
                    <td style={CELL_STYLE}>{s.code}</td>
                    <td style={{ ...CELL_STYLE, color: '#1890FF' }}>{s.name}</td>
                    {/* 用户 #9 反馈:全部数值列文本居中 */}
                    <td style={CELL_STYLE}>{formatPrice(s.closePrice)}</td>
                    <td style={CELL_STYLE}>
                      <ColorText value={s.changePercent} mode="percent" withSign />
                    </td>
                    {/* 用户 #2 反馈:净买额 红字/灰字前加 +、绿字前加 - */}
                    <td style={CELL_STYLE}>
                      <ColorText value={s.netBuy} style={{ fontWeight: 600 }}>
                        {`${s.netBuy >= 0 ? '+' : '-'}${Math.abs(s.netBuy).toFixed(2)}亿`}
                      </ColorText>
                    </td>
                    {/* 买入额:加 + */}
                    <td style={{ ...CELL_STYLE, color: COLOR_UP, fontWeight: 600 }}>{`+${s.buyAmount.toFixed(2)}亿`}</td>
                    {/* 卖出额:加 - */}
                    <td style={{ ...CELL_STYLE, color: COLOR_DOWN, fontWeight: 600 }}>{`-${s.sellAmount.toFixed(2)}亿`}</td>
                    {/* 用户 #9 反馈:上榜原因左对齐 */}
                    <td style={{ ...CELL_STYLE, textAlign: 'left' }}>{s.reason}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      {sorted.length > pageSize && (
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 16 }}>
          <Pagination
            current={page}
            pageSize={pageSize}
            total={sorted.length}
            onChange={setPage}
            showTotal={(t) => `第 ${page} / ${Math.ceil(t / pageSize)} 页 · 共 ${t} 条`}
          />
        </div>
      )}
    </div>
  );
}

// 内部 table 组件(用于详情子表)
function Table({ dataSource, columns }: { dataSource: any[]; columns: any[] }) {
  return (
    <div style={{ ...TABLE_STYLE, padding: 4, marginTop: 8 }}>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {columns.map((c: any) => (
                <th key={c.key} style={{ ...HEAD_STYLE, width: c.width, textAlign: c.align || 'center' }}>{c.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {dataSource.length === 0 ? (
              <tr><td colSpan={columns.length} style={{ padding: 40, textAlign: 'center', color: '#86909C', fontSize: 13 }}>今日无龙虎榜数据(非交易日 / 数据未发布)</td></tr>
            ) : (dataSource.map((row: any, i: number) => (
              <tr key={i}>
                {columns.map((c: any) => {
                  const v = row[c.key];
                  const style: React.CSSProperties = {
                    ...CELL_STYLE,
                    textAlign: c.align || 'center',
                    fontWeight: c.align === 'left' ? 500 : 700,
                  };
                  return <td key={c.key} style={style}>{c.render ? c.render(v) : v}</td>;
                })}
              </tr>
            )))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
