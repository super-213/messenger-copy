import ts from 'typescript';

// Edit structured literals, never replace every matching English word in the engine.
export function localizeDialogues(code, config) {
	const ast = ts.createSourceFile('original.js', code, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
	const get = (node, key) => node.properties.find((p) => p.name?.getText(ast) === key)?.initializer;
	const edits = [], seenNPCs = new Set(), seenQuests = new Set();
	let introCount = 0, introNameCount = 0, bubbleCount = 0;
	const replace = (node, value) => edits.push({ start: node.getStart(ast), end: node.end, text: JSON.stringify(value) });
	const validateTexts = (value, path, allowEmpty = false) => {
		if (!Array.isArray(value) || (!allowEmpty && !value.length) || value.some((s) => typeof s !== 'string')) throw new Error(`${path} must be ${allowEmpty ? 'an' : 'a non-empty'} array of strings.`);
	};
	if (!config || typeof config.intro?.name !== 'string' || !config.intro.name.trim() || !config.npcs || !config.quests) throw new Error('dialogues.json needs intro.name, intro.texts, npcs and quests.');
	validateTexts(config.intro.texts, 'intro.texts');
	function visit(node) {
		if (ts.isVariableDeclaration(node)) {
			const name = node.name.getText(ast);
			if (name === 'introTexts') { replace(node.initializer, config.intro.texts); introCount++; }
			if (name === 'introData') { replace(get(node.initializer, 'name'), config.intro.name); introNameCount++; }
			if (name === 'questData') {
				for (const quest of get(node.initializer, 'quests').elements) {
					const id = get(quest, 'id').text, translated = config.quests[id], steps = get(quest, 'steps').elements;
					if (!translated || translated.steps?.length !== steps.length) throw new Error(`Quest ${id}: preserve the original step count and order.`);
					seenQuests.add(id);
					steps.forEach((step, index) => {
						const entry = translated.steps[index];
						if (entry.npcId !== get(step, 'id').text) throw new Error(`Quest ${id} step ${index}: npcId must not change.`);
						validateTexts(entry.texts, `quests.${id}.steps[${index}].texts`);
						replace(get(step, 'texts'), entry.texts);
					});
				}
			}
		}
		if (ts.isObjectLiteralExpression(node) && get(node, 'position') && get(node, 'texts') && ts.isStringLiteral(get(node, 'id') ?? {})) {
			const id = get(node, 'id').text, npc = config.npcs[id];
			if (!npc || typeof npc.name !== 'string' || !npc.name.trim()) throw new Error(`NPC ${id}: missing a name.`);
			validateTexts(npc.texts, `npcs.${id}.texts`, true);
			seenNPCs.add(id);
			replace(get(node, 'texts'), npc.texts);
			replace(get(get(node, 'extraData'), 'name'), npc.name);
		}
		if (ts.isMethodDeclaration(node) && node.name.getText(ast) === '_createBubbles') {
			// Ambient speech still uses original events, timing and animations. DOM renders its Chinese text.
			edits.push({ start: node.body.getStart(ast), end: node.body.end, text: '{return Promise.resolve()}' });
			bubbleCount++;
		}
		ts.forEachChild(node, visit);
	}
	visit(ast);
	if (introCount !== 1 || introNameCount !== 1 || bubbleCount !== 1 || seenNPCs.size !== 20 || seenQuests.size !== 5) throw new Error('Original dialogue structure changed. Review the localization integration.');
	for (const id of Object.keys(config.npcs)) if (!seenNPCs.has(id)) throw new Error(`Unknown NPC id: ${id}`);
	for (const id of Object.keys(config.quests)) if (!seenQuests.has(id)) throw new Error(`Unknown quest id: ${id}`);
	for (const edit of edits.sort((a, b) => b.start - a.start)) code = code.slice(0, edit.start) + edit.text + code.slice(edit.end);
	return code;
}
