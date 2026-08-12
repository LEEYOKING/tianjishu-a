# ============================================================
# 天机枢【自选监控 & 笔记】FastAPI 后端
# 文件:backend/api/watchlist.py
# 启动:uvicorn backend.api.watchlist:app --reload --port 8000
# 依赖:fastapi uvicorn[standard] pydantic akshare pandas
# ============================================================

import os
import json
import sqlite3
import logging
from contextlib import contextmanager
from datetime import datetime, timedelta
from typing import List, Optional

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import pandas as pd

logging.basicConfig(level=logging.INFO, format='%(asctime)s [%(levelname)s] %(message)s')
log = logging.getLogger('watchlist')

# ---- 数据库路径 ----
DB_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', 'data'))
DB_PATH = os.path.join(DB_DIR, 'tianjishu.db')
SCHEMA_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'schema.sql'))

# ---- 初始化 ----
app = FastAPI(title='天机枢·自选监控 & 笔记 API', version='1.0.0')

# CORS — 前端跨域调用
app.add_middleware(
    CORSMiddleware,
    allow_origins=['*'],
    allow_credentials=True,
    allow_methods=['*'],
    allow_headers=['*'],
)


def init_db():
    os.makedirs(DB_DIR, exist_ok=True)
    if not os.path.exists(DB_PATH):
        log.info(f'创建数据库:{DB_PATH}')
    conn = sqlite3.connect(DB_PATH)
    with open(SCHEMA_PATH, 'r', encoding='utf-8') as f:
        conn.executescript(f.read())
    conn.close()


@contextmanager
def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute('PRAGMA foreign_keys = ON')
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


# ---- Pydantic 模型 ----
class GroupCreateReq(BaseModel):
    group_name: str = Field(..., min_length=1, max_length=50)
    sort_order: int = 0


class GroupOut(BaseModel):
    id: int
    group_name: str
    sort_order: int
    stock_count: int = 0
    created_at: str


class AddStockReq(BaseModel):
    group_id: int
    stock_code: str = Field(..., pattern=r'^\d{6}$')
    stock_name: str = Field(..., min_length=1, max_length=50)


class StockOut(BaseModel):
    id: int
    group_id: int
    stock_code: str
    stock_name: str
    status_color: str
    status_note: Optional[str] = None
    status_updated: Optional[str] = None
    added_at: str
    # 实时行情(从 akshare 拉,失败时 None)
    last_price: Optional[float] = None
    change_percent: Optional[float] = None
    change_amount: Optional[float] = None
    turnover: Optional[float] = None  # 成交额(亿)


class NoteCreateReq(BaseModel):
    stock_code: str = Field(..., pattern=r'^\d{6}$')
    note_date: str = Field(..., pattern=r'^\d{4}-\d{2}-\d{2}$')
    buy_logic_tags: List[str]
    target_price: Optional[float] = None
    stop_loss_price: Optional[float] = None
    emotion_tag: str = Field(..., pattern=r'^(确定性高|犹豫不决|随意试错)$')
    note_text: str = ''
    linked_group_id: Optional[int] = None


class NoteOut(BaseModel):
    id: int
    stock_code: str
    note_date: str
    buy_logic_tags: List[str]
    target_price: Optional[float]
    stop_loss_price: Optional[float]
    emotion_tag: str
    note_text: str
    created_at: str


# ---- akshare 实时行情(带缓存避免频繁请求) ----
import time as _time
_quote_cache = {}  # {code: (timestamp, data)}


def fetch_quote_sina(code: str) -> Optional[dict]:
    """sina 实时行情 — 浏览器/后端都能用,CORS ✓,稳定"""
    # 缓存 5s
    if code in _quote_cache:
        ts, data = _quote_cache[code]
        if _time.time() - ts < 5:
            return data
    import urllib.request
    sina_code = ('sh' if code.startswith(('6', '9')) else 'sz') + code
    url = (f'https://vip.stock.finance.sina.com.cn/quotes_service/api/json_v2.php/'
           f'Market_Center.getHQNodeData?symbol={sina_code}&fields=symbol,code,name,trade,changepercent,pricechange,amount,turnoverratio')
    try:
        req = urllib.request.Request(url, headers={
            'User-Agent': 'Mozilla/5.0',
            'Referer': 'https://finance.sina.com.cn/',
        })
        raw = urllib.request.urlopen(req, timeout=5).read()
        if not raw or raw == b'null':
            return None
        data = json.loads(raw)
        if not data:
            return None
        result = {
            'last_price': float(data.get('trade', 0) or 0),
            'change_percent': float(data.get('changepercent', 0) or 0),
            'change_amount': float(data.get('pricechange', 0) or 0),
            'turnover': round(float(data.get('amount', 0) or 0) / 1e8, 2),  # 元 → 亿
        }
        _quote_cache[code] = (_time.time(), result)
        return result
    except Exception as e:
        log.warning(f'sina 拉 {code} 失败:{e}')
        return None


