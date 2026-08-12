// ============================================================
// 天机枢【自选监控 & 笔记】主面板 — v1.0
// 布局:左 25% 分组列表 + 右 75% 详情(基础信息 + 笔记输入 + 历史时间轴)
// 数据:对接 backend/api/watchlist.py(FastAPI) — 静态部署用 localStorage 兜底
// ============================================================

import { useState, useEffect, useMemo } from 'react';
import { Input, Button, Select, message, Tag, Empty, Spin, Tooltip, Divider } from 'antd';
import { PlusOutlined, DeleteOutlined, EditOutlined, ThunderboltOutlined, FireOutlined } from '@ant-design/icons';
import { COLOR_UP, COLOR_DOWN, COLOR_TEXT } from '../utils/format';

const { TextArea } = Input;

// ============================================================
// API 地址(后端部署后改这里)
// ============================================================
const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000';

// ============================================================
// 类型定义
// ============================================================
interface Group {
  id: number;
  group_name: string;
  sort_order: number;
  stock_count: number;
  created_at: string;
}

interface Stock {
  id: number;
  group_id: number;
  stock_code: string;
  stock_name: string;
  status_color: 'green' | 'red' | 'yellow' | 'gray';
  status_note?: string;
  status_updated?: string;
  added_at: string;
  last_price?: number;
  change_percent?: number;
  change_amount?: number;
  turnover?: number;
}

interface Note {
  id: number;
  stock_code: string;
  note_date: string;
  buy_logic_tags: string[];
  target_price?: number;
  stop_loss_price?: number;
  emotion_tag: '确定性高' | '犹豫不决' | '随意试错';
  note_text: string;
  created_at: string;
}

const BUY_LOGIC_TAGS = ['板块联动', '技术突破', '资金流入', '消息利好'] as const;
const EMOTION_TAGS = ['确定性高', '犹豫不决', '随意试错'] as const;

// 状态色
const STATUS_COLOR_MAP: Record<string, string> = {
  green:  '#0ecd70',  // 符合预期
  red:    '#ff4d4f',  // 异动预警
  yellow: '#f59e0b',  // 关注
  gray:   '#9ca3af',  // 无风起浪
};

// ============================================================
// localStorage 兜底(后端没部署时)— A 方案
// ============================================================
const LS_KEY = 'tianjishu_watchlist_v1';
interface LSData {
  groups: Group[];
  stocks: Stock[];
  notes: Note[];
}
function loadLS(): LSData {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return { groups: [], stocks: [], notes: [] };
}
function saveLS(d: LSData) {
  localStorage.setItem(LS_KEY, JSON.stringify(d));
}

// 跨标签页同步 — storage 事件
function watchLS(cb: () => void): () => void {
  const h = (e: StorageEvent) => { if (e.key === LS_KEY) cb(); };
  window.addEventListener('storage', h);
  return () => window.removeEventListener('storage', h);
}

