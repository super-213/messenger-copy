import { mkdir, readFile } from 'node:fs/promises';
import { chromium } from 'playwright';

// The editable SVG is also the site's favicon; generated PNGs are committed so
// normal builds do not need a browser or an image-processing dependency.
const svg = await readFile(new URL('../src/lib/assets/favicon.svg', import.meta.url), 'utf8');
const directory = new URL('../static/icons/', import.meta.url);
await mkdir(directory, { recursive: true });
const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || undefined });
try {
	for (const size of [180, 192, 512]) {
		const page = await browser.newPage({ viewport: { width: size, height: size }, deviceScaleFactor: 1 });
		await page.setContent(`<style>html,body{margin:0}svg{display:block;width:100vw;height:100vh}</style>${svg}`);
		await page.screenshot({ path: new URL(size === 180 ? 'apple-touch-icon.png' : `icon-${size}.png`, directory).pathname });
		await page.close();
	}
} finally {
	await browser.close();
}
