#!/usr/bin/env python3
"""
يحوّل شيت أسعار شركة الشحن (Excel) لملف data/shipping.json اللي الموقع بيقرأ منه.

الاستخدام:
    pip install openpyxl
    python3 scripts/import_shipping.py "Price_List.xlsx"

الشيت لازم يكون فيه الأعمدة دي بالترتيب: الاسم (المنطقة) | المدينة (المحافظة) | تكلفة الشحن | ...
"""
import json
import re
import sys
from collections import Counter
from pathlib import Path

import openpyxl

OUT = Path(__file__).resolve().parent.parent / 'data' / 'shipping.json'

ORDER = [
    'القاهرة', 'الجيزة', 'الإسكندرية', 'القليوبية', 'الشرقية', 'الدقهلية', 'الغربية',
    'المنوفية', 'البحيرة', 'كفر الشيخ', 'دمياط', 'بورسعيد', 'الإسماعيلية', 'السويس',
    'الفيوم', 'بني سويف', 'المنيا', 'أسيوط', 'سوهاج', 'قنا', 'الأقصر', 'أسوان',
    'البحر الأحمر', 'الوادي الجديد', 'مطروح', 'شمال سيناء', 'جنوب سيناء',
]

# الشيت فيه مجموعات مش محافظات، فبنوزّع مناطقها على المحافظة الصح عشان العميل يلاقيها
ZONE_TO_GOV = {
    'المدن الجديدة': {
        'الرحاب': 'القاهرة', 'السلام': 'القاهرة', 'الشروق': 'القاهرة', 'القاهرة الجديدة': 'القاهرة',
        'القطامية': 'القاهرة', 'المرج': 'القاهرة', 'حلوان': 'القاهرة', 'مدينتي': 'القاهرة',
        '6 اكتوبر': 'الجيزة', 'الشيخ زايد': 'الجيزة', 'ابو رواش': 'الجيزة',
    },
    'أطراف القاهرة والجيزة': {
        '15 مايو': 'القاهرة', 'التبين': 'القاهرة', 'العاصمة الادارية': 'القاهرة', 'بدر': 'القاهرة',
        'أطفيح': 'الجيزة', 'الحوامدية': 'الجيزة', 'أبو النمرس': 'الجيزة', 'كرداسة': 'الجيزة',
        'أوسيم': 'الجيزة', 'البدرشين': 'الجيزة', 'العياط': 'الجيزة', 'الصف': 'الجيزة',
        'منشية القناطر': 'الجيزة',
        'أطراف': None,  # سعر عام للأطراف، بيتحط كمنطقة "أطراف تانية" في القاهرة والجيزة
    },
}

RENAME = {'دار السلام سوهاج': 'دار السلام', 'المطرية - الدقهلية': 'المطرية', 'الاسماعيلية': 'الإسماعيلية (المدينة)'}


def clean(s):
    s = str(s or '').replace('\xa0', ' ').replace('ـ', '')
    return re.sub(r'\s+', ' ', s).strip()


def main(xlsx):
    ws = openpyxl.load_workbook(xlsx, data_only=True).worksheets[0]
    govs = {}
    unknown = set()
    for i, row in enumerate(ws.iter_rows(values_only=True)):
        if i == 0 or not row or row[0] is None:
            continue
        area, group, price = clean(row[0]), clean(row[1]), row[2]
        if not area or not isinstance(price, (int, float)):
            continue
        area = RENAME.get(area, area)
        targets = []
        if group in ZONE_TO_GOV:
            if area not in ZONE_TO_GOV[group]:
                unknown.add(f'{group} / {area}')
                continue
            g = ZONE_TO_GOV[group][area]
            if g is None:
                targets = [('القاهرة', 'أطراف تانية'), ('الجيزة', 'أطراف تانية')]
            else:
                targets = [(g, area)]
        elif group in ORDER:
            targets = [(group, area)]
        else:
            unknown.add(group)
            continue
        for g, a in targets:
            govs.setdefault(g, {})[a] = int(price)

    out = {'_note': 'اتعمل أوتوماتيك من شيت شركة الشحن بـ scripts/import_shipping.py — ما تعدلوش بإيدك، عدّل الشيت وشغّل السكريبت تاني.',
           'source': Path(xlsx).name, 'governorates': {}}
    for g in [g for g in ORDER if g in govs]:
        areas = govs[g]
        # السعر الأساسي للمحافظة = أكتر سعر متكرر فيها (بيتطبق لو العميل اختار "منطقة تانية")
        default = Counter(areas.values()).most_common(1)[0][0]
        out['governorates'][g] = {'default': default, 'areas': dict(sorted(areas.items(), key=lambda kv: kv[0]))}

    OUT.write_text(json.dumps(out, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(f'✓ اتكتب {OUT} — {len(out["governorates"])} محافظة، {sum(len(v["areas"]) for v in out["governorates"].values())} منطقة')
    missing = [g for g in ORDER if g not in govs]
    if missing:
        print('⚠️ محافظات مش موجودة في الشيت (مش هتظهر للعميل):', '، '.join(missing))
    if unknown:
        print('⚠️ صفوف ما اتعرفش مكانها (اتجاهلت):', '، '.join(sorted(unknown)))


if __name__ == '__main__':
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    main(sys.argv[1])
