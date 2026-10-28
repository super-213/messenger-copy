import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { chromium, devices } from 'playwright';

const origin = new URL(process.argv[2] ?? 'http://127.0.0.1:4173').origin;
const htmlResponse = await fetch(origin, { redirect: 'manual' });
assert.equal(htmlResponse.status, 200);
const html = await htmlResponse.text();
assert.match(html, /<iframe[^>]+src="\/original\/"/, 'The initial HTML already contains the game iframe');
assert.match(html, /src="\/pwa-register.js"/, 'The static homepage still registers its Service Worker');
assert.doesNotMatch(html, /__sveltekit|_app\/immutable\/entry\//, 'No framework startup is needed to show the game');
assert.equal((await fetch(`${origin}/original/`, { redirect: 'manual' })).status, 200, 'The canonical game URL has no redirect');
const dialogue = JSON.parse(await readFile(new URL('../src/lib/original/dialogues.json', import.meta.url), 'utf8'));
const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || undefined });
try {
	for (const mode of ['desktop', 'mobile', 'reduced-motion-prefetch-failure']) {
		const mobile = mode !== 'desktop';
		const context = await browser.newContext({
			...(mobile ? devices['iPhone 13'] : { viewport: { width: 1440, height: 950 } }),
			serviceWorkers: 'block',
			reducedMotion: mode.startsWith('reduced') ? 'reduce' : 'no-preference'
		});
		try {
			// A speculative prefetch failure must leave the normal game loader usable.
			if (mode.startsWith('reduced')) await context.route('**/gameplay-prefetch.json', (route) => route.fulfill({ status: 503, body: 'Offline prefetch unavailable' }));
			const page = await context.newPage();
			const errors = [];
			const requested = new Set();
			page.on('pageerror', (error) => errors.push(error.message));
			page.on('request', (request) => requested.add(new URL(request.url()).pathname));
			await page.goto(`${origin}/?debug`);
			const body = await page.frameLocator('iframe').locator('body').elementHandle();
			const frame = await body.ownerFrame();
			assert.equal(new URL(frame.url()).pathname, '/original/');
			await frame.waitForFunction(() => window.__originalMessenger?.controller.state === 'intro', null, { timeout: 60000 });
			await page.waitForTimeout(7000);
			assert.ok(requested.has('/original/gameplay-prefetch.json'));
			if (!mode.startsWith('reduced')) {
				assert.ok(requested.has(`/original/assets/geometries/planets/present/${mobile ? 'low/' : ''}full_0.drc`), 'Terrain is fetched before BEGIN');
				assert.ok(![...requested].some((path) => mobile ? /\/present\/full_\d+\.drc$/.test(path) : /\/present\/low\//.test(path)), 'Prefetch uses only this device terrain variant');
			}
			assert.equal(await frame.evaluate(() => window.__originalMessenger.controller.planetScene), null, 'Prefetch never constructs a second scene');
			await frame.evaluate(() => {
				const profile = window.__startupTest = {};
				const controller = window.__originalMessenger.controller;
				const original = controller.initPresent;
				controller.initPresent = async function (...args) {
					profile.initStart = performance.now();
					try { return await original.apply(this, args); } finally { profile.initEnd = performance.now(); }
				};
				addEventListener('pointerup', () => { profile.click = performance.now(); }, { once: true, capture: true });
			});
			const viewport = page.viewportSize();
			if (mobile) await page.touchscreen.tap(viewport.width / 2, viewport.height * 0.868);
			else await page.mouse.click(viewport.width / 2, viewport.height * 0.868, { delay: 100 });
			await frame.waitForFunction(() => window.__originalMessenger.controller.state === 'present', null, { timeout: 90000 });
			await frame.locator('#localized-dialogue').waitFor({ state: 'visible', timeout: 30000 });
			const times = await frame.evaluate(() => {
				const p = window.__startupTest;
				return { beforeInitMs: Math.round(p.initStart - p.click), initMs: Math.round(p.initEnd - p.initStart), toDialogueMs: Math.round(performance.now() - p.click) };
			});
			await frame.locator('.project-coordinates').waitFor({ state: 'visible' });
			// Complete the actual localized intro to verify the shorter camera tween
			// did not break interaction state or the handoff to keyboard controls.
			if (!mobile) {
				for (const text of dialogue.intro.texts) {
					await frame.waitForFunction((line) => document.querySelector('#localized-speech')?.textContent === line, text);
					await frame.getByRole('button', { name: '继续对话' }).click();
					await page.waitForTimeout(400);
				}
				await frame.waitForFunction(() => !window.__originalMessenger.controller.currentScene.characters.mesh.interactingElement);
				await frame.evaluate(() => window.focus());
				const position = () => frame.evaluate(() => window.__originalMessenger.controller.currentScene.characters.mesh._localObject.position.toArray());
				const before = await position();
				await page.keyboard.down('w');
				await page.waitForTimeout(600);
				await page.keyboard.up('w');
				const after = await position();
				assert.ok(Math.hypot(...after.map((n, i) => n - before[i])) > 0.1, 'The player can walk after the faster intro');
			}
			assert.deepEqual(errors, []);
			console.log(`${mode} startup passed: ${JSON.stringify(times)}`);
		} finally { await context.close(); }
	}
} finally { await browser.close(); }
