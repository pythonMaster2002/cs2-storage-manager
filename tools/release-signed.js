'use strict';
// После подписи в SignPath: подписанные exe заменяют неподписанные в dist/, для установщика заново
// считаются блок-карта и sha512/size в latest.yml (иначе автообновление отвергнет подписанный файл),
// затем всё загружается в черновик релиза текущего тега.
//   node tools/release-signed.js <папка-с-подписанными> [--dry-run]
// Окружение (GitHub Actions): GH_TOKEN, GITHUB_REPOSITORY, GITHUB_REF_NAME.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { buildBlockMap } = require('app-builder-lib/out/targets/blockmap/blockmap');

const DIST = path.join(__dirname, '..', 'dist');
const [signedDir, flag] = process.argv.slice(2);
const dryRun = flag === '--dry-run';

const find = (dir, re) => {
	const out = [];
	for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
		const p = path.join(dir, e.name);
		if (e.isDirectory()) out.push(...find(p, re)); else if (re.test(e.name)) out.push(p);
	}
	return out;
};
const sha512 = file => crypto.createHash('sha512').update(fs.readFileSync(file)).digest('base64');

async function main() {
	if (!signedDir || !fs.existsSync(signedDir)) throw new Error('нет папки с подписанными файлами');
	const signed = find(signedDir, /\.exe$/i);
	if (!signed.length) throw new Error('SignPath не вернул ни одного .exe');
	for (const f of signed) {
		const target = path.join(DIST, path.basename(f));
		if (!fs.existsSync(target)) throw new Error(`в dist нет ${path.basename(f)} — неожиданное имя файла`);
		fs.copyFileSync(f, target);
		console.log('подписан:', path.basename(f));
	}

	// установщик: новая блок-карта и данные для автообновления
	const setup = fs.readdirSync(DIST).find(n => /^Caskit-Setup-.*\.exe$/.test(n));
	if (!setup) throw new Error('в dist нет установщика Caskit-Setup-*.exe');
	const setupPath = path.join(DIST, setup);
	await buildBlockMap(setupPath, 'gzip', `${setupPath}.blockmap`);
	const hash = sha512(setupPath), size = fs.statSync(setupPath).size;
	const latestPath = path.join(DIST, 'latest.yml');
	const yml = fs.readFileSync(latestPath, 'utf8')
		.replace(/(\n\s+- url: [^\n]*\n\s+sha512: )[^\n]+(\n\s+size: )\d+/, `$1${hash}$2${size}`)
		.replace(/\nsha512: [^\n]+/, `\nsha512: ${hash}`);
	if (!yml.includes(hash)) throw new Error('не удалось обновить latest.yml');
	fs.writeFileSync(latestPath, yml);
	console.log('latest.yml:', size, 'байт');

	// всё, что вернулось подписанным (установщик и portable), плюс новые блок-карта и latest.yml
	const assets = [...new Set([...signed.map(f => path.basename(f)), `${setup}.blockmap`, 'latest.yml'])];
	if (dryRun) { console.log('dry-run, загрузил бы:', assets.join(', ')); return; }
	await upload(assets);
}

async function upload(names) {
	const { GH_TOKEN, GITHUB_REPOSITORY, GITHUB_REF_NAME } = process.env;
	const api = `https://api.github.com/repos/${GITHUB_REPOSITORY}`;
	const headers = { Authorization: `Bearer ${GH_TOKEN}`, Accept: 'application/vnd.github+json' };
	const releases = await (await fetch(`${api}/releases?per_page=30`, { headers })).json();
	const rel = releases.find(r => r.tag_name === GITHUB_REF_NAME);
	if (!rel) throw new Error(`нет релиза для тега ${GITHUB_REF_NAME}`);
	for (const name of names) {
		const old = rel.assets.find(a => a.name === name);
		if (old) await fetch(`${api}/releases/assets/${old.id}`, { method: 'DELETE', headers });
		const body = fs.readFileSync(path.join(DIST, name));
		const res = await fetch(`${rel.upload_url.replace(/\{.*\}$/, '')}?name=${encodeURIComponent(name)}`, {
			method: 'POST', headers: { ...headers, 'Content-Type': 'application/octet-stream' }, body,
		});
		if (!res.ok) throw new Error(`загрузка ${name}: HTTP ${res.status} ${await res.text()}`);
		console.log('загружен:', name);
	}
}

main().catch(e => { console.error(e.message); process.exit(1); });
