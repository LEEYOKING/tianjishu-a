import { useEffect, useState, useMemo, createContext, useContext } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Overview from './pages/Overview';
import LimitUp from './pages/LimitUp';
import LimitDown from './pages/LimitDown';
import Sector from './pages/Sector';
import AnomalyStock from './pages/AnomalyStock';
import DragonTiger from './pages/DragonTiger';
import Surgery from './pages/Surgery';
import { loadReportData, type ReportData } from './data/loader';
import { useLiveData, mergeLiveData, type LiveSnapshot } from './hooks/useLiveData';

// 全局 live context — PageHeader 通过它读 lastUpdatedAt
const LiveContext = createContext<LiveSnapshot>({
  indices: [], market: null, history: null, today: null, fetchedAt: 0,
} as unknown as LiveSnapshot);
export const useLive = () => useContext(LiveContext);

export default function App() {
  const [baseData, setBaseData] = useState<ReportData | null>(null);
  const [baseErr, setBaseErr] = useState<string | null>(null);
  const live = useLiveData(true);

  useEffect(() => {
    // v2.0.7o:fetch 失败时如果已有 baseData(后台标签页被节流),静默不显示错误页
    const fetchData = () =>
      loadReportData(true)
        .then((d) => {
          setBaseData(d);
          setBaseErr(null);
        })
        .catch((e) => {
          // 只在首次加载失败(baseData 还没设)时报错;后续失败静默(后台节流/网络抖动)
          setBaseData((prev) => {
            if (prev === null) setBaseErr(String(e?.message || e));
            return prev;
          });
        });
    fetchData();
    const reloadTimer = setInterval(fetchData, 60_000);
    return () => clearInterval(reloadTimer);
  }, []);

  const merged = useMemo(() => {
    if (!baseData) return null;
    return mergeLiveData(baseData, live);
  }, [baseData, live]);

  if (baseErr) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        <div style={{ textAlign: 'center', maxWidth: 480, padding: 24 }}>
          <h2 style={{ color: '#E60012', marginBottom: 12 }}>数据加载失败</h2>
          <p style={{ color: '#6b7280', fontSize: 14, marginBottom: 6 }}>{baseErr}</p>
          <p style={{ color: '#9ca3af', fontSize: 12, marginBottom: 20 }}>可能原因:网络不稳定 / GitHub Pages 部署中 / 服务器异常</p>
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: '8px 20px', fontSize: 14, fontWeight: 500,
              color: '#fff', background: '#1890ff', border: 'none', borderRadius: 6,
              cursor: 'pointer',
            }}
          >
            🔄 重新加载
          </button>
        </div>
      </div>
    );
  }

  // v1.9.1 启动页文案 + loading 动画 + v2.0 粒子背景
  if (!merged || live.isFirstLoad) {
    return (
      <div style={{
        position: 'relative',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        minHeight: '100vh', background: 'linear-gradient(180deg, #fafbff 0%, #f5f7fa 100%)',
        flexDirection: 'column', gap: 20, overflow: 'hidden',
      }}>
        <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20 }}>
          <div style={{ fontSize: 17, color: '#4b5563', fontWeight: 500, letterSpacing: 1 }}>
            正在进入你的天机枢
          </div>
          <div style={{ fontSize: 13, color: '#86909C' }}>
            每日复盘 · 数据全解析
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
            <span style={{ fontSize: 13, color: '#1890ff', fontWeight: 500 }}>进入中</span>
            <span className="loading-dots">
              <span /><span /><span />
            </span>
          </div>
        </div>
        <style>{`
          .loading-dots { display: inline-flex; gap: 4px; }
          .loading-dots span {
            width: 6px; height: 6px; border-radius: 50%; background: #1890ff;
            animation: dotBounce 1.2s infinite ease-in-out;
          }
          .loading-dots span:nth-child(1) { animation-delay: 0s; }
          .loading-dots span:nth-child(2) { animation-delay: 0.15s; }
          .loading-dots span:nth-child(3) { animation-delay: 0.3s; }
          @keyframes dotBounce {
            0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
            40% { transform: scale(1); opacity: 1; }
          }
        `}</style>
      </div>
    );
  }

  return (
    <LiveContext.Provider value={live}>
      <BrowserRouter>
        <Layout data={merged}>
          <Routes>
            <Route path="/" element={<Navigate to="/overview" replace />} />
            <Route path="/overview" element={<Overview data={merged} />} />
            <Route path="/sector" element={<Sector data={merged} />} />
            <Route path="/limit-up" element={<LimitUp data={merged} />} />
            <Route path="/limit-down" element={<LimitDown data={merged} />} />
            <Route path="/breakout" element={<AnomalyStock type="breakout" data={merged} />} />
            <Route path="/high-break" element={<AnomalyStock type="high-break" data={merged} />} />
            <Route path="/low-position" element={<AnomalyStock type="low-position" data={merged} />} />
            <Route path="/dragon-tiger" element={<DragonTiger data={merged} />} />
            <Route path="/surgery" element={<Surgery data={merged} />} />
          </Routes>
        </Layout>
      </BrowserRouter>
    </LiveContext.Provider>
  );
}