// ============================================================
// 主组件
// ============================================================
export default function WatchlistDashboard() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [activeGroupId, setActiveGroupId] = useState<number | null>(null);
  const [activeStock, setActiveStock] = useState<Stock | null>(null);
  const [loading, setLoading] = useState(false);
  const [usingLS, setUsingLS] = useState(false);  // true = 后端不通,降级 localStorage

  // 笔记表单状态
  const [noteTags, setNoteTags] = useState<string[]>([]);
  const [noteTarget, setNoteTarget] = useState<number | undefined>(undefined);
  const [noteStop, setNoteStop] = useState<number | undefined>(undefined);
  const [noteEmotion, setNoteEmotion] = useState<typeof EMOTION_TAGS[number]>('确定性高');
  const [noteText, setNoteText] = useState('');

  // ---- 加载数据 ----
  const loadAll = async () => {
    setLoading(true);
    try {
      const gRes = await fetch(`${API_BASE}/api/watchlist/groups`).then(r => r.ok ? r.json() : null);
      if (gRes) {
        setGroups(gRes);
        setUsingLS(false);
        if (gRes.length && !activeGroupId) setActiveGroupId(gRes[0].id);
      } else throw new Error('后端不通');
    } catch {
      // 降级 localStorage
      setUsingLS(true);
      const ls = loadLS();
      setGroups(ls.groups);
      setStocks(ls.stocks);
      setNotes(ls.notes);
      if (ls.groups.length && !activeGroupId) setActiveGroupId(ls.groups[0].id);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadAll(); /* eslint-disable-next-line */ }, []);

  // v2.0.7ap:跨标签页同步(同浏览器开多个 tab,自选数据自动同步)
  useEffect(() => {
    return watchLS(() => {
      const ls = loadLS();
      setGroups(ls.groups);
      setStocks(ls.stocks);
      setNotes(ls.notes);
      message.info('数据已从其他标签页同步', 1);
    });
  }, []);

  // ---- 加载某分组股票 ----
  const loadStocks = async (gid: number) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/watchlist/${gid}`);
      if (res.ok) {
        const data = await res.json();
        setStocks(data);
        setUsingLS(false);
      } else throw new Error('fail');
    } catch {
      // localStorage 兜底
      const ls = loadLS();
      setStocks(ls.stocks.filter(s => s.group_id === gid));
      setUsingLS(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeGroupId !== null) loadStocks(activeGroupId);
    // eslint-disable-next-line
  }, [activeGroupId]);

  // ---- 当前选中股票的历史笔记 ----
  const activeNotes = useMemo(
    () => activeStock ? notes.filter(n => n.stock_code === activeStock.stock_code).sort((a, b) => b.note_date.localeCompare(a.note_date)) : [],
    [notes, activeStock]
  );

  // ---- 操作 ----
  const handleAddGroup = async () => {
    const name = prompt('请输入分组名称:');
    if (!name) return;
    try {
      const res = await fetch(`${API_BASE}/api/watchlist/groups`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ group_name: name, sort_order: groups.length + 1 }),
      });
      if (res.ok) {
        const g = await res.json();
        setGroups([...groups, { ...g, stock_count: 0 }]);
        message.success('分组已创建');
      } else throw new Error();
    } catch {
      // localStorage
      const ls = loadLS();
      const newG = { id: Date.now(), group_name: name, sort_order: groups.length + 1, stock_count: 0, created_at: new Date().toISOString() };
      ls.groups.push(newG);
      saveLS(ls);
      setGroups([...groups, newG]);
      message.success('(本地)分组已创建');
    }
  };

  const handleAddStock = async () => {
    if (activeGroupId === null) return message.warning('请先选分组');
    const code = prompt('股票代码(6 位数字):');
    if (!code || !/^\d{6}$/.test(code)) return;
    const name = prompt('股票名称:');
    if (!name) return;
    try {
      const res = await fetch(`${API_BASE}/api/watchlist/add`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ group_id: activeGroupId, stock_code: code, stock_name: name }),
      });
      if (res.ok) {
        const s = await res.json();
        setStocks([...stocks, s]);
        message.success('已加入自选');
      } else {
        const err = await res.json().catch(() => ({}));
        message.error(err.detail || '添加失败');
      }
    } catch {
      // localStorage
      const ls = loadLS();
      const newS = { id: Date.now(), group_id: activeGroupId, stock_code: code, stock_name: name, status_color: 'gray' as const, added_at: new Date().toISOString() };
      ls.stocks.push(newS);
      saveLS(ls);
      setStocks([...stocks, newS]);
      message.success('(本地)已加入');
    }
  };

  const handleRemoveStock = async (sid: number) => {
    if (!confirm('确认删除?')) return;
    try {
      await fetch(`${API_BASE}/api/watchlist/stocks/${sid}`, { method: 'DELETE' });
    } catch { /* localStorage */ }
    setStocks(stocks.filter(s => s.id !== sid));
    if (activeStock?.id === sid) setActiveStock(null);
    const ls = loadLS();
    ls.stocks = ls.stocks.filter(s => s.id !== sid);
    saveLS(ls);
  };

  const handleCreateNote = async () => {
    if (!activeStock) return message.warning('请先选股票');
    if (noteTags.length === 0) return message.warning('请至少选 1 个买入逻辑');
    const payload = {
      stock_code: activeStock.stock_code,
      note_date: new Date().toISOString().slice(0, 10),
      buy_logic_tags: noteTags,
      target_price: noteTarget,
      stop_loss_price: noteStop,
      emotion_tag: noteEmotion,
      note_text: noteText,
      linked_group_id: activeGroupId,
    };
    try {
      const res = await fetch(`${API_BASE}/api/notes/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const n = await res.json();
        setNotes([n, ...notes]);
        message.success('笔记已保存');
      } else throw new Error();
    } catch {
      // localStorage 兜底
      const ls = loadLS();
      const newN = { id: Date.now(), ...payload, created_at: new Date().toISOString() };
      ls.notes.unshift(newN);
      saveLS(ls);
      setNotes([newN, ...notes]);
      message.success('(本地)笔记已保存');
    }
    setNoteText('');
    setNoteTarget(undefined);
    setNoteStop(undefined);
  };

  const handleRunAlerts = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/watchlist/alerts/run`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        message.success(`异动检查完成:发现 ${data.count} 只异动股`);
        if (activeGroupId) loadStocks(activeGroupId);
      } else throw new Error();
    } catch {
      message.warning('A 方案(纯 localStorage)无后端,无法跑批量异动检查。请查看手动状态灯。');
    } finally {
      setLoading(false);
    }
  };

  // v2.0.7ap:导出/导入(防止浏览器清理丢数据)
  const handleExport = () => {
    const ls = loadLS();
    const blob = new Blob([JSON.stringify(ls, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tianjishu_watchlist_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    message.success(`已导出 ${ls.groups.length} 分组 / ${ls.stocks.length} 股票 / ${ls.notes.length} 笔记`);
  };

  const handleImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json';
    input.onchange = (e: any) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const data = JSON.parse(reader.result as string);
          if (!data.groups || !data.stocks || !data.notes) throw new Error('格式不对');
          if (!confirm(`将覆盖当前数据:导入 ${data.groups.length} 分组 / ${data.stocks.length} 股票 / ${data.notes.length} 笔记?`)) return;
          saveLS(data);
          setGroups(data.groups);
          setStocks(data.stocks);
          setNotes(data.notes);
          if (data.groups.length) setActiveGroupId(data.groups[0].id);
          message.success('导入成功');
        } catch (e: any) {
          message.error('文件格式错误:' + e.message);
        }
      };
      reader.readAsText(file);
    };
    input.click();
  };

  // ---- 渲染 ----
  return (
    <Spin spinning={loading}>
      <div style={{ display: 'flex', gap: 12, height: 'calc(100vh - 180px)', minHeight: 600 }}>
        {/* ===== 左 25% — 分组列表 ===== */}
        <div style={{ width: '25%', minWidth: 240, background: '#fff', borderRadius: 12, padding: 12, overflow: 'auto', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <div style={{ fontSize: 14, fontWeight: 700 }}>
              📋 自选分组
              {usingLS && <Tag color="orange" style={{ marginLeft: 6, fontSize: 10 }}>本地</Tag>}
            </div>
            <Button size="small" icon={<PlusOutlined />} onClick={handleAddGroup}>分组</Button>
          <Button size="small" onClick={handleExport} style={{ marginLeft: 4 }} title="导出 JSON">导出</Button>
          <Button size="small" onClick={handleImport} style={{ marginLeft: 4 }} title="导入 JSON">导入</Button>
          </div>

          {groups.length === 0 ? (
            <Empty description="暂无分组" />
          ) : groups.map(g => (
            <div key={g.id}
              onClick={() => setActiveGroupId(g.id)}
              style={{
                padding: '8px 10px', marginBottom: 4, borderRadius: 6, cursor: 'pointer',
                background: activeGroupId === g.id ? '#111827' : '#F7F8FA',
                color: activeGroupId === g.id ? '#fff' : COLOR_TEXT,
                fontSize: 13, fontWeight: activeGroupId === g.id ? 600 : 500,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>{g.group_name}</span>
                <span style={{ fontSize: 11, opacity: 0.7 }}>{g.stock_count}</span>
              </div>
            </div>
          ))}

          {activeGroupId !== null && (
            <>
              <Divider style={{ margin: '12px 0' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontSize: 12, color: '#6b7280' }}>组内股票({stocks.length})</span>
                <Button size="small" icon={<PlusOutlined />} onClick={handleAddStock}>加</Button>
              </div>
              {stocks.length === 0 ? (
                <div style={{ fontSize: 12, color: '#9ca3af', textAlign: 'center', padding: 20 }}>点击"加"添加股票</div>
              ) : stocks.map(s => (
                <div key={s.id} onClick={() => setActiveStock(s)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6, padding: '6px 8px', borderRadius: 4, cursor: 'pointer',
                    background: activeStock?.id === s.id ? '#E0F2FE' : 'transparent',
                    fontSize: 12, marginBottom: 2,
                  }}
                  onMouseEnter={e => { if (activeStock?.id !== s.id) e.currentTarget.style.background = '#F7F8FA'; }}
                  onMouseLeave={e => { if (activeStock?.id !== s.id) e.currentTarget.style.background = 'transparent'; }}
                >
                  {/* 状态圆点 */}
                  <Tooltip title={s.status_note || STATUS_COLOR_MAP[s.status_color]}>
                    <div style={{
                      width: 8, height: 8, borderRadius: '50%',
                      background: STATUS_COLOR_MAP[s.status_color] || '#9ca3af',
                      boxShadow: s.status_color === 'red' ? '0 0 4px #ff4d4f' : 'none',
                      flexShrink: 0,
                    }} />
                  </Tooltip>
                  {/* 名称 */}
                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 500 }}>
                    {s.stock_name}
                  </span>
                  {/* 现价 */}
                  {s.last_price != null && (
                    <span style={{ fontFamily: 'monospace' }}>{s.last_price.toFixed(2)}</span>
                  )}
                  {/* 涨跌幅 */}
                  {s.change_percent != null && (
                    <span style={{ color: s.change_percent > 0 ? COLOR_UP : s.change_percent < 0 ? COLOR_DOWN : '#9ca3af', minWidth: 50, textAlign: 'right' }}>
                      {s.change_percent > 0 ? '+' : ''}{s.change_percent.toFixed(2)}%
                    </span>
                  )}
                  <Button type="text" size="small" danger icon={<DeleteOutlined />} onClick={(e) => { e.stopPropagation(); handleRemoveStock(s.id); }} />
                </div>
              ))}
            </>
          )}
        </div>

        {/* ===== 右 75% — 详情区 ===== */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12, overflow: 'auto' }}>
          {!activeStock ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fff', borderRadius: 12, color: '#9ca3af' }}>
              <Empty description="请从左侧选一只自选股" />
            </div>
          ) : (
            <>
              {/* 顶部 — 基础信息 */}
              <div style={{ background: '#fff', borderRadius: 12, padding: 16, boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ fontSize: 20, fontWeight: 700 }}>{activeStock.stock_name} <span style={{ fontSize: 13, color: '#6b7280', fontWeight: 400 }}>{activeStock.stock_code}</span></div>
                    {activeStock.status_note && (
                      <div style={{ marginTop: 4, fontSize: 12, color: '#dc2626' }}>
                        <FireOutlined /> {activeStock.status_note}
                      </div>
                    )}
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    {activeStock.last_price != null && (
                      <div style={{ fontSize: 24, fontWeight: 700, color: (activeStock.change_percent || 0) > 0 ? COLOR_UP : (activeStock.change_percent || 0) < 0 ? COLOR_DOWN : COLOR_TEXT }}>
                        {activeStock.last_price.toFixed(2)}
                      </div>
                    )}
                    {activeStock.change_percent != null && (
                      <div style={{ fontSize: 14, color: activeStock.change_percent > 0 ? COLOR_UP : COLOR_DOWN }}>
                        {activeStock.change_percent > 0 ? '+' : ''}{activeStock.change_percent.toFixed(2)}%
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* 中部 — 笔记输入 */}
              <div style={{ background: '#fff', borderRadius: 12, padding: 16, boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>📝 新增结构化笔记</div>
                <div style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>买入逻辑(可多选)</div>
                  <Select mode="multiple" value={noteTags} onChange={setNoteTags} placeholder="选择至少 1 个" style={{ width: '100%' }} options={BUY_LOGIC_TAGS.map(t => ({ label: t, value: t }))} />
                </div>
                <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>目标价</div>
                    <Input type="number" value={noteTarget} onChange={e => setNoteTarget(e.target.value ? +e.target.value : undefined)} placeholder="例:15.50" />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>止损价</div>
                    <Input type="number" value={noteStop} onChange={e => setNoteStop(e.target.value ? +e.target.value : undefined)} placeholder="例:12.00" />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>情绪标记</div>
                    <Select value={noteEmotion} onChange={setNoteEmotion} style={{ width: '100%' }} options={EMOTION_TAGS.map(t => ({ label: t, value: t }))} />
                  </div>
                </div>
                <div style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>补充逻辑</div>
                  <TextArea rows={3} value={noteText} onChange={e => setNoteText(e.target.value)} placeholder="为什么买?预期怎么走?止盈止损依据..." />
                </div>
                <Button type="primary" icon={<EditOutlined />} onClick={handleCreateNote}>保存笔记</Button>
              </div>

              {/* 底部 — 历史笔记时间轴 */}
              <div style={{ background: '#fff', borderRadius: 12, padding: 16, boxShadow: '0 1px 3px rgba(0,0,0,0.04)', flex: 1, overflow: 'auto' }}>
                <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>📅 历史笔记({activeNotes.length})</div>
                {activeNotes.length === 0 ? (
                  <Empty description="暂无历史笔记" />
                ) : (
                  <div style={{ position: 'relative', paddingLeft: 16 }}>
                    <div style={{ position: 'absolute', left: 4, top: 8, bottom: 8, width: 2, background: '#E5E7EB' }} />
                    {activeNotes.map(n => (
                      <div key={n.id} style={{ position: 'relative', marginBottom: 16 }}>
                        <div style={{ position: 'absolute', left: -16, top: 6, width: 10, height: 10, borderRadius: '50%', background: n.emotion_tag === '确定性高' ? '#0ecd70' : n.emotion_tag === '犹豫不决' ? '#f59e0b' : '#9ca3af' }} />
                        <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>
                          {n.note_date} · <strong style={{ color: '#111827' }}>{n.emotion_tag}</strong>
                          {n.target_price && <span style={{ marginLeft: 8 }}>🎯 目标 {n.target_price}</span>}
                          {n.stop_loss_price && <span style={{ marginLeft: 8 }}>🛑 止损 {n.stop_loss_price}</span>}
                        </div>
                        <div style={{ marginBottom: 4 }}>
                          {n.buy_logic_tags.map(t => <Tag key={t} color="blue" style={{ marginBottom: 2 }}>{t}</Tag>)}
                        </div>
                        {n.note_text && <div style={{ fontSize: 12, color: '#4b5563', background: '#F7F8FA', padding: '6px 10px', borderRadius: 4 }}>{n.note_text}</div>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* 底部工具栏 — 跑异动检查 */}
      <div style={{ position: 'fixed', bottom: 80, right: 32 }}>
        <Tooltip title="盘后跑批:检查放量/突破">
          <Button type="primary" shape="circle" size="large" icon={<ThunderboltOutlined />} onClick={handleRunAlerts} />
        </Tooltip>
      </div>
    </Spin>
  );
}
