"""v2.0.7cv:fetch-data.yml 降级用 — 拉 HEAD data.json 标记 _fetchError"""
import json, subprocess, os, sys
from datetime import datetime, timedelta

OUT = 'public/data.json'
prev = subprocess.run(['git', 'show', f'HEAD:{OUT}'], capture_output=True, timeout=10)
if prev.returncode != 0 or len(prev.stdout) == 0:
    print(f"降级失败:git show 拿不到 HEAD {OUT}")
    sys.exit(1)

data = json.loads(prev.stdout.decode('utf-8'))
now = datetime.utcnow() + timedelta(hours=8)
trade_date = now.strftime('%Y%m%d')
data['_fetchError'] = f"{trade_date} fetch 失败,已降级用上一交易日 + 标记"
data['_fetchTimeIso'] = now.strftime('%Y-%m-%d %H:%M:%S')
os.makedirs(os.path.dirname(OUT), exist_ok=True)
with open(OUT, 'w', encoding='utf-8') as f:
    json.dump(data, f, ensure_ascii=False, indent=2)
print(f"降级 {OUT} 已写入(带 _fetchError 标记,actions 一定能 commit → 跨日不卡死)")
