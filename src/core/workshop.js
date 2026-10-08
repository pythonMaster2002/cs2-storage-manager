// Наклейки на оружии: наклеить, соскоблить, удалить — через Game Coordinator (ApplySticker, 1086).
//   наклеить:   { sticker_item_id, item_item_id, sticker_slot }
//   соскоблить: { item_item_id, sticker_slot }                      — износ наклейки растёт на шаг
//   удалить:    { item_item_id, sticker_slot, sticker_wear_target: 1 } — сразу до конца (наклейка исчезает)
'use strict';

const Protos = require('globaloffensive/protobufs/generated/_load.js');
const cat = require('./catalog');

const APPLY_STICKER = 1086;
const SLOTS = 5;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const NAMES = cat.loadMap('names.json');
const IMAGES = cat.loadMap('images.json');

const stickerName = id => NAMES[`sticker:${id}`] || `Sticker #${id}`;
const stickerImage = id => { const t = IMAGES.images && IMAGES.images[`sticker:${id}`]; return t ? `${IMAGES.cdn}${t}/96fx96f` : null; };
const isWeapon = it => !it.casket_id && it.def_index > 0 && it.def_index < 100
	&& BigInt(it.id) < 0xF000000000000000n && it.origin !== 18;  // 18 = предмет-превью (не ваш)

// Реальные id предметов из инвентаря Steam (контексты 2 и 16 — обычные и защищённые после обмена).
// GC иногда держит предметы, которых у игрока нет (превью, X-Ray и т.п.) — сверяемся с сайтом.
async function webAssetIds(session) {
	if (session._webAssets && Date.now() - session._webAssets.ts < 60000) return session._webAssets.set;
	if (!session.webCookies) return null;
	const set = new Set();
	try {
		for (const ctx of [2, 16]) {
			const res = await session.webRequest('GET', `https://steamcommunity.com/inventory/${session.user.steamID.getSteamID64()}/730/${ctx}?l=english&count=2000`);
			if (res.status !== 200) { if (ctx === 2) return null; continue; }
			for (const a of JSON.parse(res.body).assets || []) set.add(String(a.assetid));
		}
	} catch (e) { return null; }
	session._webAssets = { ts: Date.now(), set };
	return set;
}

async function state(session) {
	session.ensureOnline();
	const { itemName, itemImage } = require('./session');
	const inv = session.csgo.inventory;
	const real = await webAssetIds(session);
	const weapons = inv.filter(isWeapon).filter(w => !real || real.has(String(w.id))).map(w => ({
		id: String(w.id), name: itemName(w), image: itemImage(w),
		stickers: (w.stickers || []).map(s => ({ slot: s.slot, id: s.sticker_id, name: stickerName(s.sticker_id), image: stickerImage(s.sticker_id), wear: s.wear || 0 })),
	})).sort((a, b) => b.stickers.length - a.stickers.length || a.name.localeCompare(b.name));
	const groups = new Map();
	for (const it of inv.filter(i => !i.casket_id && i.def_index === 1209 && i.stickers && i.stickers.length)) {
		const id = it.stickers[0].sticker_id;
		if (!groups.has(id)) groups.set(id, { stickerId: id, name: stickerName(id), image: stickerImage(id), ids: [] });
		groups.get(id).ids.push(String(it.id));
	}
	return { slots: SLOTS, weapons, stickers: [...groups.values()].map(g => ({ ...g, count: g.ids.length })).sort((a, b) => a.name.localeCompare(b.name)) };
}

function weapon(session, id) {
	const w = session.csgo.inventory.find(i => String(i.id) === String(id));
	if (!w || !isWeapon(w)) throw new Error('оружие не найдено в инвентаре');
	return w;
}

function send(session, msg, wearTarget) {
	let buf = Buffer.from(Protos.CMsgApplySticker.encode(msg).finish());
	// sticker_wear_target (поле 11, float) есть в свежих протоколах CS2, но нет в библиотеке — дописываем вручную.
	if (wearTarget != null) { const f = Buffer.alloc(5); f[0] = (11 << 3) | 5; f.writeFloatLE(wearTarget, 1); buf = Buffer.concat([buf, f]); }
	session.user.sendToGC(730, APPLY_STICKER, {}, buf);
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
	const taken = new Set((w.stickers || []).map(s => s.slot));
	if (slot == null) slot = [...Array(SLOTS).keys()].find(s => !taken.has(s));
	if (slot == null) throw new Error('на оружии нет свободных слотов');
	if (taken.has(Number(slot))) throw new Error('этот слот уже занят');
	const st = session.csgo.inventory.find(i => String(i.id) === String(stickerItemId) && i.def_index === 1209);
	if (!st) throw new Error('наклейка не найдена в инвентаре');
	send(session, { sticker_item_id: String(stickerItemId), item_item_id: String(w.id), sticker_slot: Number(slot) });
	const ok = await waitChange(session, w.id, x => (x.stickers || []).some(s => s.slot === Number(slot)));
	if (!ok) throw new Error('GC не применил наклейку — попробуйте ещё раз');
	return { ok: true, slot: Number(slot), weaponId: String(ok.id) };
}

async function scrape(session, weaponId, slot, remove) {
	session.ensureOnline();
	const w = weapon(session, weaponId);
	const cur = (w.stickers || []).find(s => s.slot === Number(slot));
	if (!cur) throw new Error('в этом слоте нет наклейки');
	const before = cur.wear || 0;
	send(session, { item_item_id: String(w.id), sticker_slot: Number(slot) }, remove ? 1 : null);
	const ok = await waitChange(session, w.id, x => {
		const s = (x.stickers || []).find(y => y.slot === Number(slot));
		return !s || (s.wear || 0) > before;
	});
	if (!ok) throw new Error('GC не ответил — попробуйте ещё раз');
	const now = (ok.stickers || []).find(y => y.slot === Number(slot));
	return { removed: !now, wear: now ? now.wear || 0 : null };
}

module.exports = { state, apply, scrape };
