import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { chromium, webkit, devices } from 'playwright';

const origin = new URL(process.argv[2] ?? 'http://127.0.0.1:4173').origin;
const portals = JSON.parse(await readFile(new URL('../src/lib/original/portals.json', import.meta.url), 'utf8'));
const dialogues = JSON.parse(await readFile(new URL('../src/lib/original/dialogues.json', import.meta.url), 'utf8'));
const useWebKit = process.env.PORTAL_LINK_ENGINE === 'webkit';
const browser = await (useWebKit ? webkit : chromium).launch(useWebKit ? {} : { channel: process.env.PLAYWRIGHT_CHANNEL || undefined });

async function enterGame(page) {
	await page.goto(origin);
	const body = await page.frameLocator('iframe').locator('body').elementHandle();
	const frame = await body.ownerFrame();
	await frame.waitForFunction(() => window.__originalMessenger?.controller.state === 'intro', null, { timeout: 60000 });
	await page.waitForTimeout(7000);
	const viewport = page.viewportSize();
	await page.touchscreen.tap(viewport.width / 2, viewport.height * 0.868);
	await frame.waitForFunction(() => window.__originalMessenger?.controller.state === 'present', null, { timeout: 90000 });
	for (const text of dialogues.intro.texts) {
		await frame.waitForFunction((line) => document.querySelector('#localized-speech')?.textContent === line && !document.querySelector('#localized-dialogue').hidden, text);
		await frame.getByRole('button', { name: '继续对话' }).tap();
		await page.waitForTimeout(400);
	}
	await frame.waitForFunction(() => !window.__originalMessenger.controller.currentScene.characters.mesh.interactingElement);
	return frame;
}

async function placeAtPortal(frame, index) {
	await frame.evaluate(async (index) => {
		const config = (await fetch('/original/portals.json').then((response) => response.json()))[index];
		const scene = window.__originalMessenger.controller.currentScene;
		const player = scene.characters.mesh;
		const direction = player._localObject.position.clone().set(...config.direction).normalize();
		const ray = player._collisionPhysics._rayCaster;
		ray.set(direction.clone().multiplyScalar(100), direction.clone().negate());
		const target = ray.intersectObject(player._collisionPhysics._collider)[0].point;
		player.setInitialPosition(target.toArray(), 0, Math.PI, target.clone().normalize().toArray());
	}, index);
}

try {
	for (const mode of ['browser', 'standalone', 'ios-standalone']) {
		const context = await browser.newContext({ ...devices['iPhone 13'], serviceWorkers: 'block' });
		const errors = [];
		try {
			// Playwright cannot install an iOS Home Screen app. Emulate only the
			// top-level display signal; interactions and navigation use the real game.
			await context.addInitScript((mode) => {
				if (window !== window.top) return;
				if (mode === 'ios-standalone') Object.defineProperty(navigator, 'standalone', { get: () => true });
				if (mode === 'standalone') {
					const matchMedia = window.matchMedia.bind(window);
					window.matchMedia = (query) => {
						const result = matchMedia(query);
						if (query === '(display-mode: standalone)') Object.defineProperty(result, 'matches', { value: true });
						return result;
					};
				}
			}, mode);
			// All destination pages are local test responses; never visit user sites.
			await context.route('**/*', (route) => {
				const url = new URL(route.request().url());
				if (url.origin === origin) return route.continue();
				if (portals.some((portal) => url.href === new URL(portal.url).href)) {
					return route.fulfill({ contentType: 'text/html', body: '<h1>Portal destination</h1>' });
				}
				return route.abort();
			});
			const page = await context.newPage();
			page.on('pageerror', (error) => errors.push(error.message));
			const frame = await enterGame(page);
			// In browser mode, exercise every configured portal with real touch.
			// Each standalone signal also exercises a top-level external navigation.
			const indexes = mode === 'browser' ? portals.map((_, index) => index) : [mode === 'standalone' ? 0 : 1];
			for (const index of indexes) {
				const portal = portals[index];
				const url = new URL(portal.url).href;
				await placeAtPortal(frame, index);
				const link = frame.getByRole('link', { name: `访问${portal.title} ↗` });
				await link.waitFor();
				assert.equal(await link.getAttribute('href'), url);
				assert.equal(await link.getAttribute('target'), mode === 'browser' ? '_blank' : '_top');
				if (mode === 'browser') {
					const popupReady = page.waitForEvent('popup', { timeout: 10000 });
					await link.tap();
					const popup = await popupReady;
					await popup.waitForURL(url);
					assert.equal(await popup.getByRole('heading').innerText(), 'Portal destination');
					assert.equal(await popup.evaluate(() => window.opener), null);
					assert.equal(new URL(page.url()).origin, origin);
					await popup.close();
				} else {
					await Promise.all([page.waitForURL(url, { timeout: 10000 }), link.tap()]);
					assert.equal(await page.getByRole('heading').innerText(), 'Portal destination');
					assert.equal(context.pages().length, 1, 'Standalone link does not depend on a new popup window');
				}
			}
			assert.deepEqual(errors, []);
			console.log(`${useWebKit ? 'WebKit' : 'Chromium'} ${mode}: real touch opened ${indexes.length} project links successfully.`);
		} finally {
			await context.close();
		}
	}
} finally {
	await browser.close();
}
