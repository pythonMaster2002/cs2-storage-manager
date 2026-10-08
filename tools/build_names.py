"""Справочник названий предметов CS2 для Game Coordinator (у GC есть только числовые id).

Источник — открытый CSGO-API (github.com/ByMykel/CSGO-API). Результат — data/names.json:
  "def:<def_index>"              — предметы без раскраски (кейсы, ключи, агенты, значки, брелоки...)
  "skin:<def_index>:<paint>"     — скины (без качества — оно считается по paint_wear)
  "sticker:<sticker_id>"         — наклейки
Запуск (раз в несколько месяцев, при выходе новых предметов): python3 tools/build_names.py
"""
import json
import os
import urllib.request

BASE = 'https://raw.githubusercontent.com/ByMykel/CSGO-API/main/public/api/en/'
OUT = os.path.join(os.path.dirname(__file__), "..", "src", "data", 'names.json')
OUT_IMAGES = os.path.join(os.path.dirname(__file__), "..", "src", "data", 'images.json')  # те же ключи -> картинка Steam CDN
CDN = 'https://community.akamai.steamstatic.com/economy/image/'


def load(name):
    with urllib.request.urlopen(BASE + name, timeout=120) as r:
        return json.load(r)


names = {}
images = {}


def image(key, item):
    url = item.get('image') or ''
    if url.startswith(CDN) and key not in images:
        images[key] = url[len(CDN):]  # храним только хвост — так файл в разы меньше


for file in ('crates.json', 'keys.json', 'agents.json', 'collectibles.json', 'keychains.json', 'base_weapons.json',
             'music_kits.json', 'patches.json', 'graffiti.json'):
    try:
        data = load(file)
    except Exception as e:
        print('пропуск', file, e)
        continue
    for item in data:
        d = item.get('def_index')
        if d and item.get('name') and f'def:{d}' not in names:
            names[f'def:{d}'] = item.get('market_hash_name') or item['name']
        if d:
            image(f'def:{d}', item)

for item in load('skins_not_grouped.json'):
    weapon, paint = (item.get('weapon') or {}).get('weapon_id'), item.get('paint_index')
    if weapon and paint is not None:
        # «AK-47 | Redline» без качества и без StatTrak — их добавляет приложение.
        base = item['name']
        for prefix in ('StatTrak™ ', 'Souvenir '):
            base = base.replace(prefix, '')
        if '(' in base:
            base = base[:base.rindex('(')].strip()
        names.setdefault(f'skin:{weapon}:{paint}', base)
        image(f'skin:{weapon}:{paint}', item)

for item in load('stickers.json'):
    sid = str(item.get('id', '')).replace('sticker-', '')
    if sid.isdigit():
        names[f'sticker:{sid}'] = item.get('market_hash_name') or item['name']
        image(f'sticker:{sid}', item)

os.makedirs(os.path.dirname(OUT), exist_ok=True)
with open(OUT, 'w', encoding='utf-8') as f:
    json.dump(names, f, ensure_ascii=False, separators=(',', ':'))
with open(OUT_IMAGES, 'w', encoding='utf-8') as f:
    json.dump({'cdn': CDN, 'images': images}, f, separators=(',', ':'))
print('записано', len(names), 'названий,', len(images), 'картинок')
