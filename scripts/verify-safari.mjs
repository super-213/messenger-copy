import assert from 'node:assert/strict';
import { webkit, devices } from 'playwright';

const origin = process.argv[2] ?? 'http://127.0.0.1:4173';
const browser = await webkit.launch();
const errors = [], failures = [], requested = new Set();
try {
	const context = await browser.newContext({ ...devices['iPhone 13'] });
	const page = await context.newPage();
	page.on('pageerror', (error) => errors.push(error.message));
	page.on('response', (response) => {
		requested.add(new URL(response.url()).pathname);
		if (response.status() >= 400) failures.push(`${response.status()} ${response.url()}`);
	});
	page.on('requestfailed', (request) => failures.push(`${request.failure()?.errorText} ${request.url()}`));
	await page.goto(origin);
	const body = await page.frameLocator('iframe').locator('body').elementHandle();
	const frame = await body.ownerFrame();
	await frame.waitForFunction(() => window.__originalMessenger?.controller.state === 'intro', null, { timeout: 60000 });
	console.log('iPhone intro ready');
	await page.waitForTimeout(7000);
	const viewport = page.viewportSize();
	await page.touchscreen.tap(viewport.width / 2, viewport.height * 0.868);
	await frame.waitForFunction(() => window.__originalMessenger?.controller.state === 'present', null, { timeout: 90000 });
	await frame.locator('#localized-dialogue').waitFor({ state: 'visible', timeout: 30000 });
	assert.ok(requested.has('/original/assets/geometries/planets/present/low/full_0.drc'), 'iPhone terrain branch was exercised');
	assert.ok(requested.has('/original/assets/audio/music/bgmusic-mobile.mp3'), 'Safari MP3 branch was exercised');
	assert.deepEqual(errors, []);
	assert.deepEqual(failures, []);
	console.log('WebKit with iPhone 13 profile: touch start, low-memory terrain, MP3 audio and opening dialogue passed.');
} finally {
	console.log({ errors, failures });
	await browser.close();
}
