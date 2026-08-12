"""
市场情绪温度计算法 — v2.0.7r
根据全市场 5 个维度加权计算 0-100 情绪温度,用于左侧栏底部展示。

5 维度:
1. 涨跌停对比(30%) — 涨停/跌停比例
2. 连板高度(20%) — 最高连板数
3. 炸板率(20%) — 炸板/(涨停+炸板)
4. 昨日涨停今日表现(20%) — 昨日涨停股今日平均涨幅
5. 晋级率(10%) — 今日N板/昨日(N-1)板

基础分 50,加权后限制 0-100,再映射状态标签。
"""

# 维度权重(总和 1.0)
WEIGHTS = {
    'limit_ratio': 0.30,      # 涨跌停对比
    'max_boards':  0.20,      # 连板高度
    'broken_rate': 0.20,      # 炸板率
    'yest_perf':   0.20,      # 昨日涨停今日表现
    'promote_rate': 0.10,     # 晋级率
}

BASE_SCORE = 50

# 状态标签区间
STATUS_MAP = [
    (20,  '绝对冰点',  '退潮末期,试错期'),
    (40,  '低温分歧',  '情绪修复,接力谨慎'),
    (60,  '常温震荡',  '无明显主线,轮动快'),
    (80,  '高温一致',  '主升浪,赚钱效应强'),
    (100, '极度沸点',  '高潮,随时面临退潮分歧'),
]


def calculate_market_temperature(data: dict) -> dict:
    """
    5 维度加权计算 0-100 情绪温度。
    输入字段:limit_up_count, limit_down_count, max_consecutive_boards,
            broken_limit_count, yesterday_limit_avg_change(可空),
            yesterday_n1_count(可空), today_n2_count(可空)
    输出:temperature, status, details
    """
    score = float(BASE_SCORE)

    # ===== 1. 涨跌停对比(30%)— 范围 [-15, +15] =====
    limit_up = max(0, int(data.get('limit_up_count') or 0))
    limit_down = max(0, int(data.get('limit_down_count') or 0))
    ratio = limit_up / max(limit_down, 1)
    if ratio > 10:
        s1, s1_label = 15, '涨停远多于跌停'
    elif ratio > 5:
        s1, s1_label = 10, '涨停较多'
    elif ratio > 2:
        s1, s1_label = 5, '涨停略多'
    elif ratio >= 1:
        s1, s1_label = 0, '涨/跌停相当'
    else:
        s1, s1_label = -15, '跌停多于涨停'
    score += s1 * WEIGHTS['limit_ratio']

    # ===== 2. 连板高度(20%)— 范围 [-10, +10] =====
    boards = max(0, int(data.get('max_consecutive_boards') or 0))
    if boards >= 7:
        s2, s2_label = 10, f'{boards}板高标'
    elif boards >= 5:
        s2, s2_label = 8, f'{boards}板高度'
    elif boards >= 4:
        s2, s2_label = 5, f'{boards}板空间'
    elif boards >= 3:
        s2, s2_label = 0, f'{boards}板一般'
    else:
        s2, s2_label = -10, f'{boards}板以下,无高度'
    score += s2 * WEIGHTS['max_boards']

    # ===== 3. 炸板率(20%)— 范围 [-10, +10] =====
    broken = max(0, int(data.get('broken_limit_count') or 0))
    if limit_up + broken == 0:
        broken_rate = 0
        s3, s3_label = 0, '无数据'
    else:
        broken_rate = broken / (limit_up + broken)
        if broken_rate < 0.15:
            s3, s3_label = 10, '炸板率极低'
        elif broken_rate < 0.30:
            s3, s3_label = 5, '炸板率正常'
        elif broken_rate < 0.50:
            s3, s3_label = -5, '炸板率偏高'
        else:
            s3, s3_label = -10, '炸板率爆表'
    score += s3 * WEIGHTS['broken_rate']

    # ===== 4. 昨日涨停今日表现(20%)— 范围 [-10, +10] =====
    avg = float(data.get('yesterday_limit_avg_change') or 0)
    if avg != 0 or data.get('yesterday_limit_avg_change') is not None:
        if avg > 3:
            s4, s4_label = 10, f'昨日涨停今日+{avg:.1f}%'
        elif avg > 0:
            s4, s4_label = 5, f'昨日涨停今日+{avg:.1f}%'
        elif avg > -2:
            s4, s4_label = -5, f'昨日涨停今日{avg:.1f}%'
        else:
            s4, s4_label = -10, f'昨日涨停今日{avg:.1f}%'
    else:
        # 数据缺失 — 用 0 分(中性)
        s4, s4_label = 0, '无数据'
    score += s4 * WEIGHTS['yest_perf']

    # ===== 5. 晋级率(10%)— 范围 [-5, +5] =====
    yest_n1 = max(0, int(data.get('yesterday_n1_count') or 0))
    today_n2 = max(0, int(data.get('today_n2_count') or 0))
    if yest_n1 > 0:
        promote_rate = today_n2 / yest_n1
        if promote_rate > 0.5:
            s5, s5_label = 5, f'晋级率{promote_rate*100:.0f}%'
        elif promote_rate > 0.3:
            s5, s5_label = 2, f'晋级率{promote_rate*100:.0f}%'
        else:
            s5, s5_label = -5, f'晋级率{promote_rate*100:.0f}%'
    else:
        promote_rate = 0
        s5, s5_label = 0, '无昨日首板数据'
    score += s5 * WEIGHTS['promote_rate']

    # 限制 0-100
    final = max(0, min(100, int(round(score))))

    # 状态标签
    status, status_desc = '常温震荡', '中性'
    for threshold, name, desc in STATUS_MAP:
        if final <= threshold:
            status, status_desc = name, desc
            break

    return {
        'temperature': final,
        'status': status,
        'statusDesc': status_desc,
        'details': {
            'limit_up': limit_up,
            'limit_down': limit_down,
            'max_boards': boards,
            'broken_rate': f'{broken_rate*100:.0f}%',
            'yest_perf': s4_label,
            'promote_rate': s5_label,
        },
        'dimension_scores': {
            '涨跌停对比': s1,
            '连板高度': s2,
            '炸板率': s3,
            '昨日涨停今日': s4,
            '晋级率': s5,
        },
    }


# ============================================================
# CLI 测试
# ============================================================
if __name__ == '__main__':
    import json
    test_data = {
        'limit_up_count': 60,
        'limit_down_count': 5,
        'max_consecutive_boards': 5,
        'broken_limit_count': 10,
        'yesterday_limit_avg_change': 2.5,
        'yesterday_n1_count': 15,
        'today_n2_count': 4,
    }
    result = calculate_market_temperature(test_data)
    print(json.dumps(result, ensure_ascii=False, indent=2))
