#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const defaultConfig = fileURLToPath(new URL('../../../src/lib/original/portals.json', import.meta.url));

function usage() {
	console.log(`Usage: node add-portal.mjs --id <slug> --title <text> --location <text> --url <url> --direction <x,y,z>

Options:
  --config <path>     Override portals.json path
  --radius <number>   Interaction radius (default: 2.5)
  --same-tab          Navigate the top-level page instead of opening a new tab
  --dry-run           Print the proposed JSON without writing
  --help              Show this help`);
}

function parseArgs(argv) {
	const result = { config: defaultConfig, radius: 2.5, openInNewTab: true, dryRun: false };
	for (let index = 0; index < argv.length; index++) {
		const key = argv[index];
		if (key === '--help') result.help = true;
		else if (key === '--same-tab') result.openInNewTab = false;
		else if (key === '--dry-run') result.dryRun = true;
		else if (['--id', '--title', '--location', '--url', '--direction', '--config', '--radius'].includes(key)) {
			const value = argv[++index];
			if (value === undefined) throw new Error(`Missing value for ${key}`);
			result[key.slice(2)] = value;
		} else throw new Error(`Unknown option: ${key}`);
	}
	return result;
}

function normalizedDirection(value) {
	const direction = value.replace(/^\s*\[/, '').replace(/\]\s*$/, '').split(',').map(Number);
	if (direction.length !== 3 || !direction.every(Number.isFinite)) {
		throw new Error('Direction must contain exactly three finite comma-separated numbers.');
	}
	const length = Math.hypot(...direction);
	if (length === 0) throw new Error('Direction cannot be the zero vector.');
	return direction.map((component) => Number((component / length).toFixed(8)));
}

function canonicalUrl(value) {
	const url = new URL(value);
	if (!['http:', 'https:'].includes(url.protocol)) throw new Error('URL must use http or https.');
	return url.href;
}

function render(portals) {
	const entries = portals.map((portal) => [
		'  {',
		`    "id": ${JSON.stringify(portal.id)},`,
		`    "title": ${JSON.stringify(portal.title)},`,
		`    "location": ${JSON.stringify(portal.location)},`,
		`    "url": ${JSON.stringify(portal.url)},`,
		`    "direction": [${portal.direction.join(', ')}],`,
		`    "radius": ${portal.radius},`,
		`    "openInNewTab": ${portal.openInNewTab}`,
		'  }'
	].join('\n'));
	return `[\n${entries.join(',\n')}\n]\n`;
}

let options;
try {
	options = parseArgs(process.argv.slice(2));
	if (options.help) {
		usage();
		process.exit(0);
	}
	for (const key of ['id', 'title', 'location', 'url', 'direction']) {
		if (!options[key]?.trim()) throw new Error(`Missing required option: --${key}`);
	}
	if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(options.id)) {
		throw new Error('ID must be a lowercase kebab-case slug.');
	}
	const radius = Number(options.radius);
	if (!Number.isFinite(radius) || radius <= 0) throw new Error('Radius must be a positive number.');
	const url = canonicalUrl(options.url);
	const portals = JSON.parse(await readFile(options.config, 'utf8'));
	if (!Array.isArray(portals)) throw new Error('Portal configuration must be a JSON array.');
	if (portals.some((portal) => portal.id === options.id)) throw new Error(`Duplicate portal ID: ${options.id}`);
	if (portals.some((portal) => canonicalUrl(portal.url) === url)) throw new Error(`Duplicate portal URL: ${url}`);
	portals.push({
		id: options.id,
		title: options.title,
		location: options.location,
		url,
		direction: normalizedDirection(options.direction),
		radius,
		openInNewTab: options.openInNewTab
	});
	const output = render(portals);
	if (options.dryRun) process.stdout.write(output);
	else {
		await writeFile(options.config, output);
		console.log(`Added portal ${options.id} at index ${portals.length - 1}: ${url}`);
	}
} catch (error) {
	console.error(`add-portal: ${error.message}`);
	usage();
	process.exitCode = 1;
}