def fetch_kline_akshare(code: str, days: int = 30) -> Optional[pd.DataFrame]:
    """akshare K 线 — 仅后端用"""
    try:
        import akshare as ak
        end = datetime.now().strftime('%Y%m%d')
        start = (datetime.now() - timedelta(days=days * 2)).strftime('%Y%m%d')
        df = ak.stock_zh_a_hist(symbol=code, period='daily', start_date=start, end_date=end, adjust='qfq')
        if df is None or len(df) == 0:
            return None
        return df.tail(days).reset_index(drop=True)
    except Exception as e:
        log.warning(f'akshare K 线 {code} 失败:{e}')
        return None


# ============================================================
# API 路由
# ============================================================
@app.on_event('startup')
def on_startup():
    init_db()
    # 初始化默认分组
    with get_db() as conn:
        cur = conn.execute("SELECT COUNT(*) as c FROM watchlist_groups WHERE user_id = 'user_001'")
        if cur.fetchone()['c'] == 0:
            conn.execute("INSERT INTO watchlist_groups (group_name, sort_order) VALUES (?, ?)", ('趋势波段', 1))
            conn.execute("INSERT INTO watchlist_groups (group_name, sort_order) VALUES (?, ?)", ('超短打板', 2))
            conn.execute("INSERT INTO watchlist_groups (group_name, sort_order) VALUES (?, ?)", ('观察期', 3))
            log.info('初始化默认 3 个分组')


# === 分组 ===
@app.get('/api/watchlist/groups', response_model=List[GroupOut])
def list_groups():
    with get_db() as conn:
        rows = conn.execute('''
            SELECT g.*, (SELECT COUNT(*) FROM watchlist_stocks s WHERE s.group_id = g.id) AS stock_count
            FROM watchlist_groups g
            WHERE g.user_id = 'user_001'
            ORDER BY g.sort_order, g.id
        ''').fetchall()
    return [dict(r) for r in rows]


@app.post('/api/watchlist/groups', response_model=GroupOut)
def create_group(req: GroupCreateReq):
    with get_db() as conn:
        cur = conn.execute(
            'INSERT INTO watchlist_groups (group_name, sort_order) VALUES (?, ?)',
            (req.group_name, req.sort_order)
        )
        gid = cur.lastrowid
        row = conn.execute('SELECT * FROM watchlist_groups WHERE id = ?', (gid,)).fetchone()
    return dict(row)


@app.delete('/api/watchlist/groups/{group_id}')
def delete_group(group_id: int):
    with get_db() as conn:
        conn.execute('DELETE FROM watchlist_groups WHERE id = ? AND user_id = \'user_001\'', (group_id,))
    return {'ok': True}


# === 股票 ===
@app.post('/api/watchlist/add', response_model=StockOut)
def add_stock(req: AddStockReq):
    with get_db() as conn:
        # 校验分组
        g = conn.execute('SELECT id FROM watchlist_groups WHERE id = ? AND user_id = \'user_001\'', (req.group_id,)).fetchone()
        if not g:
            raise HTTPException(404, '分组不存在')
        try:
            cur = conn.execute(
                'INSERT INTO watchlist_stocks (group_id, stock_code, stock_name) VALUES (?, ?, ?)',
                (req.group_id, req.stock_code, req.stock_name)
            )
            sid = cur.lastrowid
        except sqlite3.IntegrityError:
            raise HTTPException(409, f'{req.stock_name}({req.stock_code}) 已在该分组中')
        row = conn.execute('SELECT * FROM watchlist_stocks WHERE id = ?', (sid,)).fetchone()
    out = dict(row)
    out.update(fetch_quote_sina(req.stock_code) or {})
    return out


@app.delete('/api/watchlist/stocks/{stock_id}')
def remove_stock(stock_id: int):
    with get_db() as conn:
        conn.execute('DELETE FROM watchlist_stocks WHERE id = ?', (stock_id,))
    return {'ok': True}


@app.get('/api/watchlist/{group_id}', response_model=List[StockOut])
def list_stocks(group_id: int):
    with get_db() as conn:
        rows = conn.execute('''
            SELECT s.* FROM watchlist_stocks s
            WHERE s.group_id = ?
            ORDER BY s.status_color DESC, s.added_at DESC
        ''', (group_id,)).fetchall()
    out = []
    for r in rows:
        d = dict(r)
        d.update(fetch_quote_sina(r['stock_code']) or {})
        out.append(d)
    return out


