import { createHash } from 'node:crypto';

function pinnedRegion(code, start, end, expectedHash) {
	if (start < 0 || end < 0) throw new Error('Original startup integration seam was not found.');
	const source = code.slice(start, end);
	if (createHash('sha256').update(source).digest('hex') !== expectedHash) {
		throw new Error('Original startup animation changed. Review the transition integration before upgrading.');
	}
	return source;
}

// Apply checked, narrowly scoped seams to the pinned original bundle. A source
// update must fail the build instead of silently leaving timings half patched.
export function optimizeOriginalStartup(code, replaceChecked) {
	const start = code.indexOf('async switchToPresent(){');
	const end = code.indexOf('async initIntro(){', start);
	code = replaceChecked(code, pinnedRegion(code, start, end, '870afbe666fd59edebc3871c86eacd7ef753f63d6c56761a2501843f4a67d39a'), `async switchToPresent(){
		if(!this.sceneComposers.intro)return;
		stopGameplayPrefetch();
		events.emit("toggle_loader",!0);
		await Promise.all([this.currentScene.playOutAnimation(),createTween(this.material.uniforms.uWipe2,{to:{value:1},duration:motionTime(.3),ease:"power2.inOut"})]);
		this.sceneComposers.intro.dispose();delete this.sceneComposers.intro;
		if(client$1.lowMemoryDevice)await createDelayedCall(.35);
		this.material.uniforms.uWipe1.value=1;this.material.uniforms.uWipe2.value=0;
		global$1.adaptiveDPR.stop();await this.initPresent();global$1.adaptiveDPR.start();
		events.emit("toggle_loader",!1);
		await Promise.all([this.currentScene.playInAnimation(),createTween(this.material.uniforms.uWipe1,{to:{value:0},duration:motionTime(.5),ease:"inOut1"})])
	}`);
	code = replaceChecked(code,
		'this.currentScene.playInAnimation().then(()=>{})',
		'this.currentScene.playInAnimation().then(()=>{}),prefetchGameplay(client$1.lowMemoryDevice)');

	const outStart = code.indexOf('async playOutAnimation(){this.button.interaction.disable()');
	const outEnd = code.indexOf('dispose(){this.___disposed', outStart);
	code = replaceChecked(code, pinnedRegion(code, outStart, outEnd, '4d6aad4bf154026f5efa3845cfcca11a0b578d70ac0537ac43246ae9bac4cb9b'), `async playOutAnimation(){
		this.button.interaction.disable();this.title.interaction.disable();this.button.spinOut(0);
		createTween(this.camera,{to:{autoRotateSpeed:0},duration:motionTime(.25),ease:"power2.inOut",onUpdate:()=>{if(!this.___disposed)this.camera.touchAmount=this.camera.autoRotateSpeed}});
		createTween(this.camera._sphericalTarget,{to:{theta:this.camera._sphericalTarget.theta-Math.PI*.25,phi:1.7,radius:40},duration:motionTime(.25),ease:"inOut1"});
		createTween(this._outRotation,{to:{value:Math.PI*-.25},duration:motionTime(.25),ease:"inOut1"});
		this.button.playOutAnimation(0);this.title.playOutAnimation(0);
		createDelayedCall(motionTime(.05),()=>{events.emit("webgl_play_audio","whoosh")})
	}`);
	code = replaceChecked(code,
		'this.groupAnim.rotation.x+Math.PI*-2},duration:1.5,delay:0',
		'this.groupAnim.rotation.x+Math.PI*-2},duration:motionTime(.25),delay:0');
	code = replaceChecked(code,
		'createDelayedCall(.3,()=>{events.emit("webgl_play_audio","button-out")})',
		'createDelayedCall(motionTime(.05),()=>{events.emit("webgl_play_audio","button-out")})');
	code = replaceChecked(code, 'duration:s?2:3.25', 'duration:motionTime(s?0.65:0.9)');
	code = replaceChecked(code,
		'this.characters.mesh.interactingElement="intro",await miscutils.wait(1),await introDialogue()',
		'this.characters.mesh.interactingElement="intro",await miscutils.wait(motionTime(.15)),await introDialogue()');
	code = replaceChecked(code,
		'createTween(this.camera,{to:{touchAmount:i},duration:4})',
		'createTween(this.camera,{to:{touchAmount:i},duration:motionTime(.9)})');
	code = replaceChecked(code,
		'await createDelayedCall(2,()=>{this.characters.enable()})',
		'await createDelayedCall(motionTime(.9),()=>{this.characters.enable()})');
	return 'import { prefetchGameplay, stopGameplayPrefetch, motionTime } from "../startup.js";\n' + code;
}

export function gameplayPrefetchManifest(files) {
	const result = { common: [], low: [], standard: [] };
	const paths = files.map((entry) => entry.path.replaceAll('\\', '/'));
	for (const file of paths) {
		if (file.endsWith('.drc')) {
			if (file.includes('/intro/')) continue;
			const group = file.includes('/low/') ? 'low' :
				/^assets\/geometries\/planets\/present\/(full|tree-leaves)/.test(file) ? 'standard' : 'common';
			result[group].push(`/original/${file}`);
		} else if (/\.(ktx2|avif|icon)$/.test(file) || /\/(collisionworker|charactergeoworker)-[^/]+\.js$/.test(file)) {
			result.common.push(`/original/${file}`);
		}
	}
	// Get collision meshes and textures moving first, followed by NPCs/props.
	const rank = (url) => url.includes('hitmesh') ? 0 : url.endsWith('.ktx2') ? 1 : url.endsWith('.js') ? 2 : url.endsWith('.drc') ? 3 : 4;
	for (const urls of Object.values(result)) urls.sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
	return result;
}
