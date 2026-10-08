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
	for (const [id, def] of Object.entries(items)) {
		if (!/^\d+$/.test(id) || !def || typeof def !== 'object') continue;
		if (def.name) links[def.name] = Number(id);
		// Слэбы/брелоки-инструменты имеют общий токен «Charm» — точное имя лежит под keychain_kc_<name>.
		let name = tr(`keychain_kc_${def.name}`) || tr(field(def, 'item_name'));
		// Купон музыкального набора без своей строки локализации: «StatTrak™ Music Kit | <набор>».
		const kit = !name && String(def.name || '').match(/^coupon - (.+?)(_stattrak)?$/);
		if (kit && tr(`musickit_${kit[1]}`)) name = `${kit[2] ? 'StatTrak™ ' : ''}Music Kit | ${tr(`musickit_${kit[1]}`)}`;
		const img = field(def, 'image_inventory');
		const image = (img && (imagesMap[img] || imagesMap[String(img).toLowerCase()]))
			|| imagesMap[`econ/tools/${def.name}`] || imagesMap[`econ/keychains/${def.name}/kc_${def.name}`] || null;
		if (name || image) defs[id] = { name, image };
	}
	return { built: Date.now(), links, defs, armory: buildArmory(ig, tr, links, defs, imagesMap) };
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
	if (!_meta) _meta = loadMap(META_FILE);
	return _meta;
}

// Обновить метаданные магазина (раз в сутки; при ошибке остаётся прежний кэш или комплект).
async function refreshStoreMeta(force = false) {
	const dir = cacheDir();
	if (!dir) return { updated: false };
	const file = path.join(dir, META_FILE);
	try { if (!force && fs.existsSync(file) && Date.now() - fs.statSync(file).mtimeMs < 24 * 3600e3) return { updated: false, fresh: true }; } catch (e) { /* ignore */ }
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

module.exports = { loadSupport, loadMap, refresh, BUNDLED, FILES, storeMeta, refreshStoreMeta, buildStoreMeta, META_SOURCES };