# === 笔记 ===
@app.post('/api/notes/create', response_model=NoteOut)
def create_note(req: NoteCreateReq):
    # 校验 buy_logic_tags(必须是预设 4 个之一)
    ALLOWED_TAGS = {'板块联动', '技术突破', '资金流入', '消息利好'}
    invalid = set(req.buy_logic_tags) - ALLOWED_TAGS
    if invalid:
        raise HTTPException(400, f'无效标签:{invalid},只允许 {ALLOWED_TAGS}')
    with get_db() as conn:
        cur = conn.execute('''
            INSERT INTO trading_notes
            (stock_code, note_date, buy_logic_tags, target_price, stop_loss_price, emotion_tag, note_text, linked_group_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ''', (req.stock_code, req.note_date, json.dumps(req.buy_logic_tags, ensure_ascii=False),
              req.target_price, req.stop_loss_price, req.emotion_tag, req.note_text, req.linked_group_id))
        nid = cur.lastrowid
        row = conn.execute('SELECT * FROM trading_notes WHERE id = ?', (nid,)).fetchone()
    out = dict(row)
    out['buy_logic_tags'] = json.loads(out['buy_logic_tags'])
    return out


@app.get('/api/notes/{stock_code}', response_model=List[NoteOut])
def list_notes(stock_code: str):
    with get_db() as conn:
        rows = conn.execute('''
            SELECT * FROM trading_notes
            WHERE stock_code = ?
            ORDER BY note_date DESC, id DESC
        ''', (stock_code,)).fetchall()
    out = []
    for r in rows:
        d = dict(r)
        d['buy_logic_tags'] = json.loads(d['buy_logic_tags'])
        out.append(d)
    return out


@app.delete('/api/notes/{note_id}')
def delete_note(note_id: int):
    with get_db() as conn:
        conn.execute('DELETE FROM trading_notes WHERE id = ?', (note_id,))
    return {'ok': True}


# === 异动检查(核心) ===
@app.post('/api/watchlist/alerts/run')
def run_alerts_check():
    """盘后跑批:遍历所有自选股,检查放量/突破,更新 status_color='red'"""
    now = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    alerts = []
    with get_db() as conn:
        stocks = conn.execute('SELECT * FROM watchlist_stocks').fetchall()
        log.info(f'开始跑批,共 {len(stocks)} 只自选股')
        for s in stocks:
            code = s['stock_code']
            df = fetch_kline_akshare(code, days=30)
            if df is None or len(df) < 6:
                log.warning(f'{code} K 线数据不足,跳过')
                continue
            try:
                # 今日数据(最后一行)
                today = df.iloc[-1]
                today_vol = float(today['成交量'])
                today_close = float(today['收盘'])
                # 过去 5 日均量
                hist_5d = df.iloc[:-1].tail(5)
                avg_vol_5 = hist_5d['成交量'].mean()
                # 过去 20 日最高价
                high_20d = df.iloc[:-1].tail(20)['最高'].max() if len(df) > 21 else df['最高'].max()
            except Exception as e:
                log.warning(f'{code} 计算指标失败:{e}')
                continue

            reasons = []
            is_alert = False

            # 条件 1:放量(今日量 > 5 日均量 * 1.5)
            if avg_vol_5 > 0 and today_vol > avg_vol_5 * 1.5:
                is_alert = True
                ratio = round(today_vol / avg_vol_5, 2)
                reasons.append(f'放量{ratio}倍')

            # 条件 2:突破 20 日新高
            if today_close > high_20d:
                is_alert = True
                pct = round((today_close - high_20d) / high_20d * 100, 2)
                reasons.append(f'突破20日高{pct}%')

            if is_alert:
                status_note = ' / '.join(reasons)
                conn.execute('''
                    UPDATE watchlist_stocks
                    SET status_color = 'red', status_note = ?, status_updated = ?
                    WHERE id = ?
                ''', (status_note, now, s['id']))
                alerts.append({
                    'stock_code': code,
                    'stock_name': s['stock_name'],
                    'group_id': s['group_id'],
                    'reasons': reasons,
                    'today_close': today_close,
                    'today_vol_ratio': round(today_vol / avg_vol_5, 2) if avg_vol_5 > 0 else None,
                    'change_percent': float(today.get('涨跌幅', 0)),
                })
            else:
                # 没异动,绿色或灰色
                conn.execute('''
                    UPDATE watchlist_stocks
                    SET status_color = 'gray', status_note = NULL, status_updated = ?
                    WHERE id = ? AND status_color IN ('red', 'yellow')
                ''', (now, s['id']))
    return {'alerts': alerts, 'count': len(alerts), 'checked_at': now}


# === 健康检查 ===
@app.get('/health')
def health():
    return {'status': 'ok', 'time': datetime.now().isoformat()}


if __name__ == '__main__':
    import uvicorn
    init_db()
    uvicorn.run('backend.api.watchlist:app', host='0.0.0.0', port=8000, reload=True)
