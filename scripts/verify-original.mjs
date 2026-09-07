import assert from 'node:assert/strict';
import { mkdir, readFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const origin = process.argv[2] ?? 'http://127.0.0.1:4173';
const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || undefined });
const errors = [], failed = [], external = [], sockets = [];
const dialogueConfig = JSON.parse(await readFile(new URL('../src/lib/original/dialogues.json', import.meta.url), 'utf8'));
let activePage;
await mkdir('artifacts', { recursive: true });
async function start(viewport, mobile = false) {
	const context = await browser.newContext({ viewport, isMobile: mobile, hasTouch: mobile });
	// Prove the built copy works without contacting the original site or any remote service.
	await context.route('**/*', (route) => {
		const url = route.request().url();
		if (/^https?:/.test(url) && new URL(url).origin !== new URL(origin).origin) {
			external.push(url); return route.abort();
		}
		return route.continue();
	});
	const page = await context.newPage();
	activePage = page;
	page.on('pageerror', (e) => errors.push(e.message));
	page.on('response', (r) => { if (r.status() >= 400) failed.push(`${r.status()} ${r.url()}`); });
	page.on('websocket', (s) => sockets.push(s.url()));
	await page.goto(origin);
	const frame = await page.locator('iframe').contentFrame().locator('body').elementHandle().then((body) => body.ownerFrame());
	await frame.waitForFunction(() => window.__originalMessenger?.controller.state === 'intro', null, { timeout: 60000 });
	await page.waitForTimeout(6500);
	await page.mouse.move(viewport.width / 2, viewport.height * 0.868);
	await page.waitForTimeout(250);
	await page.mouse.click(viewport.width / 2, viewport.height * 0.868, { delay: 100 });
	await frame.waitForFunction(() => window.__originalMessenger?.controller.state === 'present', null, { timeout: 90000 });
	await frame.waitForFunction(() => window.__originalMessenger.controller.currentScene.characters.mesh.interactingElement === 'intro', null, { timeout: 30000 });
	// Use the actual translated button/keyboard controls and allow customized intro line counts.
	for (const [step, line] of dialogueConfig.intro.texts.entries()) {
		await frame.waitForFunction((text) => document.querySelector('#localized-speech')?.textContent === text && !document.querySelector('#localized-dialogue').hidden, line);
		assert.equal(await frame.locator('#localized-speaker').innerText(), dialogueConfig.intro.name);
		if (step === 0) await page.screenshot({ path: `artifacts/dialogue-intro-${mobile ? 'mobile' : 'desktop'}.png` });
		if (!mobile && step === 1) await page.keyboard.press('e');
		else if (mobile) await frame.getByRole('button', { name: '继续对话' }).tap();
		else await frame.getByRole('button', { name: '继续对话' }).click();
		await page.waitForTimeout(400);
	}
	await frame.waitForFunction(() => !window.__originalMessenger.controller.currentScene.characters.mesh.interactingElement);
	await page.waitForTimeout(2500);
	await frame.evaluate(() => window.focus());
	return { context, page, frame };
}
async function visitNPC(page, frame, id) {
	await frame.evaluate((id) => {
		const scene = window.__originalMessenger.controller.currentScene;
		const npc = scene.npcs.find((npc) => npc.mesh._id === id).mesh;
		const player = scene.characters.mesh;
		const offset = npc.position.clone().set(0, 0, 1.5).applyQuaternion(npc.quaternion);
		const target = npc.position.clone().add(offset);
		player.setInitialPosition(target.toArray(), 0, Math.PI, target.clone().normalize().toArray());
	}, id);
	await page.waitForTimeout(250);
	await frame.evaluate((id) => {
		const s = window.__originalMessenger.controller.currentScene;
		const npc = s.npcs.find((npc) => npc.mesh._id === id).mesh;
		const local = s.characters.mesh._localObject;
		const behind = local.position.clone().sub(npc.position).projectOnPlane(local.up);
		behind.applyAxisAngle(local.up, local.rotationHorizontal - Math.PI).applyQuaternion(local.quaternion.clone().invert());
		s.camera._disableAutomaticCentering = true;
		s.camera._sphericalTarget.theta = Math.atan2(behind.x, behind.z);
		s.camera._sphericalTarget.phi = 1.1;
		s.camera._spherical.copy(s.camera._sphericalTarget);
	}, id);
}
async function verifyNPCs(page, frame) {
	await visitNPC(page, frame, 'chef');
	const bubble = frame.locator('.localized-bubble[data-npc-id="chef"]');
	await bubble.waitFor({ timeout: 15000 });
	assert.equal(await bubble.innerText(), dialogueConfig.npcs.chef.texts[0]);
	await page.screenshot({ path: 'artifacts/dialogue-npc-bubble.png' });
	for (const [index, step] of dialogueConfig.quests['quest-employee'].steps.entries()) {
		await visitNPC(page, frame, step.npcId);
		await page.waitForTimeout(2500);
		// Project the real NPC into screen space, then perform an actual pointer interaction.
		const point = await frame.evaluate((id) => {
			const s = window.__originalMessenger.controller.currentScene;
			const m = s.npcs.find((npc) => npc.mesh._id === id).mesh;
			const p = m.position.clone().set(0, m.boundingSphere.radius * 0.6, 0);
			m.localToWorld(p).project(s.camera);
			return { x: (p.x + 1) * innerWidth / 2, y: (1 - p.y) * innerHeight / 2 };
		}, step.npcId);
		await page.mouse.move(point.x, point.y);
		await page.waitForTimeout(300);
		await page.mouse.click(point.x, point.y, { delay: 100 });
		for (const [lineIndex, text] of step.texts.entries()) {
			await frame.waitForFunction((text) => document.querySelector('#localized-speech')?.textContent === text && !document.querySelector('#localized-dialogue').hidden, text, { timeout: 15000 });
			assert.equal(await frame.locator('#localized-speaker').innerText(), dialogueConfig.npcs[step.npcId].name);
			if (index === 0 && lineIndex === 0) await page.screenshot({ path: 'artifacts/dialogue-quest.png' });
			await frame.getByRole('button', { name: '继续对话' }).click();
			await page.waitForTimeout(500);
		}
		await frame.locator('#localized-dialogue').waitFor({ state: 'hidden' });
		await page.waitForTimeout(1200);
	}
	const progress = await frame.evaluate(() => JSON.parse(localStorage.getItem('Messenger_local_data')).questProgress['quest-employee']);
	assert.deepEqual(progress, [true, true, true], 'Translated dialogue completes the original quest and saves its progress');
	console.log('Chinese dialogue passed: idle speech bubble, pointer-selected NPCs, all three steps of the employee quest and saved progress.');
}
async function verifyChecklist(page, frame, mobile = false, completed = false) {
	await frame.evaluate(() => window.__originalMessenger.events.emit('ui_quest_log_toggle'));
	const panel = frame.locator('#bilingual-checklist');
	await panel.waitFor();
	assert.equal(await panel.locator('li').count(), 5);
	for (const [id, quest] of Object.entries(dialogueConfig.quests)) {
		const row = panel.locator(`[data-quest-id="${id}"]`);
		assert.equal(await row.locator('[lang="zh-CN"]').innerText(), quest.label);
		assert.equal(await row.locator('[lang="en"]').innerText(), quest.labelEn);
	}
	if (completed) {
		const row = panel.locator('[data-quest-id="quest-employee"]');
		assert.match(await row.getAttribute('class'), /is-complete/);
		assert.equal((await row.locator('.quest-progress').innerText()).trim(), '(3/3)');
	}
	const rect = await panel.boundingBox();
	const viewport = page.viewportSize();
	assert.ok(rect.x >= 0 && rect.x + rect.width <= viewport.width && rect.y >= 0 && rect.y + rect.height <= viewport.height, 'Bilingual checklist fits the viewport');
	await page.screenshot({ path: `artifacts/checklist-${mobile ? 'mobile' : 'desktop'}.png` });
	await frame.evaluate(() => window.__originalMessenger.events.emit('ui_quest_log_toggle'));
	await panel.waitFor({ state: 'hidden' });
}
async function placeAtPortal(frame, distance = 0, index = 0) {
	return frame.evaluate(async ({ distance, index }) => {
		const config = (await fetch('/original/portals.json').then((r) => r.json()))[index];
		const s = window.__originalMessenger.controller.currentScene, m = s.characters.mesh;
		const dir = m._localObject.position.clone().set(...config.direction).normalize();
		const ray = m._collisionPhysics._rayCaster;
		ray.set(dir.clone().multiplyScalar(100), dir.clone().negate());
		const hit = ray.intersectObject(m._collisionPhysics._collider)[0];
		const tangent = dir.clone().set(0, 1, 0).projectOnPlane(dir).normalize();
		const target = hit.point.clone().addScaledVector(tangent, distance);
		m.setInitialPosition(target.toArray(), 0, Math.PI, target.clone().normalize().toArray());
		return { ground: hit.point.toArray(), radius: config.radius, npcs: s.npcs.length, hasSky: !!s.sky, hasBones: !!m._boneTexture, offline: !m._connection };
	}, { distance, index });
}
async function verifyPortalRestore(page, frame) {
	const link = frame.getByRole('link', { name: '访问个人分身 ↗' });
	await placeAtPortal(frame, 0, 1);
	await link.waitFor();
	assert.equal(await link.getAttribute('href'), 'https://second-me.zhihaojiang.com/');
	assert.equal(await link.getAttribute('target'), '_blank');
	assert.equal(await frame.locator('.project-marker').nth(1).innerText(), '个人分身 · 书店旁');
	// Exercise repeated BFCache lifecycle events, including movement while updates are paused.
	for (let visit = 0; visit < 2; visit++) {
		await frame.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true })));
		await link.waitFor({ state: 'hidden' });
		await placeAtPortal(frame, 6, 1);
		await frame.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true })));
		await page.waitForTimeout(200);
		await link.waitFor({ state: 'hidden' });
		await placeAtPortal(frame, 0, 1);
		await link.waitFor();
		await placeAtPortal(frame, 6, 1);
		await link.waitFor({ state: 'hidden' });
		await placeAtPortal(frame, 0, 1);
		await link.waitFor();
	}
	await page.screenshot({ path: 'artifacts/second-me-restored.png' });
	console.log('Personal avatar portal passed: labels, destination and proximity updates after repeated page restores.');
}
async function verifyNewTabPortals(page, frame) {
	const gameUrl = page.url();
	for (const [index, url, label] of [
		[0, 'https://blog.zhihaojiang.com/', '访问博客 ↗'],
		[1, 'https://second-me.zhihaojiang.com/', '访问个人分身 ↗']
	]) {
		await placeAtPortal(frame, 0, index);
		const link = frame.getByRole('link', { name: label });
		await link.waitFor();
		await page.context().route(`${url}**`, route => route.fulfill({ contentType: 'text/html', body: '<h1>Portal destination</h1>' }));
		const popupReady = page.waitForEvent('popup');
		await link.click();
		const popup = await popupReady;
		await popup.waitForURL(url);
		assert.equal(await popup.getByRole('heading').innerText(), 'Portal destination');
		assert.equal(page.url(), gameUrl, 'Opening a portal preserves the game page');
		assert.equal(await popup.evaluate(() => window.opener), null);
		await popup.close();
		await placeAtPortal(frame, 6, index);
		await link.waitFor({ state: 'hidden' });
	}
	console.log('Both portals open in new tabs; game page and proximity updates remain active.');
}
try {
	const { context, page, frame } = await start({ width: 1440, height: 950 });
	const before = await frame.evaluate(() => window.__originalMessenger.controller.currentScene.characters.mesh._localObject.position.toArray());
	await page.keyboard.down('w'); await page.waitForTimeout(900); await page.keyboard.up('w');
	const after = await frame.evaluate(() => window.__originalMessenger.controller.currentScene.characters.mesh._localObject.position.toArray());
	assert.ok(Math.hypot(...after.map((n, i) => n - before[i])) > 0.1, 'The original character walks using the keyboard');
	await page.screenshot({ path: 'artifacts/original-desktop.png' });
	await verifyNPCs(page, frame);
	await verifyChecklist(page, frame, false, true);
	await verifyPortalRestore(page, frame);
	const info = await placeAtPortal(frame);
	assert.equal(info.npcs, 20); assert.ok(info.hasSky && info.hasBones && info.offline);
	const link = frame.getByRole('link', { name: '访问博客 ↗' });
	await link.waitFor({ timeout: 10000 });
	assert.equal(await link.getAttribute('href'), 'https://blog.zhihaojiang.com/');
	assert.equal(await link.getAttribute('target'), '_blank');
	await page.waitForTimeout(3000);
	await page.screenshot({ path: 'artifacts/original-cottage.png' });
	await placeAtPortal(frame, 5);
	await link.waitFor({ state: 'hidden', timeout: 10000 });
	assert.equal(new URL(page.url()).origin, new URL(origin).origin, 'Entering and leaving does not navigate');
	await placeAtPortal(frame);
	await link.waitFor();
	await verifyNewTabPortals(page, frame);
	await context.close();
	console.log('Desktop passed: original intro, player movement, 20 NPCs, skinning, sky, offline play, cottage proximity and explicit new-tab portal navigation.');

	const mobile = await start({ width: 390, height: 844 }, true);
	await verifyChecklist(mobile.page, mobile.frame, true);
	await placeAtPortal(mobile.frame);
	await mobile.frame.getByRole('link', { name: '访问博客 ↗' }).waitFor();
	await mobile.page.waitForTimeout(3000);
	await mobile.page.screenshot({ path: 'artifacts/original-mobile.png' });
	const rect = await mobile.frame.locator('#project-entry').boundingBox();
	assert.ok(rect.x >= 0 && rect.x + rect.width <= 390 && rect.y + rect.height <= 844, 'The mobile project entry fits the viewport');
	await mobile.context.close();
	assert.deepEqual(errors, []); assert.deepEqual(failed, []); assert.deepEqual(external, []); assert.deepEqual(sockets, []);
	console.log('Mobile passed. No browser exceptions, HTTP failures, remote resource requests or multiplayer connections.');
} catch (error) {
	if (activePage && !activePage.isClosed()) await activePage.screenshot({ path: 'artifacts/dialogue-failure.png' });
	console.error({ errors, failed, external, sockets });
	throw error;
} finally { await browser.close(); }
