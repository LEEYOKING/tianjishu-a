import { Link, useLocation } from 'react-router-dom';
import { EmotionThermometer } from './EmotionThermometer';
import type { ReportData } from '../data/loader';

interface Props {
  data: ReportData;
  children: React.ReactNode;
}

const Icon = ({ d }: { d: string }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
);

const Icons = {
  Flame: <Icon d="M8.5 14.5A2.5 2.5 0 0 0 11 17a5 5 0 0 0 5-5c0-.83-.17-1.61-.46-2.33-.66 1.04-1.74 1.83-3.04 2.13-.5.11-.97-.34-.86-.84.41-1.79-.32-3.04-1.27-4.06C9.62 6.04 8.5 4.5 8.5 3 5.5 4 3 7 3 10a8 8 0 0 0 5.5 7.5" />,
  Scan: <Icon d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2M7 12h10" />,
  Chart: <Icon d="M3 3v18h18M7 12l3-3 4 4 5-5" />,
  Grid: <Icon d="M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z" />,
  Ladder: <Icon d="M5 3v18M5 7h14M5 12h14M5 17h14" />,
  Down: <Icon d="M7 13l5 5 5-5M7 6l5 5 5-5" />,
  UpArrow: <Icon d="M3 17l6-6 4 4 8-8M14 7h7v7" />,
  Flag: <Icon d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1zM4 22V15" />,
  Bolt: <Icon d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />,
  Trophy: <Icon d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6M18 9h1.5a2.5 2.5 0 0 0 0-5H18M4 22h16M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22M18 2H6v7a6 6 0 0 0 12 0V2z" />,
  Globe: <Icon d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zM2 12h20M12 2a15 15 0 0 1 4 10 15 15 0 0 1-4 10 15 15 0 0 1-4-10 15 15 0 0 1 4-10z" />,
};

export default function Layout({ data, children }: Props) {
  const location = useLocation();

  const counts = {
    limitUp: data.limitUpStocks.length,
    limitDown: data.limitDownStocks.length,
    dragonTiger: data.dragonTigerStocks.length,
    breakout: data.breakoutStocks.length,
    highBreak: data.highBreakStocks.length,
    lowPosition: data.lowPositionStocks.length,
  };

  const MENU = [
    { key: '/overview', label: '大盘总览', icon: Icons.Chart, count: 0 },
    { key: '/sector', label: '板块涨跌', icon: Icons.Grid, count: 0 },
    { key: '/limit-up', label: '连板天梯', icon: Icons.Ladder, count: counts.limitUp },
    { key: '/limit-down', label: '跌停梯队', icon: Icons.Down, count: counts.limitDown },
    { key: '/breakout', label: '放量突破', icon: Icons.UpArrow, count: counts.breakout },
    { key: '/high-break', label: '突破前高', icon: Icons.Flag, count: counts.highBreak },
    { key: '/low-position', label: '低位放量', icon: Icons.Bolt, count: counts.lowPosition },
    { key: '/dragon-tiger', label: '龙虎榜', icon: Icons.Trophy, count: counts.dragonTiger },
    { key: '/surgery', label: '全景手术台', icon: Icons.Globe, count: 0 },
  ];


  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#F7F9FC' }}>
      {/* 左侧导航 — 不贴边,4 角圆角,边距 16px */}
      <aside
        style={{
          width: 200,
          background: '#FFFFFF',
          display: 'flex',
          flexDirection: 'column',
          flexShrink: 0,
          position: 'sticky',
          top: 16,
          height: 'calc(100vh - 32px)',
          margin: '16px 0 16px 16px',
          // 用户 #18 反馈:全站白色卡片圆角 14px
          borderRadius: 14,
          // 用户 #6 反馈:box-shadow 改 0 1px 3px rgba(0,0,0,0.04), 0 0 30px 5px rgba(0,0,0,0.02)
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04), 0 0 30px 5px rgba(0, 0, 0, 0.02)',
          // 用户 #16 反馈:全站白色卡片加 1px solid #E5E7EB border
          border: '1px solid #E5E7EB',
          padding: '20px 0',
        }}
      >
        {/* 顶部 brand: 水平居中
            用户 #4 反馈:天机枢上方留白 1.4x + 删除下方浅灰横线
            用户 #15 反馈:再加 20px 上边距 */}
        <div style={{ padding: '20px 24px 28px', textAlign: 'center' }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#111827', letterSpacing: 2 }}>
            天机枢
          </div>
          <div style={{ fontSize: 11, color: '#86909C', marginTop: 6, letterSpacing: 0.5 }}>
            每日复盘 · 数据全解析
          </div>
        </div>

        {/* 用户 #5 反馈:10 个 Tab 整体下移 15px */}
        <nav style={{ padding: '27px 0 12px', flex: 1, overflowY: 'auto' }}>
          {MENU.map((m) => {
            const active = location.pathname === m.key;
            return (
              <Link
                key={m.key}
                to={m.key}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '11px 24px',
                  textDecoration: 'none',
                  // 用户 #14 反馈:未选中 Tab 文字颜色改 #4b5563
                  color: active ? '#fff' : '#4b5563',
                  fontSize: 14,
                  fontWeight: active ? 600 : 500,
                  background: active ? '#111827' : 'transparent',
                  margin: '0 12px',
                  borderRadius: active ? 6 : 0,
                  width: 'calc(100% - 24px)',
                  boxSizing: 'border-box',
                  transition: 'all .15s',
                }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  {/* 用户 #14 反馈:icon 颜色 #4b5563 */}
                  <span style={{ display: 'flex', alignItems: 'center', color: active ? '#fff' : '#4b5563' }}>
                    {m.icon}
                  </span>
                  {m.label}
                </span>
                {m.count > 0 && (
                  <span
                    style={{
                      fontSize: 11,
                      color: active ? '#fff' : '#86909C',
                      background: active ? 'rgba(255,255,255,0.15)' : 'transparent',
                      padding: '1px 6px',
                      borderRadius: 8,
                    }}
                  >
                    {m.count}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* v2.0.7u:情绪温度计(无背景 + width 100% + 上下布局)— 撑满 200px 侧栏 */}
        <div style={{ padding: '0 8px 12px' }}>
          {data.marketOverview?.marketTemperature && (
            <EmotionThermometer
              temperature={data.marketOverview.marketTemperature.temperature}
              details={data.marketOverview.marketTemperature.details}
              limitUpCount={data.marketOverview.limitUpCount}
              upCount={data.marketOverview.upCount}
              downCount={data.marketOverview.downCount}
            />
          )}
        </div>
      </aside>

      <main style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        {/* v1.9.8:padding-top 0,PageHeader 自身 paddingTop 20 提供上方 20px 间距 */}
        <div style={{ flex: 1, padding: '0 28px 28px' }}>{children}</div>

        <footer
          style={{
            padding: '14px 32px',
            fontSize: 12,
            color: '#86909C',
            textAlign: 'center',
            background: 'transparent',
          }}
        >
          数据来源:东方财富、腾讯行情等公开数据。报告由天机枢生成,仅供复盘参考,不构成投资建议。
        </footer>
      </main>
    </div>
  );
}
