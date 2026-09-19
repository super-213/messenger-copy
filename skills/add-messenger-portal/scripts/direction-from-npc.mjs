#!/usr/bin/env node
import { mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const projectRoot = fileURLToPath(new URL('../../../', import.meta.url));
const dialoguePath = path.join(projectRoot, 'src/lib/original/dialogues.json');

function parseArgs(argv) {
	const options = {
		origin: 'http://127.0.0.1:4173',
		offset: 1.5,
		screenshot: '/tmp/messenger-portal-location.png'
	};
	for (let index = 0; index < argv.length; index++) {
		const key = argv[index];
		if (key === '--help') options.help = true;
		else if (['--origin', '--npc', '--offset', '--screenshot'].includes(key)) {
			const value = argv[++index];
			if (value === undefined) throw new Error(`Missing value for ${key}`);
			options[key.slice(2)] = value;
		} else throw new Error(`Unknown option: ${key}`);
	}
	return options;
}

function usage() {
	console.log(`Usage: node direction-from-npc.mjs --npc <npc-id> [options]

Options:
  --origin <url>       Running preview origin (default: http://127.0.0.1:4173)
  --offset <number>    Distance in front of the NPC (default: 1.5)
  --screenshot <path>  Visual confirmation output
  --help               Show this help`);
}

let browser;
try {
	const options = parseArgs(process.argv.slice(2));
	if (options.help) {
		usage();
		process.exit(0);
	}
	if (!options.npc) throw new Error('Missing required option: --npc');
	const offsetDistance = Number(options.offset);
	if (!Number.isFinite(offsetDistance) || offsetDistance <= 0) throw new Error('Offset must be a positive number.');
	const dialogues = JSON.parse(await readFile(dialoguePath, 'utf8'));
	if (!dialogues.npcs?.[options.npc]) {
		throw new Error(`Unknown NPC ${options.npc}. Available IDs: ${Object.keys(dialogues.npcs ?? {}).join(', ')}`);
	}
	browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || undefined });
	const context = await browser.newContext({ viewport: { width: 1440, height: 950 } });
	await context.route('**/*', (route) => {
		const url = route.request().url();
		if (/^https?:/.test(url) && new URL(url).origin !== new URL(options.origin).origin) return route.abort();
		return route.continue();
	});
	const page = await context.newPage();
	await page.goto(options.origin);
	const frame = await page.locator('iframe').contentFrame().locator('body').elementHandle().then((body) => body.ownerFrame());
	await frame.waitForFunction(() => window.__originalMessenger?.controller.state === 'intro', null, { timeout: 60000 });
	await page.waitForTimeout(6500);
	const viewport = page.viewportSize();
	await page.mouse.click(viewport.width / 2, viewport.height * 0.868, { delay: 100 });
	await frame.waitForFunction(() => window.__originalMessenger?.controller.state === 'present', null, { timeout: 90000 });
	await frame.waitForFunction(() => window.__originalMessenger.controller.currentScene.characters.mesh.interactingElement === 'intro', null, { timeout: 30000 });
	for (const text of dialogues.intro.texts) {
		await frame.waitForFunction((value) => document.querySelector('#localized-speech')?.textContent === value, text);
		await frame.getByRole('button', { name: '继续对话' }).click();
		await page.waitForTimeout(400);
	}
	await frame.waitForFunction(() => !window.__originalMessenger.controller.currentScene.characters.mesh.interactingElement);
	const result = await frame.evaluate(({ npcId, offsetDistance }) => {
		const scene = window.__originalMessenger.controller.currentScene;
		const npc = scene.npcs.find((entry) => entry.mesh._id === npcId)?.mesh;
		if (!npc) throw new Error(`NPC not loaded: ${npcId}`);
		const player = scene.characters.mesh;
		const offset = npc.position.clone().set(0, 0, offsetDistance).applyQuaternion(npc.quaternion);
		const target = npc.position.clone().add(offset);
		player.setInitialPosition(target.toArray(), 0, Math.PI, target.clone().normalize().toArray());
		const local = player._localObject;
		const behind = local.position.clone().sub(npc.position).projectOnPlane(local.up);
		behind.applyAxisAngle(local.up, local.rotationHorizontal - Math.PI).applyQuaternion(local.quaternion.clone().invert());
		scene.camera._disableAutomaticCentering = true;
		scene.camera._sphericalTarget.theta = Math.atan2(behind.x, behind.z);
		scene.camera._sphericalTarget.phi = 1.1;
		scene.camera._spherical.copy(scene.camera._sphericalTarget);
		return {
			npcId,
			npcPosition: npc.position.toArray(),
			groundTarget: target.toArray(),
			direction: target.clone().normalize().toArray().map((value) => Number(value.toFixed(8)))
		};
	}, { npcId: options.npc, offsetDistance });
	await page.waitForTimeout(2500);
	await mkdir(path.dirname(path.resolve(options.screenshot)), { recursive: true });
	await page.screenshot({ path: options.screenshot });
	console.log(JSON.stringify({ ...result, npcName: dialogues.npcs[options.npc].name, screenshot: path.resolve(options.screenshot) }, null, 2));
} catch (error) {
	console.error(`direction-from-npc: ${error.message}`);
	usage();
	process.exitCode = 1;
} finally {
	await browser?.close();
}

