import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const origin = new URL(process.argv[2] ?? 'http://127.0.0.1:4173').origin;
const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || undefined });
try {
	for (const fallback of [false, true]) {
		const context = await browser.newContext({ serviceWorkers: 'block' });
		try {
			const page = await context.newPage();
			const errors = [];
			page.on('pageerror', (error) => errors.push(error.message));
			await page.goto(`${origin}/robots.txt`);
			await page.evaluate(async (fallback) => {
				if (fallback) Object.defineProperty(PerformanceObserver, 'supportedEntryTypes', { value: [] });
				const { createPerformanceMonitor } = await import('/original/performance.js');
				window.testMonitor = createPerformanceMonitor();
				window.testMonitor.mark('detail-open', 'blog', true);
				function frame(time) {
					window.testMonitor.frame(time, 'present', 'blog', true);
					requestAnimationFrame(frame);
				}
				requestAnimationFrame(frame);
			}, fallback);
			await page.waitForTimeout(100);
			await page.evaluate(() => {
				window.__messengerPerformance.reset();
				window.testMonitor.mark('detail-open', 'blog', true);
			});
			// Start a fresh rendering interval after reset; an already-started frame
			// belongs to the previous measurement even if it ends after reset.
			await page.waitForTimeout(100);
			await page.evaluate(() => {
				requestAnimationFrame(() => {
					const end = performance.now() + 110;
					while (performance.now() < end) { /* Deliberate main-thread stall to verify real browser data. */ }
					document.body.style.backgroundColor = '#f8f8f8';
				});
			});
			await page.waitForFunction(() => window.__messengerPerformance.snapshot().count > 0, null, { timeout: 10000 });
			const snapshot = await page.evaluate(() => window.__messengerPerformance.snapshot());
			assert.equal(snapshot.mode, fallback ? 'frame-gap' : 'long-animation-frame');
			assert.ok(snapshot.worstMs >= 100, 'Records an actual main-thread stall');
			assert.ok(snapshot.samples.some((sample) => sample.phase === 'present' && sample.portal === 'blog' && sample.panelOpen));
			if (fallback) assert.equal(snapshot.blockingMs, null, 'Frame gaps are never presented as main-thread blocking');
			else assert.ok(snapshot.samples.some((sample) => sample.scripts.some((script) => script.duration > 0)), 'LoAF includes script attribution');
			const downloadReady = page.waitForEvent('download');
			await page.evaluate(() => window.__messengerPerformance.download());
			const download = await downloadReady;
			assert.equal(download.suggestedFilename(), 'messenger-performance.json');
			const exported = JSON.parse(await readFile(await download.path(), 'utf8'));
			assert.ok(exported.samples.length > 0);
			assert.ok(exported.samples.every((sample) => sample.scripts.every((script) => !script.file.includes('?') && !script.file.includes('://'))));
			await page.evaluate(() => {
				window.__messengerPerformance.reset();
				window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true }));
			});
			await page.waitForTimeout(200);
			await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true })));
			await page.waitForTimeout(100);
			const restored = await page.evaluate(() => window.__messengerPerformance.snapshot());
			assert.equal(restored.count, 0, 'Hidden/restored time is excluded, and old buffered LoAF entries are not replayed');
			if (fallback) {
				const bounded = await page.evaluate(() => {
					window.__messengerPerformance.reset();
					const start = performance.now();
					for (let i = 0; i < 150; i++) {
						window.testMonitor.frame(start + i * 60, 'present', 'blog', false);
						window.testMonitor.mark('detail-open', 'blog', true);
					}
					return window.__messengerPerformance.snapshot();
				});
				assert.equal(bounded.count, 149);
				assert.equal(bounded.samples.length, 120);
				assert.equal(bounded.marks.length, 120);
			}
			assert.deepEqual(errors, []);
			console.log(`${snapshot.mode}: actual stall, context, JSON export, reset, bounded storage and restore checks passed.`);
		} finally { await context.close(); }
	}
} finally { await browser.close(); }
