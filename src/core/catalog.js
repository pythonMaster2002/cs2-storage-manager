// Карты имён и иконок предметов. Чтобы магазин и иконки обновлялись САМИ (без пересборки приложения):
//   • при старте грузим карты из пользовательского кэша, если он есть; иначе — из комплекта;
//   • в фоне скачиваем свежие карты того же формата и кладём в кэш — их подхватит следующий запуск.
// Источник задаётся в src/data/catalog-source.json (dataUrl). Пусто — работаем только на встроенных картах.
'use strict';

const fs = require('fs');
const path = require('path');
const https = require('https');

const BUNDLED = path.join(__dirname, '..', 'data');
const FILES = ['images.json', 'names.json', 'store_defs.json', 'nonstorable_defs.json', 'support.json'];

function cacheDir() { return process.env.CASKET_DATA_CACHE || null; }

// Загрузка карты: сначала из кэша (если валиден и непустой), иначе из комплекта.
function loadMap(name) {
	for (const dir of [cacheDir(), BUNDLED]) {
		if (!dir) continue;
		try {
			const j = JSON.parse(fs.readFileSync(path.join(dir, name), 'utf8'));
			if (j && (Array.isArray(j) ? j.length : Object.keys(j).length)) return j;
		} catch (e) { /* пробуем следующий источник */ }
	}
	return Array.isArray(name) ? [] : {};
}

function sourceUrl() {
	try { return (JSON.parse(fs.readFileSync(path.join(BUNDLED, 'catalog-source.json'), 'utf8')).dataUrl || '').trim(); }
	catch (e) { return ''; }
}

function getJSON(url, timeout = 25000) {
	return new Promise((resolve, reject) => {
		const req = https.get(url, { headers: { 'User-Agent': 'Caskit' } }, res => {
			if (res.statusCode !== 200) { res.resume(); return reject(new Error('HTTP ' + res.statusCode)); }
			let d = ''; res.on('data', c => d += c); res.on('end', () => { try { resolve(JSON.parse(d)); } catch (e) { reject(e); } });
		});
		req.on('error', reject);
		req.setTimeout(timeout, () => req.destroy(new Error('timeout')));
	});
}

// Фоновое обновление кэша карт. Безопасно: при любой ошибке оставляем прежние файлы.
// Качаем не чаще раза в сутки (отметка .stamp).
async function refresh() {
	const dir = cacheDir();
	const url = sourceUrl();
	if (!dir || !url) return { updated: [] };
	try {
		const stamp = path.join(dir, '.stamp');
		if (fs.existsSync(stamp) && Date.now() - fs.statSync(stamp).mtimeMs < 24 * 3600e3) return { updated: [], fresh: true };
	} catch (e) { /* ignore */ }
	fs.mkdirSync(dir, { recursive: true });
	const base = url.replace(/\/$/, '');
	const updated = [];
	for (const name of FILES) {
		try {
			const j = await getJSON(`${base}/${name}`);
			if (j && (Array.isArray(j) ? j.length : Object.keys(j).length)) {
				fs.writeFileSync(path.join(dir, name + '.tmp'), JSON.stringify(j));
				fs.renameSync(path.join(dir, name + '.tmp'), path.join(dir, name));
				updated.push(name);
			}
		} catch (e) { /* оставляем встроенную/прежнюю версию этого файла */ }
	}
	try { fs.writeFileSync(path.join(dir, '.stamp'), String(Date.now())); } catch (e) { /* ignore */ }
	return { updated };
}

// ---------------------------------------------------------------- метаданные магазина CS2
// Товары приходят живьём из прайса GC (item_link + цены). Названия и картинки GC не присылает — берём их
// из файлов самой игры: items_game.txt (item_link -> def_index, токен названия, путь иконки) и
// csgo_english.txt (токен -> английское название), а путь иконки -> картинка на CDN Steam (images.json).
// Источники — публичные зеркала файлов игры; качаем раз в сутки в кэш, без участия аккаунта.
const META_SOURCES = {
	itemsGame: 'https://raw.githubusercontent.com/SteamDatabase/GameTracking-CS2/master/game/csgo/pak01_dir/scripts/items/items_game.txt',
	english: 'https://raw.githubusercontent.com/SteamDatabase/GameTracking-CS2/master/game/csgo/pak01_dir/resource/csgo_english.txt',
	images: 'https://raw.githubusercontent.com/ByMykel/counter-strike-image-tracker/main/static/images.json',
};
const META_FILE = 'store_meta.json';
// Версия алгоритма сборки: кэш, собранный старым кодом (например, с «конвертами» вместо картинок),
// игнорируется и пересобирается сразу, не дожидаясь суточного обновления.
const META_VERSION = 4;

