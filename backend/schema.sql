-- ============================================================
-- 天机枢【自选监控 & 笔记】数据库 — SQLite 3 表
-- 文件:backend/schema.sql
-- 执行:sqlite3 data/tianjishu.db < backend/schema.sql
-- ============================================================

-- 表 1:自选股分组
CREATE TABLE IF NOT EXISTS watchlist_groups (
  id              INTEGER  PRIMARY KEY AUTOINCREMENT,
  user_id         TEXT     NOT NULL DEFAULT 'user_001',
  group_name      TEXT     NOT NULL,
  sort_order      INTEGER  NOT NULL DEFAULT 0,
  created_at      TEXT     NOT NULL DEFAULT (datetime('now', 'localtime')),
  updated_at      TEXT     NOT NULL DEFAULT (datetime('now', 'localtime'))
);

CREATE INDEX IF NOT EXISTS idx_watchlist_groups_user
  ON watchlist_groups(user_id, sort_order);

-- 表 2:组内股票 + 状态色
-- status_color: green(符合预期) / red(异动预警) / yellow(关注) / gray(无风起浪)
CREATE TABLE IF NOT EXISTS watchlist_stocks (
  id              INTEGER  PRIMARY KEY AUTOINCREMENT,
  group_id        INTEGER  NOT NULL,
  stock_code      TEXT     NOT NULL,
  stock_name      TEXT     NOT NULL,
  added_at        TEXT     NOT NULL DEFAULT (datetime('now', 'localtime')),
  status_color    TEXT     NOT NULL DEFAULT 'gray',
  status_note     TEXT,                          -- 异动原因/状态说明
  status_updated  TEXT,                          -- 状态最近一次更新时间
  UNIQUE(group_id, stock_code),
  FOREIGN KEY (group_id) REFERENCES watchlist_groups(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_watchlist_stocks_group
  ON watchlist_stocks(group_id, status_color);

CREATE INDEX IF NOT EXISTS idx_watchlist_stocks_code
  ON watchlist_stocks(stock_code);

-- 表 3:结构化交易笔记
-- buy_logic_tags:JSON 数组 — 板块联动/技术突破/资金流入/消息利好
-- emotion_tag:确定性高 / 犹豫不决 / 随意试错
CREATE TABLE IF NOT EXISTS trading_notes (
  id                INTEGER  PRIMARY KEY AUTOINCREMENT,
  stock_code        TEXT     NOT NULL,
  note_date         TEXT     NOT NULL,           -- YYYY-MM-DD
  buy_logic_tags    TEXT     NOT NULL,           -- JSON 数组
  target_price      REAL,
  stop_loss_price   REAL,
  emotion_tag       TEXT     NOT NULL,
  note_text         TEXT     NOT NULL DEFAULT '',
  linked_group_id   INTEGER,                    -- 关联的自选分组(可空)
  created_at        TEXT     NOT NULL DEFAULT (datetime('now', 'localtime')),
  updated_at        TEXT     NOT NULL DEFAULT (datetime('now', 'localtime'))
);

CREATE INDEX IF NOT EXISTS idx_trading_notes_code_date
  ON trading_notes(stock_code, note_date DESC);

CREATE INDEX IF NOT EXISTS idx_trading_notes_date
  ON trading_notes(note_date DESC);
