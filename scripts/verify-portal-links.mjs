import assert from 'node:assert/strict';
import { mkdir, readFile } from 'node:fs/promises';
import { chromium, webkit, devices } from 'playwright';

const origin = new URL(process.argv[2] ?? 'http://127.0.0.1:4173').origin;
const portals = JSON.parse(await readFile(new URL('../src/lib/original/portals.json', import.meta.url), 'utf8'));
const dialogues = JSON.parse(await readFile(new URL('../src/lib/original/dialogues.json', import.meta.url), 'utf8'));
const useWebKit = process.env.PORTAL_LINK_ENGINE === 'webkit';
const browser = await (useWebKit ? webkit : chromium).launch(useWebKit ? {} : { channel: process.env.PLAYWRIGHT_CHANNEL || undefined });
await mkdir('artifacts', { recursive: true });

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

async function placeAtPortal(frame, index, distance = 0) {
	await frame.evaluate(async ({ index, distance }) => {
		const config = (await fetch('/original/portals.json').then((response) => response.json()))[index];
		const scene = window.__originalMessenger.controller.currentScene;
		const player = scene.characters.mesh;
		const direction = player._localObject.position.clone().set(...config.direction).normalize();
		const ray = player._collisionPhysics._rayCaster;
		ray.set(direction.clone().multiplyScalar(100), direction.clone().negate());
		const target = ray.intersectObject(player._collisionPhysics._collider)[0].point.clone();
		const tangent = direction.clone().set(0, 1, 0).projectOnPlane(direction).normalize();
		target.addScaledVector(tangent, distance);
		player.setInitialPosition(target.toArray(), 0, Math.PI, target.clone().normalize().toArray());
	}, { index, distance });
}

try {
	for (const mode of ['desktop', 'browser', 'fallback', 'standalone', 'ios-standalone']) {
		const isBrowser = ['desktop', 'browser', 'fallback'].includes(mode);
		const context = await browser.newContext({
			...(mode === 'desktop' ? { viewport: { width: 1440, height: 950 }, hasTouch: true } : devices['iPhone 13']),
			serviceWorkers: 'block', reducedMotion: mode === 'fallback' ? 'reduce' : 'no-preference'
		});
		const errors = [];
		try {
			// Playwright cannot install an iOS Home Screen app. Emulate only the
			// top-level display signal; interactions and navigation use the real game.
			await context.addInitScript((mode) => {
				if (mode === 'fallback') {
					Object.defineProperty(HTMLElement.prototype, 'showPopover', { value: undefined });
					Object.defineProperty(document, 'startViewTransition', { value: undefined });
				}
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
			const indexes = isBrowser ? portals.map((_, index) => index) : [mode === 'standalone' ? 0 : 1];
			for (const index of indexes) {
				const portal = portals[index];
				const url = new URL(portal.url).href;
				await placeAtPortal(frame, index);
				const quickLink = frame.locator('#project-entry a');
				await quickLink.waitFor();
				const more = frame.getByRole('button', { name: '了解更多' });
				const detail = frame.locator('#project-detail');
				await more.tap();
				await detail.waitFor();
				assert.equal(await more.getAttribute('aria-expanded'), 'true');
				assert.equal(await detail.locator('h2').innerText(), portal.title);
				assert.equal(await detail.locator('#project-detail-description').innerText(), portal.description);
				assert.equal(await detail.locator('li').count(), portal.tags.length);
				assert.equal(await frame.locator('#project-performance').isVisible(), false, 'Diagnostics stay hidden for normal visits');
				const rect = await detail.boundingBox();
				const viewport = page.viewportSize();
				assert.ok(rect.x >= 0 && rect.y >= 0 && rect.x + rect.width <= viewport.width && rect.y + rect.height <= viewport.height, 'Detail stays within viewport');
				if (index === indexes[0]) {
					await detail.evaluate((element) => Promise.all(element.getAnimations({ subtree: true }).map((animation) => animation.finished.catch(() => {}))));
					await page.waitForTimeout(800);
					await page.screenshot({ path: `artifacts/portal-detail-${useWebKit ? 'webkit' : 'chromium'}-${mode}.png` });
					await more.tap();
					await detail.waitFor({ state: 'hidden' });
					await more.tap();
					await detail.waitFor();
					await placeAtPortal(frame, (index + 1) % portals.length);
					await detail.getByRole('heading', { name: portals[(index + 1) % portals.length].title, exact: true }).waitFor();
					await placeAtPortal(frame, index, 7);
					await detail.waitFor({ state: 'hidden' });
					await quickLink.waitFor({ state: 'hidden' });
					await placeAtPortal(frame, index);
					await quickLink.waitFor();
					await more.tap();
					await detail.waitFor();
					await page.keyboard.press('Escape');
					await detail.waitFor({ state: 'hidden' });
					assert.equal(await more.evaluate((button) => button === document.activeElement), true, 'Escape restores focus');
					await more.tap();
					await frame.getByRole('button', { name: '关闭建筑详情' }).tap();
					await detail.waitFor({ state: 'hidden' });
					await more.tap();
					await detail.waitFor();
					await page.touchscreen.tap(5, 5);
					await detail.waitFor({ state: 'hidden' });
					assert.equal(await more.getAttribute('aria-expanded'), 'false', 'Outside tap keeps expansion state in sync');
					await placeAtPortal(frame, index);
					await quickLink.waitFor();
					await more.tap();
					await detail.waitFor();
					await frame.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true })));
					await detail.waitFor({ state: 'hidden' });
					await frame.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true })));
					await quickLink.waitFor();
					await more.tap();
					await detail.waitFor();
				}
				const link = detail.getByRole('link', { name: `访问${portal.title} ↗` });
				await link.waitFor();
				assert.equal(await link.getAttribute('href'), url);
				assert.equal(await link.getAttribute('target'), isBrowser ? '_blank' : '_top');
				if (isBrowser) {
					const popupReady = page.waitForEvent('popup', { timeout: 10000 });
					await link.tap();
					const popup = await popupReady;
					await popup.waitForURL(url);
					assert.equal(await popup.getByRole('heading').innerText(), 'Portal destination');
					assert.equal(await popup.evaluate(() => window.opener), null);
					assert.equal(new URL(page.url()).origin, origin);
					await popup.close();
					if (await detail.isVisible()) await frame.getByRole('button', { name: '关闭建筑详情' }).tap();
					await detail.waitFor({ state: 'hidden' });
				} else {
					await Promise.all([page.waitForURL(url, { timeout: 10000 }), link.tap()]);
					assert.equal(await page.getByRole('heading').innerText(), 'Portal destination');
					assert.equal(context.pages().length, 1, 'Standalone link does not depend on a new popup window');
				}
			}
			assert.deepEqual(errors, []);
			console.log(`${useWebKit ? 'WebKit' : 'Chromium'} ${mode}: details, layout, focus, restoration and ${indexes.length} touch links passed.`);
		} finally {
			await context.close();
		}
	}
} finally {
	await browser.close();
}
