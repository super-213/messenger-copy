import { cp, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import ts from 'typescript';
import { localizeDialogues } from './localize-dialogues.mjs';
import { assertMobileAssets } from './mobile-assets.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const source = path.join(root, 'reference/messenger.abeto.co');
const target = path.join(root, 'static/original');
const dialogueConfig = JSON.parse(await readFile(path.join(root, 'src/lib/original/dialogues.json'), 'utf8'));

function replaceChecked(source, before, after, expected = 1) {
	const count = source.split(before).length - 1;
	if (count !== expected) throw new Error(`Original bundle changed: expected ${expected} occurrences of ${before}, found ${count}. Review the integration before updating.`);
	return source.replaceAll(before, after);
}

await assertMobileAssets(path.join(source, 'assets'));
await mkdir(target, { recursive: true });
await cp(path.join(source, 'assets'), path.join(target, 'assets'), { recursive: true });
const manifest = [];
async function prepare(directory) {
	for (const entry of await readdir(directory, { withFileTypes: true })) {
		const filename = path.join(directory, entry.name);
		if (entry.isDirectory()) { await prepare(filename); continue; }
		const original = await readFile(filename);
		manifest.push({ path: path.relative(target, filename), sha256: createHash('sha256').update(original).digest('hex') });
		if (!/\.(js|css)$/.test(filename)) continue;
		let code = original.toString().replaceAll('https://messenger.abeto.co/', '/original/');
		if (entry.name === 'webgl-C4v7tvuW.js') {
			code = replaceChecked(code, 'window.__webgl.start();', 'window.__webgl.start({relativePath:"original"});');
		}
		if (entry.name === 'App3D-BLRWK1h9.js') {
			code = localizeDialogues(code, dialogueConfig);
			code = 'import { LocalizedDialogue } from "../dialogue-ui.js";\n' + code;
			code = 'import { BilingualChecklist } from "../checklist-ui.js";\n' + code;
			const labels = Object.fromEntries(Object.entries(dialogueConfig.quests).map(([id, quest]) => [id, { zh: quest.label, en: quest.labelEn }]));
			code = replaceChecked(code, 'new checkList(this)', `new BilingualChecklist(this,events,QUESTINFO,new dot(this),${JSON.stringify(labels)})`);
			code = replaceChecked(code, 'new dialogBox(this)', 'new LocalizedDialogue(this,events)');
			// The original CDN accepts double slashes; a local static server does not.
			code = replaceChecked(code, 'geometryLoader.load("/planets/intro/points.drc")', 'geometryLoader.load("planets/intro/points.drc")');
			// Use the engine's offline mode. Its scene transition needs a null guard in that mode.
			code = replaceChecked(code, 'offline:!1,autoConnect:!1,servers:', 'offline:!0,autoConnect:!1,servers:');
			code = replaceChecked(code, 'this.characters.mesh._connection._createSocket()', 'this.characters.mesh._connection?._createSocket()', 2);
			// Small integration seam for the separate project-entry overlay; shaders and controls are untouched.
			code = replaceChecked(code, 'const M=new mainController;await M.ready', 'const M=new mainController;window.__originalMessenger={controller:M,events,global:global$1};await M.ready');
			code = replaceChecked(code, 'const key="App3D_data";', 'const key="Messenger_local_data";');
		}
		await writeFile(filename, code);
	}
}
await prepare(path.join(target, 'assets'));
const html = (await readFile(path.join(source, 'index.html'), 'utf8'))
	.replaceAll('https://messenger.abeto.co/', '/original/')
	.replace('</head>', '<link rel="stylesheet" href="/original/portal.css">\n<link rel="stylesheet" href="/original/dialogue-ui.css">\n<script type="module" src="/original/portal.js"></script>\n</head>');
await writeFile(path.join(target, 'index.html'), html.replace('</head>', '<link rel="stylesheet" href="/original/checklist-ui.css">\n</head>'));
for (const file of ['portal.css', 'portals.json', 'dialogue-ui.css', 'checklist-ui.css']) {
	await cp(path.join(root, 'src/lib/original', file), path.join(target, file));
}
for (const module of ['portal', 'dialogue-ui', 'checklist-ui']) {
	const bridge = await readFile(path.join(root, `src/lib/original/${module}.ts`), 'utf8');
	await writeFile(path.join(target, `${module}.js`), ts.transpileModule(bridge, {
		compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 }
	}).outputText);
}
await writeFile(path.join(target, 'source-manifest.json'), JSON.stringify({
	source: 'https://messenger.abeto.co/',
	entry: 'webgl-C4v7tvuW.js',
	application: 'App3D-BLRWK1h9.js',
	mode: 'offline',
	files: manifest.sort((a, b) => a.path.localeCompare(b.path))
}, null, 2) + '\n');
console.log(`Prepared original Messenger: ${manifest.length} local assets. No network requests required at runtime for these assets.`);
