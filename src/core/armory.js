// Armory (магазин наград за звёзды пропуска Armory) — через Game Coordinator, без оплаты деньгами.
//   • каталог наград — из файлов игры (catalog.storeMeta().armory, обновляется сам);
//   • баланс звёзд — из SO-кэша GC (CSOAccountXpShop.redeemable_balance или
//     CSOAccountSeasonalOperation.redeemable_balance текущего сезона);
//   • обмен — ClientRedeemMissionReward (9209): campaign_id, redeem_id, redeemable_balance, expected_cost.
'use strict';

const protobuf = require('protobufjs');
const Protos = require('globaloffensive/protobufs/generated/_load.js');
const cat = require('./catalog');

const REDEEM = 9209;
const sleep = ms => new Promise(r => setTimeout(r, ms));

// Сырые поля protobuf-объекта: { field: value } (varint как Number).
function rawFields(buf) {
	const r = protobuf.Reader.create(buf), out = {};
	while (r.pos < r.len) {
		const tag = r.uint32(), f = tag >>> 3, w = tag & 7;
		if (w === 0) { const v = Number(r.uint64().toString()); out[f] = v; out[`max${f}`] = Math.max(out[`max${f}`] || 0, v); }
		else if (w === 2) {
			// packed repeated varint — запоминаем максимум (id предметов огромные, номера треков маленькие)
			const b = r.bytes(); const pr = protobuf.Reader.create(b); let mx = 0;
			try { while (pr.pos < pr.len) mx = Math.max(mx, Number(pr.uint64().toString())); } catch (e) { mx = Infinity; }
			out[f] = 'bytes'; out[`max${f}`] = Math.max(out[`max${f}`] || 0, mx);
		}
		else r.skipType(w);
	}
	return out;
}

// Баланс звёзд. Номера SO-типов в CS2 не документированы, поэтому узнаём объект по содержимому:
// XpShop = {1: generation_time (unix-время), 2: redeemable_balance}; сезон = {1: season_value, 6: redeemable_balance}.
function starBalance(session, campaign) {
	let xp = null, season = null;
	for (const [type, list] of (session.so || new Map())) {
		if ([1, 2, 7].includes(type)) continue;
		for (const buf of list) {
			let f; try { f = rawFields(buf); } catch (e) { continue; }
			if (f[1] === campaign && f[6] != null) season = { type, balance: f[6] };
			// XpShop: {1: generation_time, 2: balance, 3: xp_tracks (малые числа)}; у «личного магазина» дропов
			// поле 3 — id предметов (огромные), его пропускаем.
			else if (f[1] > 1.4e9 && f[1] < 2.2e9 && f[2] != null && f[2] < 100000 && !(4 in f) && !(5 in f) && !((f.max3 || 0) > 1e6)) xp = { type, balance: f[2] };
		}
	}
	return xp || season || null;
}

function state(session) {
	session.ensureOnline();
	const arm = cat.storeMeta().armory;
	if (!arm) throw new Error('каталог Armory ещё не загружен — попробуйте позже');
	const bal = starBalance(session, arm.campaign);
	const items = arm.items.slice().sort((a, b) => a.order - b.order || b.isNew - a.isNew || a.points - b.points);
	return { campaign: arm.campaign, balance: bal ? bal.balance : 0, hasPass: Boolean(bal), items };
}

// Обменять награду count раз. Каждый обмен ждём по появлению нового предмета в инвентаре.
async function redeem(session, redeemId, count = 1) {
	const st = state(session);
	const item = st.items.find(i => i.redeemId === Number(redeemId));
	if (!item) throw new Error('такой награды нет в Armory');
	count = Math.max(1, Math.min(50, Number(count) || 1));
	if (!st.hasPass) throw new Error('на аккаунте нет звёзд Armory (нужен пропуск Armory)');
	if (st.balance < item.points * count) throw new Error(`не хватает звёзд: есть ${st.balance}, нужно ${item.points * count}`);
	const got = [];
	let balance = st.balance;
	for (let n = 0; n < count; n++) {
		const before = new Set(session.csgo.inventory.map(i => String(i.id)));
		session.csgo._send(REDEEM, Protos.CMsgGCCstrike15_v2_ClientRedeemMissionReward, {
			campaign_id: st.campaign, redeem_id: item.redeemId, redeemable_balance: balance, expected_cost: item.points,
		});
		const deadline = Date.now() + 15000;
		let fresh = null;
		while (Date.now() < deadline && !fresh) {
			await sleep(400);
			fresh = session.csgo.inventory.find(i => !before.has(String(i.id)) && !i.casket_id);
		}
		if (!fresh) {
			if (!got.length) throw new Error('GC не выдал награду — возможно, изменился каталог Armory; попробуйте обновить');
			break;
		}
		got.push(String(fresh.id));
		balance -= item.points;
		await sleep(300);
	}
	return { redeemed: got.length, itemIds: got, name: item.name, balance: (starBalance(session, st.campaign) || { balance }).balance };
}

module.exports = { state, redeem, starBalance, rawFields };