function getText(url, timeout = 60000) {
	return new Promise((resolve, reject) => {
		const req = https.get(url, { headers: { 'User-Agent': 'Caskit' } }, res => {
			if (res.statusCode !== 200) { res.resume(); return reject(new Error('HTTP ' + res.statusCode)); }
			const chunks = []; res.on('data', c => chunks.push(c)); res.on('end', () => resolve(Buffer.concat(chunks)));
		});
		req.on('error', reject);
		req.setTimeout(timeout, () => req.destroy(new Error('timeout')));
	});
}

function decodeText(buf) {
	if (buf[0] === 0xff && buf[1] === 0xfe) return buf.slice(2).toString('utf16le');
	return buf.toString('utf8').replace(/^﻿/, '');
}

// Минимальный парсер текстового KeyValues (VDF): { "key" "value" | "key" { ... } }.
function parseVDF(text) {
	const re = /"((?:[^"\\]|\\.)*)"|([{}])|\/\/[^\n]*/g;
	const root = {}; const stack = [root]; let key = null; let m;
	while ((m = re.exec(text))) {
		if (m[2] === '{') {
			const top = stack[stack.length - 1];
			const k = key == null ? '' : key;
			if (!top[k] || typeof top[k] !== 'object') top[k] = {};  // повторный блок с тем же ключом — сливаем
			const fresh = {};
			// Повторяющиеся блоки (operational_point_redeemable и т.п.) дополнительно сохраняем списком по порядку.
			(top[`_list_${k}`] = top[`_list_${k}`] || []).push(fresh);
			stack.push(new Proxy(top[k], { set(t, kk, v) { t[kk] = v; fresh[kk] = v; return true; } })); key = null;
		}
		else if (m[2] === '}') { stack.pop(); key = null; }
		else if (m[1] !== undefined) {
			if (key == null) key = m[1];
			else { stack[stack.length - 1][key] = m[1]; key = null; }  // как в игре: позднее определение побеждает
		}
	}
	return root;
}

