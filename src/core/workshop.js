// Наклейки на оружии: наклеить, соскоблить, удалить — через Game Coordinator (ApplySticker, 1086).
//   наклеить:   { sticker_item_id, item_item_id, sticker_slot }
//   соскоблить: { item_item_id, sticker_slot } — один шаг соскабливания (GC сам прибавляет ~11–15% износа)
//   удалить:    соскабливать, пока наклейка не исчезнет: на износе 100% следующий шаг снимает её,
//               оружие при этом получает новый id (уведомление RemoveSticker, 1053).
// Поле sticker_wear_target (11) из свежих протоколов GC не принимает: с ним пакет молча отбрасывается
// (проверено на живом аккаунте 09.10.2026) — поэтому его не шлём.
// Слот для соскабливания/удаления — индекс атрибута «sticker slot N id» (так делает клиент CS2, pick.js),
// а не значение «sticker slot N schema» (позиция на модели), которым globaloffensive подменяет slot.
'use strict';

const Protos = require('globaloffensive/protobufs/generated/_load.js');
const cat = require('./catalog');

const APPLY_STICKER = 1086;
const SLOTS = 5;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const NAMES = cat.loadMap('names.json');

const stickerName = id => NAMES[`sticker:${id}`] || `Sticker #${id}`;
const stickerImage = id => cat.stickerIcon(id);
const isWeapon = it => !it.casket_id && it.def_index > 0 && it.def_index < 100
	&& BigInt(it.id) < 0xF000000000000000n && it.origin !== 18;  // 18 = предмет-превью (не ваш)

// Реальные id предметов из инвентаря Steam (контексты 2 и 16 — обычные и защищённые после обмена).
// GC иногда держит предметы, которых у игрока нет (превью, X-Ray и т.п.) — сверяемся с сайтом.
// Ссылка «Осмотреть» в CS2: steam://run/730//+csgo_econ_action_preview%20%propid:6% — вместо %propid:6%
// подставляется «сертификат предмета» из asset_properties (подписан Steam, сами его не собрать).
async function webAssetIds(session, fresh = false) {
	if (!fresh && session._webAssets && Date.now() - session._webAssets.ts < 60000) return session._webAssets;
	if (!session.webCookies) return null;
	const set = new Set();
	const inspect = new Map();  // assetid -> ссылка «осмотреть» (steam://…csgo_econ_action_preview…)
	const ctxOf = new Map();    // assetid -> контекст (2 — обычный, 16 — под защитой обмена)
	const sid = session.user.steamID.getSteamID64();
	try {
		for (const ctx of [2, 16]) {
			const res = await session.webRequest('GET', `https://steamcommunity.com/inventory/${sid}/730/${ctx}?l=english&count=2000`);
			if (res.status !== 200) { if (ctx === 2) return null; continue; }
			const d = JSON.parse(res.body);
			const links = new Map((d.descriptions || []).map(x => [`${x.classid}_${x.instanceid}`, ((x.actions || [])[0] || {}).link]));
			const props = new Map((d.asset_properties || []).map(x => [String(x.assetid), new Map((x.asset_properties || []).map(p => [String(p.propertyid), p.string_value]))]));
			for (const a of d.assets || []) {
				set.add(String(a.assetid));
				ctxOf.set(String(a.assetid), ctx);
				const l = links.get(`${a.classid}_${a.instanceid}`);
				if (!l) continue;
				const pr = props.get(String(a.assetid));
				const link = l.replace('%owner_steamid%', sid).replace('%assetid%', a.assetid)
					.replace(/%propid:(\d+)%/g, (m, id) => (pr && pr.get(id)) || m);
				if (!/%\w+(:\d+)?%/.test(link)) inspect.set(String(a.assetid), link);  // без неподставленных полей
			}
		}
	} catch (e) { return null; }
	session._webAssets = { ts: Date.now(), set, inspect, ctxOf, sid };
	return session._webAssets;
}

async function state(session) {
	session.ensureOnline();
	const { itemName, itemImage } = require('./session');
	const inv = session.csgo.inventory;
	const web = await webAssetIds(session);
	const weapons = inv.filter(isWeapon).filter(w => !web || web.set.has(String(w.id))).map(w => ({
		id: String(w.id), name: itemName(w), image: itemImage(w), float: w.paint_wear != null ? w.paint_wear : null,
		inspect: web ? web.inspect.get(String(w.id)) || null : null,
		// предмет в инвентаре Steam (контекст 16 — под защитой обмена)
		invLink: web ? `https://steamcommunity.com/profiles/${web.sid}/inventory/#730_${web.ctxOf.get(String(w.id)) || 2}_${w.id}` : null,
		stickers: stickersOf(w).sort((a, b) => a.pos - b.pos || a.slot - b.slot)
			.map(s => ({ slot: s.slot, pos: s.pos, id: s.sticker_id, name: stickerName(s.sticker_id), image: stickerImage(s.sticker_id), wear: s.wear || 0 })),
	})).sort((a, b) => b.stickers.length - a.stickers.length || a.name.localeCompare(b.name));
	const groups = new Map();
	for (const it of inv.filter(i => !i.casket_id && i.def_index === 1209 && i.stickers && i.stickers.length)) {
		const id = it.stickers[0].sticker_id;
		if (!groups.has(id)) groups.set(id, { stickerId: id, name: stickerName(id), image: stickerImage(id), ids: [] });
		groups.get(id).ids.push(String(it.id));
	}
	return { slots: SLOTS, weapons, stickers: [...groups.values()].map(g => ({ ...g, count: g.ids.length })).sort((a, b) => a.name.localeCompare(b.name)) };
}

