import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';

// Start pnpm dev first. Use PLAYWRIGHT_CHANNEL=chrome for an installed Chrome.
const origin = process.argv[2] ?? 'http://127.0.0.1:5173/prototype';
const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || undefined });
await mkdir('artifacts', { recursive: true });
const errors = [];
const listen = (page) => page.on('pageerror', (error) => errors.push(error.message));
async function ready(page) {
	await page.goto(`${origin}/?debug`);
	await page.getByRole('button', { name: '回到小屋附近的起点' }).waitFor({ timeout: 60000 });
}
async function enterArea(page, key = 'w') {
	await page.keyboard.down(key);
	try { await page.getByRole('link', { name: '访问博客' }).waitFor({ timeout: 10000 }); }
	finally { await page.keyboard.up(key); }
}
async function coordinates(page) { return page.locator('.coordinates').innerText(); }

try {
	const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
	listen(page);
	await ready(page);
	assert.equal(await page.getByRole('link', { name: '访问博客' }).count(), 0, 'Entry is hidden outside the area');
	const start = await coordinates(page);
	await page.mouse.click(720, 660);
	await page.waitForTimeout(300);
	assert.notEqual(await coordinates(page), start, 'Clicking nearby ground moves the character');
	await page.getByRole('button', { name: '回到小屋附近的起点' }).click();
	await enterArea(page);
	assert.notEqual(await coordinates(page), start, 'W moves the character');
	const entry = page.getByRole('link', { name: '访问博客' });
	assert.equal(await entry.getAttribute('href'), 'https://blog.zhihaojiang.com/');
	assert.equal(await entry.getAttribute('target'), '_self');
	await page.screenshot({ path: 'artifacts/portal-desktop.png' });
	await page.keyboard.down('s');
	await entry.waitFor({ state: 'hidden' });
	await page.keyboard.up('s');
	assert.equal(await entry.count(), 0, 'Leaving the area hides the entry');

	await page.getByRole('button', { name: '回到小屋附近的起点' }).click();
	await page.waitForTimeout(150);
	assert.equal(await coordinates(page), start, 'Reset returns to the same spawn');
	await enterArea(page, 'ArrowUp');
	await page.keyboard.down('w');
	await page.waitForTimeout(120);
	await page.evaluate(() => window.dispatchEvent(new Event('blur')));
	await page.waitForTimeout(150);
	const stopped = await coordinates(page);
	await page.waitForTimeout(300);
	assert.equal(await coordinates(page), stopped, 'Losing focus stops movement');
	await page.keyboard.up('w');
	assert.equal(new URL(page.url()).origin, new URL(origin).origin, 'Walking never navigates automatically');

	// Check an actual click navigation while intercepting the destination (no external request).
	await page.route('https://blog.zhihaojiang.com/**', (route) => route.fulfill({ contentType: 'text/html', body: '<h1>Blog destination</h1>' }));
	await entry.click();
	await page.waitForURL('https://blog.zhihaojiang.com/');
	assert.equal(await page.getByRole('heading').innerText(), 'Blog destination');
	await page.close();

	const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
	listen(mobile);
	await ready(mobile);
	const up = mobile.getByRole('button', { name: '向前移动', exact: true });
	assert.ok(await up.isVisible(), 'Touch controls are visible on mobile');
	const button = await up.boundingBox();
	const touch = await mobile.context().newCDPSession(mobile);
	await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: button.x + button.width / 2, y: button.y + button.height / 2 }] });
	await mobile.getByRole('link', { name: '访问博客' }).waitFor({ timeout: 10000 });
	await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
	await mobile.waitForTimeout(150);
	const touchStop = await coordinates(mobile);
	await mobile.waitForTimeout(200);
	assert.equal(await coordinates(mobile), touchStop, 'Releasing a direction button stops movement');
	await mobile.screenshot({ path: 'artifacts/portal-mobile.png' });
	const linkBox = await mobile.getByRole('link', { name: '访问博客' }).boundingBox();
	assert.ok(linkBox.x >= 0 && linkBox.x + linkBox.width <= 390 && linkBox.y + linkBox.height <= 844, 'Mobile entry stays within the viewport');
	await mobile.close();

	// A failed WebGL context must still leave a usable project link.
	const fallback = await browser.newPage();
	listen(fallback);
	await fallback.addInitScript(() => {
		const original = HTMLCanvasElement.prototype.getContext;
		HTMLCanvasElement.prototype.getContext = function (type, ...args) {
			return /webgl/.test(type) ? null : original.call(this, type, ...args);
		};
	});
	await fallback.goto(origin);
	await fallback.getByText('场景加载失败，请刷新重试。').waitFor();
	assert.equal(await fallback.getByRole('link', { name: '博客 ↗' }).getAttribute('href'), 'https://blog.zhihaojiang.com/');
	await fallback.close();
	assert.deepEqual(errors, [], 'No uncaught browser errors');
	console.log('Passed: keyboard movement, proximity enter/leave, deterministic reset, focus loss, explicit blog navigation, mobile controls/layout, WebGL fallback.');
} finally {
	await browser.close();
}
