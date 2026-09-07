import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
import { localizeDialogues } from './localize-dialogues.mjs';
const original = await readFile(new URL('../reference/messenger.abeto.co/assets/App3D-BLRWK1h9.js', import.meta.url), 'utf8');
const config = JSON.parse(await readFile(new URL('../src/lib/original/dialogues.json', import.meta.url), 'utf8'));
const reference = JSON.parse(await readFile(new URL('../docs/dialogues.original.json', import.meta.url), 'utf8'));

test('all 20 NPCs and 5 quest lines are configured; patched bundle is valid JS', () => {
	assert.deepEqual(Object.keys(config.npcs), Object.keys(reference.npcs));
	assert.deepEqual(Object.keys(config.quests), Object.keys(reference.quests));
	const code = localizeDialogues(original, config);
	assert.equal(ts.createSourceFile('patched.js', code, 99, true, 1).parseDiagnostics.length, 0);
	assert.ok(code.includes(JSON.stringify(config.intro.texts)));
	for (const npc of Object.values(config.npcs)) assert.ok(code.includes(JSON.stringify(npc.texts)));
	for (const quest of Object.values(config.quests)) for (const step of quest.steps) assert.ok(code.includes(JSON.stringify(step.texts)));
});
test('editable line counts and literal markup are safe while quest routing stays intact', () => {
	const custom = structuredClone(config);
	custom.intro.texts = ['欢迎来到我的网站！', '<script>alert("test")</script>\n第二行', '去小屋旁访问博客吧。', '现在出发！'];
	custom.quests['quest-employee'].steps[0].texts = ['自定义一句任务对白。'];
	const code = localizeDialogues(original, custom);
	assert.ok(code.includes(JSON.stringify(custom.intro.texts)));
	assert.ok(code.includes('id:"office-worker-2",ordered:!0,optional:!1,texts:["自定义一句任务对白。"]'));
});
test('invalid text, missing/unknown NPCs and altered quest steps fail loudly', () => {
	for (const mutate of [
		(c) => { c.intro.texts = []; },
		(c) => { c.quests['quest-employee'].label = ''; },
		(c) => { delete c.quests['quest-employee'].labelEn; },
		(c) => { c.npcs.boss.texts = 'not an array'; },
		(c) => { delete c.npcs.boss; },
		(c) => { c.npcs.typo = c.npcs.boss; },
		(c) => { c.quests['quest-scientists'].steps.reverse(); },
		(c) => { c.quests['quest-caveman'].steps[1].npcId = 'boss'; },
		(c) => { c.quests['quest-temple'].steps.pop(); }
	]) {
		const invalid = structuredClone(config); mutate(invalid);
		assert.throws(() => localizeDialogues(original, invalid));
	}
});