// Наклейки предмета прямо из атрибутов: slot — индекс атрибута (для GC), pos — позиция на модели (schema).
function attr(item, def) { const a = (item.attribute || []).find(x => x.def_index == def); return a && a.value_bytes ? Buffer.from(a.value_bytes) : null; }
function stickersOf(item) {
	if (!item.attribute) return (item.stickers || []).map(s => ({ slot: s.slot, pos: s.slot, sticker_id: s.sticker_id, wear: s.wear || 0 }));
	const out = [];
	for (let i = 0; i <= 5; i++) {
		const id = attr(item, 113 + i * 4);
		if (!id || id.length < 4) continue;
		const wear = attr(item, 114 + i * 4), schema = attr(item, 290 + i);
		out.push({ slot: i, pos: schema && schema.length >= 4 ? schema.readUInt32LE(0) : i, sticker_id: id.readUInt32LE(0), wear: wear && wear.length >= 4 ? wear.readFloatLE(0) : 0 });
	}
	return out;
}

function weapon(session, id) {
	const w = session.csgo.inventory.find(i => String(i.id) === String(id));
	if (!w || !isWeapon(w)) throw new Error('оружие не найдено в инвентаре');
	return w;
}

function send(session, msg) {
	session.user.sendToGC(730, APPLY_STICKER, {}, Buffer.from(Protos.CMsgApplySticker.encode(msg).finish()));
}

// Ждём, пока GC обновит предмет (стикеры на оружии меняются через SO_Update).
async function waitChange(session, weaponId, check, ms = 15000) {
	const deadline = Date.now() + ms;
	const orig = session.csgo.inventory.find(i => String(i.id) === String(weaponId));
	const before = new Set(session.csgo.inventory.map(i => String(i.id)));
	while (Date.now() < deadline) {
		await sleep(300);
		const w = session.csgo.inventory.find(i => String(i.id) === String(weaponId));
		if (w && check(w)) return w;
		// предмет мог прийти с новым id — ищем «тот же» оружейный предмет среди новых
		if (orig) {
			const fresh = session.csgo.inventory.find(i => !before.has(String(i.id)) && i.def_index === orig.def_index
				&& Math.round(i.paint_index || 0) === Math.round(orig.paint_index || 0) && (i.paint_seed || 0) === (orig.paint_seed || 0));
			if (fresh && check(fresh)) { session._webAssets = null; return fresh; }
		}
	}
	return null;
}

async function apply(session, weaponId, stickerItemId, slot) {
	session.ensureOnline();
	const w = weapon(session, weaponId);
	const before = stickersOf(w);
	const taken = new Set(before.map(s => s.pos));
	if (slot == null) slot = [...Array(SLOTS).keys()].find(s => !taken.has(s));
	if (slot == null) throw new Error('на оружии нет свободных слотов');
	if (taken.has(Number(slot))) throw new Error('этот слот уже занят');
	const st = session.csgo.inventory.find(i => String(i.id) === String(stickerItemId) && i.def_index === 1209);
	if (!st) throw new Error('наклейка не найдена в инвентаре');
	send(session, { sticker_item_id: String(stickerItemId), item_item_id: String(w.id), sticker_slot: Number(slot) });
	const ok = await waitChange(session, w.id, x => stickersOf(x).length > before.length);
	if (!ok) throw new Error('GC не применил наклейку — попробуйте ещё раз');
	return { ok: true, slot: Number(slot), weaponId: String(ok.id) };
}

// Один шаг соскабливания; remove — шагаем, пока наклейка не исчезнет (обычно 5–9 шагов).
async function scrape(session, weaponId, slot, remove) {
	session.ensureOnline();
	slot = Number(slot);  // индекс атрибута наклейки (см. stickersOf)
	let w = weapon(session, weaponId);
	const at = x => stickersOf(x).find(s => s.slot === slot);
	if (!at(w)) throw new Error('в этом слоте нет наклейки');
	const origId = at(w).sticker_id;
	for (let step = 0; step < (remove ? 20 : 1); step++) {
		const cur = at(w);
		if (!cur || cur.sticker_id !== origId) break;  // сняли (или на этот индекс встала другая наклейка)
		const before = cur.wear || 0, stickerId = cur.sticker_id;
		send(session, { item_item_id: String(w.id), sticker_slot: slot });
		const next = await waitChange(session, w.id, x => { const st = at(x); return !st || st.sticker_id !== stickerId || (st.wear || 0) > before; }, 12000);
		if (!next) throw new Error(step ? `GC перестал отвечать (сделано шагов: ${step}) — попробуйте ещё раз` : 'GC не ответил — попробуйте ещё раз');
		w = next;
	}
	const now = at(w) && at(w).sticker_id === origId ? at(w) : null;
	return { removed: !now, wear: now ? now.wear || 0 : null, weaponId: String(w.id) };
}

// Ссылка «Осмотреть» для предмета; wait — подождать, пока новый предмет (например, после контракта)
// появится в веб-инвентаре Steam.
async function inspectLink(session, itemId, wait = false) {
	for (let i = 0; i < (wait ? 5 : 1); i++) {
		if (i) await sleep(2500);
		const web = await webAssetIds(session, wait);
		const l = web && web.inspect.get(String(itemId));
		if (l) return l;
	}
	return null;
}

module.exports = { state, apply, scrape, webAssetIds, inspectLink, stickersOf };