function parseLocalization(text) {
	const map = {};
	for (const m of text.matchAll(/^\s*"([^"]+)"\s+"((?:[^"\\]|\\.)*)"/gm)) map[m[1].toLowerCase()] = m[2].replace(/\\"/g, '"').replace(/\\n/g, ' ');
	return map;
}

// Из файлов игры -> { links: {item_link|name: def}, defs: {def: {name, image}} }.
function buildStoreMeta(itemsGameText, englishText, imagesMap) {
	const ig = parseVDF(itemsGameText).items_game || {};
	const loc = parseLocalization(englishText);
	const prefabs = ig.prefabs || {};
	const items = ig.items || {};
	const field = (def, k, depth = 0) => {
		if (!def || depth > 8) return undefined;
		if (def[k] != null) return def[k];
		for (const p of String(def.prefab || '').split(/\s+/).filter(Boolean)) { const v = field(prefabs[p], k, depth + 1); if (v != null) return v; }
		return undefined;
	};
	const tr = tok => tok ? (loc[String(tok).replace(/^#/, '').toLowerCase()] || null) : null;
	const links = {}, defs = {};
	// Купоны (наклейки, граффити, музыка) имеют общую иконку-«конверт» econ/coupon/offer — берём иконку
	// того, что внутри купона: loot list -> [имя]тип -> набор (sticker_kits / music_definitions / keychains).
	const byName = sec => { const m = {}; for (const v of Object.values(ig[sec] || {})) if (v && v.name) m[v.name] = v; return m; };
	const kits = byName('sticker_kits'), music = byName('music_definitions'), charms = byName('keychain_definitions');
	const lootLists = ig.client_loot_lists || {};
	const img = path => path ? (imagesMap[path] || imagesMap[String(path).toLowerCase()] || null) : null;
	// Предмет по внутреннему имени (crate_sprays_illuminate1 и т.п.) -> его собственная картинка.
	const itemsByName = {};
	for (const d of Object.values(items)) if (d && typeof d === 'object' && d.name) itemsByName[d.name] = d;
	const fromItem = name => { const d = itemsByName[name]; const p = d && field(d, 'image_inventory'); return p && !/^econ\/coupon\//.test(p) ? img(p) : null; };
	// Купон капсулы/бокса -> иконка самого контейнера (econ/weapon_cases/crate_…) по ключевым словам названия.
	const cases = Object.keys(imagesMap).filter(k => k.startsWith('econ/weapon_cases/'));
	const STOP = new Set(['sticker', 'capsule', 'pack', 'crate', 'coupon', 'box']);
	const fromCrateName = suffix => {
		const tokens = suffix.toLowerCase().split('_').filter(t => t && !STOP.has(t));
		if (!tokens.length) return null;
		const hits = cases.filter(k => { const parts = k.slice(18).split('_'); return tokens.every(t => parts.includes(t) || k.includes(`_${t}`)); })
			.filter(k => tokens.includes('stattrak') || !k.includes('stattrak'))
			.sort((a, b) => a.length - b.length);
		return hits.length ? imagesMap[hits[0]] : null;
	};
	const fromLoot = (listName, depth = 0) => {
		const list = lootLists[listName];
		if (!list || depth > 3) return null;
		for (const key of Object.keys(list)) {
			const m = key.match(/^\[(.+?)\](\w+)$/);
			if (!m) { const nested = fromItem(key) || fromLoot(key, depth + 1); if (nested) return nested; continue; }
			const [, name, kind] = m;
			let found = null;
			if (kind === 'musickit' && music[name]) found = img(music[name].image_inventory);
			else if (kind === 'keychain' && charms[name]) found = img(charms[name].image_inventory) || img(`econ/keychains/${name}/kc_${name}`);
			else if (kits[name]) {
				const mat = kits[name].sticker_material || kits[name].patch_material;
				found = img(`econ/stickers/${mat}`) || img(`econ/patches/${mat}`) || img(`econ/stickers/${mat}_large`);
			}
			if (found) return found;
		}
		return null;
	};
	for (const [id, def] of Object.entries(items)) {
		if (!/^\d+$/.test(id) || !def || typeof def !== 'object') continue;
		if (def.name) links[def.name] = Number(id);
		// Слэбы/брелоки-инструменты имеют общий токен «Charm» — точное имя лежит под keychain_kc_<name>.
		let name = tr(`keychain_kc_${def.name}`) || tr(field(def, 'item_name'));
		// Купон музыкального набора без своей строки локализации: «StatTrak™ Music Kit | <набор>».
		const kit = !name && String(def.name || '').match(/^coupon - (.+?)(_stattrak)?$/);
		if (kit && tr(`musickit_${kit[1]}`)) name = `${kit[2] ? 'StatTrak™ ' : ''}Music Kit | ${tr(`musickit_${kit[1]}`)}`;
		const invImg = field(def, 'image_inventory');
		const generic = /^econ\/coupon\//.test(invImg || '');
		let image = (!generic && img(invImg)) || img(`econ/tools/${def.name}`) || img(`econ/keychains/${def.name}/kc_${def.name}`) || null;
		let envelope = false;
		if (!image || generic) {
			const loot = field(def, 'loot_list_name');
			const coupon = String(def.name || '').match(/^coupon - (.+)$/);
			const real = (loot ? fromLoot(loot) : null) || (coupon ? fromItem(coupon[1]) || fromCrateName(coupon[1]) : null);
			if (real) image = real;
			else { envelope = true; image = image || img(invImg); }
		}
		if (name || image) defs[id] = envelope ? { name, image, generic: true } : { name, image };
	}
	return { v: META_VERSION, built: Date.now(), links, defs, armory: buildArmory(ig, tr, links, defs, imagesMap), tradeup: buildTradeUp(ig, tr) };
}

// Контракты обмена: для каждого скина ("def:paint") — коллекция, редкость в ней и диапазон float.
// Коллекции — item_sets; редкость — из списков client_loot_lists вида <набор>_<редкость>;
// диапазон float — wear_remap_min/max набора краски (по умолчанию — как у paint kit 0).
const RARITY_BY_SUFFIX = { common: 1, uncommon: 2, rare: 3, mythical: 4, legendary: 5, ancient: 6 };
function buildTradeUp(ig, tr) {
	const weaponDef = {};
	for (const [id, d] of Object.entries(ig.items || {})) if (/^\d+$/.test(id) && d && /^weapon_/.test(d.name || '')) weaponDef[d.name] = Number(id);
	const kits = ig.paint_kits || {};
	const base = kits['0'] || {};
	const kitByName = {};
	for (const [id, k] of Object.entries(kits)) {
		if (!/^\d+$/.test(id) || !k || !k.name) continue;
		kitByName[k.name] = { id: Number(id), min: Number(k.wear_remap_min ?? base.wear_remap_min ?? 0.06), max: Number(k.wear_remap_max ?? base.wear_remap_max ?? 0.8) };
	}
	const rarity = {};
	for (const [list, entries] of Object.entries(ig.client_loot_lists || {})) {
		const m = list.match(/_(common|uncommon|rare|mythical|legendary|ancient)$/);
		if (!m || !entries || typeof entries !== 'object') continue;
		for (const key of Object.keys(entries)) if (key.startsWith('[') && !(key in rarity)) rarity[key] = RARITY_BY_SUFFIX[m[1]];
	}
	const sets = [], skins = {};
	for (const [setKey, set] of Object.entries(ig.item_sets || {})) {
		if (!set || !set.items || typeof set.items !== 'object') continue;
		let idx = -1;
		for (const key of Object.keys(set.items)) {
			const m = key.match(/^\[(.+)\](weapon_\w+)$/);
			const kit = m && kitByName[m[1]], def = m && weaponDef[m[2]];
			if (!kit || def == null || !rarity[key]) continue;
			const k = `${def}:${kit.id}`;
			if (skins[k]) continue;
			if (idx < 0) { idx = sets.length; sets.push(tr(set.name) || setKey); }
			skins[k] = [idx, rarity[key], kit.min, kit.max];
		}
	}
	return { sets, skins };
}

// Armory (магазин за звёзды): последний сезон с redeemable_goods = xpshop. redeemId — порядковый номер
// награды в списке сезона (так же их нумерует игра), points — цена в звёздах.
function buildArmory(ig, tr, links, defs, imagesMap) {
	const seasons = ig.seasonaloperations || {};
	const id = Object.keys(seasons).filter(k => seasons[k] && seasons[k].redeemable_goods === 'xpshop').sort((a, b) => b - a)[0];
	if (!id) return null;
	// парсер сливает одинаковые ключи, поэтому список наград читаем из сырого порядка (см. parseVDFList)
	const list = seasons[id]._list_operational_point_redeemable || [];
	const items = list.map((r, i) => {
		const ref = String(r.item_name || '');
		const lootSet = ref.startsWith('lootlist:') ? ref.slice(9) : null;
		const def = !lootSet ? links[ref] : null;
		const setIcon = r.ui_set_image || (lootSet && lootSet.startsWith('set_') ? lootSet : null);
		const image = (def != null && defs[def] && defs[def].image) || (setIcon && imagesMap[`econ/set_icons/${setIcon}`]) || null;
		return { redeemId: i, points: Number(r.points) || 0, name: tr(r.callout) || (def != null && defs[def] && defs[def].name) || ref,
			image, kind: lootSet ? 'lootlist' : 'item', order: Number(r.ui_order) || 9, isNew: Number(r.ui_show_new_tag) || 0 };
	});
	return { campaign: Number(id), items };
}

let _meta = null;
function storeMeta() {
	if (!_meta) {
		// кэш от старой версии сборки не берём — встроенная копия свежее, а кэш пересоберётся в фоне
		const cached = cacheDir() ? readJson(path.join(cacheDir(), META_FILE)) : null;
		_meta = cached && cached.v === META_VERSION ? cached : readJson(path.join(BUNDLED, META_FILE)) || {};
	}
	return _meta;
}
function readJson(file) { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { return null; } }

// Обновить метаданные магазина (раз в сутки; при ошибке остаётся прежний кэш или комплект).
async function refreshStoreMeta(force = false) {
	const dir = cacheDir();
	if (!dir) return { updated: false };
	const file = path.join(dir, META_FILE);
	try {
		const old = !force && fs.existsSync(file) && Date.now() - fs.statSync(file).mtimeMs < 24 * 3600e3 ? readJson(file) : null;
		if (old && old.v === META_VERSION) return { updated: false, fresh: true };
	} catch (e) { /* ignore */ }
	const [ig, en, im] = await Promise.all([getText(META_SOURCES.itemsGame), getText(META_SOURCES.english), getText(META_SOURCES.images)]);
	const meta = buildStoreMeta(decodeText(ig), decodeText(en), JSON.parse(decodeText(im)));
	if (Object.keys(meta.links).length < 1000) throw new Error('файлы игры неполные — оставляем прежние данные');
	fs.mkdirSync(dir, { recursive: true });
	fs.writeFileSync(file + '.tmp', JSON.stringify(meta));
	fs.renameSync(file + '.tmp', file);
	_meta = meta;
	return { updated: true };
}

// Способы поддержки: скачанная версия (из репозитория) важнее встроенной, но пустые поля не затирают заполненные.
function loadSupport() {
	const read = dir => { try { return JSON.parse(fs.readFileSync(path.join(dir, 'support.json'), 'utf8')); } catch (e) { return {}; } };
	const out = read(BUNDLED);
	const remote = cacheDir() ? read(cacheDir()) : {};
	for (const [k, v] of Object.entries(remote)) {
		if (Array.isArray(v) ? v.some(x => x && (x.address || x.url)) : Boolean(v)) out[k] = v;
	}
	return out;
}

module.exports = { loadSupport, loadMap, refresh, BUNDLED, FILES, storeMeta, refreshStoreMeta, buildStoreMeta, META_SOURCES, META_VERSION };
