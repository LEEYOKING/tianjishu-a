import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { EmotionThermometer } from './EmotionThermometer';
import { useIsMobile } from '../hooks/useIsMobile';
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
  // v2.0.7ea:删 useLiveEmotionTemp(CF Function /api/emotion-temp 已删)
  // — 改用 data.marketOverview.marketTemperature(fetch-data 写入的 8 维算法)
  // — 盘中不实时(每 10 分钟调 Function)— 改用 baseData,收盘 cron 跑时更新
  const location = useLocation();
  // v2.0.7fd:响应式 — 768px 断点(单一来源 useIsMobile)
  const isMobile = useIsMobile();
  // 移动端抽屉开关
  const [drawerOpen, setDrawerOpen] = useState(false);

  const counts = {
    limitUp: data.limitUpStocks.length,
    limitDown: data.limitDownStocks.length,  // v2.0.7ah:跟列表长度一致(避免 list 0 但 count 2 的矛盾)
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

  // v2.0.7fd:抽 menu 渲染成函数 — PC sidebar + 移动端 drawer 复用
  const renderMenu = (onItemClick?: () => void) => (
    <>
      {MENU.map((m) => {
        const active = location.pathname === m.key;
        return (
          <Link
            key={m.key}
            to={m.key}
            onClick={onItemClick}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: isMobile ? '14px 20px' : '11px 24px',
              textDecoration: 'none',
              // 用户 #14 反馈:未选中 Tab 文字颜色改 #4b5563
              color: active ? '#fff' : '#4b5563',
              fontSize: isMobile ? 15 : 14,
              fontWeight: active ? 600 : 500,
              background: active ? '#111827' : 'transparent',
              margin: isMobile ? '0 8px 4px' : '0 12px',
              borderRadius: active ? 6 : 0,
              width: 'calc(100% - ' + (isMobile ? '16px' : '24px') + ')',
              boxSizing: 'border-box',
              transition: 'all .15s',
            }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
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
    </>
  );

  // 情绪温度计(PC sidebar 内 + 移动 drawer 内共用)
  const thermometer = data.marketOverview?.marketTemperature ? (() => {
    const temp = data.marketOverview.marketTemperature;
    return (
      <EmotionThermometer
        temperature={temp.temperature}
        status={temp.status}
        statusDesc={temp.statusDesc}
        details={temp.details}
        dimension_scores={temp.dimension_scores}
        limitUpCount={temp.details.limit_up}
        upCount={temp.details.limit_up}
        downCount={temp.details.limit_down}
      />
    );
  })() : null;

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#F7F9FC', flexDirection: isMobile ? 'column' : 'row' }}>
      {isMobile ? (
        <>
          {/* v2.0.7fd:移动端 — 顶部 header + 右抽屉 */}
          <header
            style={{
              position: 'sticky', top: 0, zIndex: 50,
              height: 56, flexShrink: 0,
              background: '#FFFFFF',
              borderBottom: '1px solid #E5E7EB',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '0 12px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
            }}
          >
            {/* v2.0.7fe:汉堡按钮挪最左(放最常用)— logo 居中靠右 */}
            <button
              aria-label="打开菜单"
              onClick={() => setDrawerOpen(true)}
              style={{
                background: 'transparent', border: 'none', padding: 8,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', color: '#111827', borderRadius: 6,
                marginLeft: -4, flexShrink: 0,
              }}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            </button>
            {/* v2.0.7ff:移动端用 brand-logo-mobile.png(红色版) — PC 端用 brand-logo.png(原版) */}
            <img
              src="/brand-logo-mobile.png"
              alt="天机枢"
              style={{ height: 32, width: 'auto', objectFit: 'contain' }}
            />
            {/* 占位让 logo 视觉居中(透明按钮) */}
            <div style={{ width: 40, flexShrink: 0 }} aria-hidden />
          </header>

          {/* 抽屉 — 遮罩 */}
          {drawerOpen && (
            <div
              onClick={() => setDrawerOpen(false)}
              style={{
                position: 'fixed', inset: 0,
                background: 'rgba(0,0,0,0.45)',
                zIndex: 99,
              }}
            />
          )}

          {/* 抽屉 — 右侧滑入(85% 宽) — v2.0.7ff:抽屉覆盖整个屏幕(top: 0 + zIndex 200)— 抽屉打开时 header 被盖住 */}
          <div
            style={{
              position: 'fixed', top: 0, right: 0, bottom: 0,
              width: '85vw', maxWidth: 360,
              background: '#FFFFFF',
              zIndex: 200,
              transform: drawerOpen ? 'translateX(0)' : 'translateX(100%)',
              transition: 'transform .25s ease',
              display: 'flex', flexDirection: 'column',
              boxShadow: '-2px 0 16px rgba(0,0,0,0.12)',
            }}
          >
            <div
              style={{
                height: 56, flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '0 16px', borderBottom: '1px solid #E5E7EB',
              }}
            >
              <span style={{ fontSize: 15, fontWeight: 600, color: '#111827' }}>导航</span>
              <button
                aria-label="关闭"
                onClick={() => setDrawerOpen(false)}
                style={{
                  background: 'transparent', border: 'none', padding: 8,
                  cursor: 'pointer', color: '#4b5563', borderRadius: 6,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="6" y1="6" x2="18" y2="18" />
                  <line x1="6" y1="18" x2="18" y2="6" />
                </svg>
              </button>
            </div>
            <nav style={{ flex: 1, overflowY: 'auto', padding: '8px 0 12px' }}>
              {renderMenu(() => setDrawerOpen(false))}
            </nav>
            {thermometer && (
              <div style={{ padding: '0 12px 16px', borderTop: '1px solid #E5E7EB', paddingTop: 12, transform: 'scale(0.92)', transformOrigin: 'top left' }}>
                {thermometer}
              </div>
            )}
          </div>

          <main style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
            <div style={{ flex: 1, padding: '12px 12px 16px' }}>{children}</div>
            <footer style={{ padding: '12px 16px', fontSize: 11, color: '#86909C', textAlign: 'center' }}>
              数据来源:东方财富、腾讯行情等公开数据。报告由天机枢生成,仅供复盘参考,不构成投资建议。
            </footer>
          </main>
        </>
      ) : (
        <>
          {/* PC 端 — 原 200px 侧栏(零变化) */}
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
            <div style={{ padding: '20px 12px 24px', textAlign: 'center' }}>
              <img
                src="/brand-logo.png"
                alt="天机枢 · 每日复盘 数据全解析"
                style={{ width: 124, height: 'auto', display: 'block', margin: '0 auto', objectFit: 'contain' }}
              />
            </div>

            {/* 用户 #5 反馈:10 个 Tab 整体下移 15px */}
            <nav style={{ padding: '27px 0 12px', flex: 1, overflowY: 'auto' }}>
              {renderMenu()}
            </nav>

            {/* v2.0.7ea:情绪温度计 — 改用 baseData.marketOverview.marketTemperature(fetch-data 写入) */}
            <div style={{ padding: '0 8px 12px' }}>
              {thermometer}
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
        </>
      )}
    </div>
  );
}
