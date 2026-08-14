import { useState, useMemo } from 'react';
import { Button, Space, Pagination } from 'antd';
import { LeftOutlined, ArrowLeftOutlined, ArrowRightOutlined } from '@ant-design/icons';
import { PageHeader } from './Overview';
import type { ReportData } from '../data/loader';
import { useLive } from '../App';
import { SmartDragonTigerCard, type InterpretedData } from '../components/SmartDragonTigerCard';

// 表格容器样式(用户 #18 / #6 反馈:全站圆角 14 + 新阴影)
const TABLE_STYLE = { background: '#fff', borderRadius: 14, boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04), 0 0 30px 5px rgba(0, 0, 0, 0.02)', border: '1px solid #E5E7EB', padding: 4 };

// v2.0.7cd:龙虎榜 T-1 判断逻辑修正
// 盘中(9:30-15:00)→ T-1(显示"数据截至 {dtMeta.tradeDate} 收盘")— 15:00 收盘后龙虎榜还在披露中
// 盘后(15:00 后)+ 周末 + 节假日 → T(不显示 T-1 提示,数据就是今天或最后交易日)
function _isT1DataDefault(_dtMeta: any, _idx: any): boolean {
  const _now8 = new Date(Date.now() + 8 * 3600 * 1000);
  const _dayOfWeek = _now8.getUTCDay();  // 0=周日, 6=周六
  const _isWeekend = _dayOfWeek === 0 || _dayOfWeek === 6;
  // 周末/节假日永远 T(没新数据,显示最后交易日的)
  if (_isWeekend) return false;
  const _nowMinutes = _now8.getUTCHours() * 60 + _now8.getUTCMinutes();
  const _isIntraday = _nowMinutes >= 9*60+30 && _nowMinutes < 15*60;  // 9:30-15:00
  // 盘中 → T-1(因为 9:35/10:30/13:30/14:30 cron 跑时 18:00 还没披露,tradeDate=上一交易日)
  // 盘后(15:00 后)→ T(15:35 cron 跑过了,tradeDate=今天)
  return _isIntraday;
}

export default function DragonTiger({ data }: { data: ReportData }) {
  const idx = data.marketOverview;
  // v2.0.7bn:龙虎榜数据自身的元信息(实际是哪天的数据,如 8/13)
  // 跟 marketOverview.tradeDate(8/14 今天) 不同 — 因为 A 股龙虎榜 15:30 后才公布
  const dtMeta = data.dragonTiger;
  const sorted = useMemo(() => [...data.dragonTigerStocks].sort((a, b) => b.netBuy - a.netBuy), [data.dragonTigerStocks]);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [page, setPage] = useState(1);
  const pageSize = 25;

  if (selectedIdx !== null) {
    const stock = sorted[selectedIdx];
    // v2.0.7bn:title 用数据实际日期(8/13) — 跟用户预期一致
    const _dataDateText = dtMeta?.tradeDateSlash || idx.tradeDateSlash;
    return (
      <div>
        <PageHeader
          title="龙虎榜"
          tradeDateSlash={idx.tradeDateSlash} _originalTradeDate={idx.tradeDate}
          generatedAt={idx.generatedAt}
          liveTag="智能解读"
          subtitle={(() => {
            const _isT1 = _isT1DataDefault(dtMeta, idx);
            // 总是显示"数据截至"提示(数据日期 + 状态)
            // T-1:9:30-15:00 盘中,数据是上一交易日(18:00 还没披露当天的)
            // T:盘后 15:00 后 + 周末,数据是今天/最后交易日
            if (_isT1) {
              return `机构/游资买卖席位 · ⚠️ 数据截至 ${_dataDateText} 收盘(18:00 完整披露)`;
            } else {
              return `机构/游资买卖席位 · ✓ 数据截至 ${_dataDateText} 收盘(18:00 完整披露)`;
            }
          })()}
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

  // v2.0.7bn:title 简化为"龙虎榜",subtitle 显示数据实际日期
  const _isT1Data = _isT1DataDefault(dtMeta, idx);
  const _dataDateText = dtMeta?.tradeDateSlash || idx.tradeDateSlash;

  return (
    <div>
      <PageHeader
        title="龙虎榜"
        tradeDateSlash={idx.tradeDateSlash} _originalTradeDate={idx.tradeDate}
        generatedAt={idx.generatedAt}
        liveTag="智能解读"
        subtitle={`AI 解读主力意图 · 共 ${sorted.length} 只${hasInterp < sorted.length ? `(${hasInterp} 只已解读)` : ''}${_isT1Data ? ` · ⚠️ 数据截至 ${_dataDateText} 收盘(18:00 完整披露)` : ` · ✓ 数据截至 ${_dataDateText} 收盘(18:00 完整披露)`}`}
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

