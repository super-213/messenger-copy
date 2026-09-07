import type { Object3D, PerspectiveCamera, Vector3 } from 'three';

type EventBus = {
	// The original engine's event bus has heterogeneous, positional event payloads.
	on(name: string, listener: (...args: any[]) => void): void;
	off(name: string, listener: (...args: any[]) => void): void;
	emit(name: string, ...args: unknown[]): void;
};
type NPC = { mesh: Object3D & { _id: string; boundingSphere: { radius: number }; _textsBubbleGroupOffset: Vector3 } };
type UIScene = { globalUI: { playBoxAudio(delay: number): void; controller: { planetScene?: { npcs: NPC[]; camera: PerspectiveCamera } } } };
type Speaker = { name?: string; color?: string; voice?: string };

/** Adapts the original dialogue event protocol to native text with full CJK support. */
export class LocalizedDialogue {
	ready = Promise.resolve();
	private root = document.createElement('section');
	private name = document.createElement('h2');
	private text = document.createElement('p');
	private next = document.createElement('button');
	private current: string | null = null;
	private last: string | null = null;
	private bubbles = new Map<string, HTMLElement>();
	private frame = 0;
	private voice: { name: string; mesh: NPC['mesh'] | null } | null = null;

	constructor(private scene: UIScene, private events: EventBus) {
		this.root.id = 'localized-dialogue';
		this.root.hidden = true;
		this.root.setAttribute('role', 'dialog');
		this.name.id = 'localized-speaker';
		this.text.id = 'localized-speech';
		this.root.setAttribute('aria-labelledby', this.name.id);
		this.root.setAttribute('aria-describedby', this.text.id);
		this.text.setAttribute('aria-live', 'polite');
		this.next.type = 'button';
		this.next.textContent = '继续 ▶';
		this.next.setAttribute('aria-label', '继续对话');
		this.next.addEventListener('click', this.advance);
		this.root.append(this.name, this.text, this.next);
		for (const type of ['pointerdown', 'pointerup', 'mousedown', 'mouseup', 'touchstart', 'touchend', 'click']) {
			this.root.addEventListener(type, (event) => event.stopPropagation());
		}
		document.body.append(this.root);
		// Capture dialogue keys so native player controls don't also receive Space/E.
		window.addEventListener('keydown', this.onKey, true);
		window.addEventListener('keyup', this.onKey, true);
		events.on('npc_dialog_open', this.show);
		events.on('npc_dialog_close', this.hide);
		events.on('npc_dialog_finished', this.hideFinal);
		events.on('npc_dialog_interrupted', this.hideFinal);
		this.frame = requestAnimationFrame(this.positionBubbles);
		window.addEventListener('pagehide', this.dispose, { once: true });
	}

	private show = (id: string, text: string, speaker: Speaker = {}, info: { bubblesEnabled?: boolean } = {}) => {
		if (info.bubblesEnabled) {
			if (!text?.trim()) return;
			let bubble = this.bubbles.get(id);
			if (!bubble) {
				bubble = document.createElement('p');
				bubble.className = 'localized-bubble';
				bubble.dataset.npcId = id;
				bubble.hidden = true;
				document.body.append(bubble);
				this.bubbles.set(id, bubble);
			}
			bubble.textContent = text;
			return;
		}
		this.stopVoice();
		this.current = this.last = id;
		this.root.dataset.npcId = id;
		this.name.textContent = speaker.name || '居民';
		this.text.textContent = text || '……';
		const color = speaker.color && CSS.supports('color', speaker.color) ? speaker.color : '#66bde6';
		this.root.style.setProperty('--speaker-color', color);
		this.root.hidden = false;
		this.scene.globalUI.playBoxAudio(0);
		const voice = `dialogue-${speaker.voice || 'male1'}`;
		const mesh = this.scene.globalUI.controller.planetScene?.npcs.find((npc) => npc.mesh._id === id)?.mesh;
		if (speaker.voice === 'quest') {
			this.events.emit('webgl_set_audio_volume', voice, 0.075);
			this.voice = { name: voice, mesh: null };
		} else if (mesh) {
			this.events.emit('webgl_play_positional', voice, mesh);
			this.voice = { name: voice, mesh };
		}
		this.events.emit('npc_dialog_shown', id);
	};

	private advance = () => {
		if (this.current !== null) this.events.emit('npc_force_next_dialog', this.current);
	};
	private onKey = (event: KeyboardEvent) => {
		if (this.current === null || !['Space', 'KeyE', 'Enter', 'Escape'].includes(event.code)) return;
		event.preventDefault();
		event.stopImmediatePropagation();
		if (event.type !== 'keyup') return;
		if (event.code === 'Escape' && this.current !== 'intro_sequence') this.events.emit('npc_force_close_dialog', this.current);
		else this.advance();
	};
	private stopVoice() {
		if (!this.voice) return;
		if (this.voice.mesh) this.events.emit('webgl_stop_positional', this.voice.name, this.voice.mesh);
		else this.events.emit('webgl_set_audio_volume', this.voice.name, 0);
		this.voice = null;
	}
	private hide = (id: string) => {
		this.bubbles.get(id)?.remove();
		this.bubbles.delete(id);
		if (id !== this.current) return;
		this.stopVoice();
		this.root.hidden = true;
		this.current = null;
	};
	private hideFinal = (id: string) => {
		this.hide(id);
		if (this.last === id) {
			this.last = null;
			this.events.emit('npc_dialog_hidden', id);
		}
	};
	private positionBubbles = () => {
		this.frame = requestAnimationFrame(this.positionBubbles);
		const planet = this.scene.globalUI.controller.planetScene;
		for (const [id, element] of this.bubbles) {
			const npc = planet?.npcs.find((npc) => npc.mesh._id === id)?.mesh;
			if (!planet || !npc || !npc.visible || this.current) { element.hidden = true; continue; }
			const world = npc.position.clone().set(0, npc.boundingSphere.radius + 0.4, 0).add(npc._textsBubbleGroupOffset);
			npc.localToWorld(world);
			const facing = world.clone().normalize().dot(planet.camera.position.clone().normalize()) > 0.1;
			const projected = world.project(planet.camera);
			element.hidden = !facing || projected.z < -1 || projected.z > 1 || Math.abs(projected.x) > 0.95 || Math.abs(projected.y) > 0.95;
			element.style.left = `${(projected.x + 1) * 50}%`;
			element.style.top = `${(1 - projected.y) * 50}%`;
		}
	};
	resize() { /* CSS handles viewport changes, including a phone rotating. */ }
	private dispose = () => {
		cancelAnimationFrame(this.frame);
		this.stopVoice();
		window.removeEventListener('keydown', this.onKey, true);
		window.removeEventListener('keyup', this.onKey, true);
		this.events.off('npc_dialog_open', this.show);
		this.events.off('npc_dialog_close', this.hide);
		this.events.off('npc_dialog_finished', this.hideFinal);
		this.events.off('npc_dialog_interrupted', this.hideFinal);
		this.root.remove();
		for (const element of this.bubbles.values()) element.remove();
	};
}
