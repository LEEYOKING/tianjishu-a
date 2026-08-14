import { useState, useMemo } from 'react';
import { Button, Space, Pagination } from 'antd';
import { LeftOutlined, ArrowLeftOutlined, ArrowRightOutlined } from '@ant-design/icons';
import { PageHeader } from './Overview';
import type { ReportData } from '../data/loader';
import { useLive } from '../App';
import { SmartDragonTigerCard, type InterpretedData } from '../components/SmartDragonTigerCard';

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
    // v2.0.7bg:龙虎榜数据是 T-1 收盘数据(交易所 15:30 后才公布当日上榜)
    // 盘中:idx.tradeDate 已经是 8:00 hook 切的今天日期(8/14)
    // 但 fetch_real_data 跑出的龙虎榜实际是上一交易日(8/13)的上榜股
    // — 用 idx.tradeDate 跟 上一交易日 tradeDateSlash 对比,显示提示
    const _now8 = new Date(Date.now() + 8 * 3600 * 1000);
    const _todayYMD = `${_now8.getUTCFullYear()}${String(_now8.getUTCMonth() + 1).padStart(2, '0')}${String(_now8.getUTCDate()).padStart(2, '0')}`;
    const _isT1Data = idx.tradeDate !== _todayYMD;
    const _dataDateText = idx.tradeDateSlash || idx.tradeDate;
    return (
      <div>
        <PageHeader
          title={`龙虎榜 · ${idx.tradeDate.replace(/^(\d{4})(\d{2})(\d{2})$/, '$1$2$3').replace(/(\d{4})(\d{2})(\d{2})/, '$1/$2/$3')}`}
          tradeDateSlash={idx.tradeDateSlash} _originalTradeDate={idx.tradeDate}
          generatedAt={idx.generatedAt}
          liveTag="智能解读"
          subtitle={_isT1Data
            ? `机构/游资买卖席位 · ⚠️ 数据截至 ${_dataDateText} 收盘(${_todayYMD.slice(0,4)}/${_todayYMD.slice(4,6)}/${_todayYMD.slice(6,8)} 盘中未公布当日龙虎榜)`
            : '机构/游资买卖席位 · 当日数据'}
          lastUpdatedAt={useLive().fetchedAt}
        />
        <div style={{ marginBottom: 16 }}>
          <Space>
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
        </div>
        {stock.interpreted && <SmartDragonTigerCard data={stock.interpreted as InterpretedData} />}
      </div>
    );
  }

  const paged = sorted.slice((page - 1) * pageSize, page * pageSize);

  // 过滤有 interpreted 数据的股票
  const hasInterp = sorted.filter(s => s.interpreted).length;

  // v2.0.7ac:title 加日期(tradeDate 转 YYYY/MM/DD)
  const titleDate = (() => {
    const d = idx.tradeDate;  // YYYYMMDD
    if (d.length === 8) return `${d.slice(0, 4)}/${d.slice(4, 6)}/${d.slice(6, 8)}`;
    return d;
  })();

  // v2.0.7bg:龙虎榜数据是 T-1 收盘数据(交易所 15:30 后才公布当日上榜)
  // 盘中:idx.tradeDate 跟 todayYMD 不一致(8/14 盘中 idx.tradeDate 仍是 8/13)
  const _now8 = new Date(Date.now() + 8 * 3600 * 1000);
  const _todayYMD = `${_now8.getUTCFullYear()}${String(_now8.getUTCMonth() + 1).padStart(2, '0')}${String(_now8.getUTCDate()).padStart(2, '0')}`;
  const _isT1Data = idx.tradeDate !== _todayYMD;
  const _dataDateText = idx.tradeDateSlash || idx.tradeDate;

  return (
    <div>
      <PageHeader
        title={`龙虎榜 · ${titleDate}`}
        tradeDateSlash={idx.tradeDateSlash} _originalTradeDate={idx.tradeDate}
        generatedAt={idx.generatedAt}
        liveTag="智能解读"
        subtitle={`AI 解读主力意图 · 共 ${sorted.length} 只${hasInterp < sorted.length ? `(${hasInterp} 只已解读)` : ''}${_isT1Data ? ` · ⚠️ 数据截至 ${_dataDateText} 收盘` : ''}`}
        lastUpdatedAt={useLive().fetchedAt}
      />
      <div className="dt-grid">
        {sorted.length === 0 && (
          <div style={{ ...TABLE_STYLE, padding: 40, textAlign: 'center', color: '#86909C', fontSize: 13 }}>
            今日无龙虎榜数据(非交易日 / 数据未发布)
          </div>
        )}
        {sorted.length > 0 && paged.map((s, i) => {
          if (!s.interpreted) return null;
          return (
            <div key={s.code} onClick={() => setSelectedIdx((page - 1) * pageSize + i)} style={{ cursor: 'pointer' }}>
              <SmartDragonTigerCard data={s.interpreted as InterpretedData} />
            </div>
          );
        })}
      </div>
      {/* v2.0.7ac:3 列 → 2 列 → 1 列 响应式(原 900px 跳 1 列,现在加 1400px 跳 2 列) */}
      <style>{`
        .dt-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 12px;
        }
        @media (max-width: 1600px) {
          .dt-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          }
        }
        @media (max-width: 900px) {
          .dt-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
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

