import type { Object3D } from 'three';

type EventBus = {
	on(name: string, listener: (...args: any[]) => void): void;
	off(name: string, listener: (...args: any[]) => void): void;
	emit(name: string, ...args: unknown[]): void;
};
type Scene = { mobile: boolean; marginTop: number; marginLeft: number };
type Dot = { mesh: Object3D; show(): void; hide(): void };
type QuestInfo = Record<string, { steps: boolean[] }>;
type Labels = Record<string, { zh: string; en: string }>;

/** Both languages share the original engine's live quest progress. */
export class BilingualChecklist {
	ready = Promise.resolve();
	shown = false;
	private root = document.createElement('section');
	private list = document.createElement('ol');
	private timer: ReturnType<typeof setTimeout> | undefined;
	private hideEvents = ['character_change_traits_shown', 'npc_dialog_shown', 'ui_emojis_toggle', 'touch_click', 'end_screen_show'];

	constructor(private scene: Scene, private events: EventBus, private quests: QuestInfo, private dot: Dot, private labels: Labels) {
		this.root.id = 'bilingual-checklist';
		this.root.hidden = true;
		this.root.setAttribute('aria-labelledby', 'checklist-heading');
		const heading = document.createElement('h2');
		heading.id = 'checklist-heading';
		heading.textContent = '任务清单 / CHECKLIST';
		this.root.append(heading, this.list);
		// Scrolling or selecting checklist text must not trigger player controls.
		for (const type of ['pointerdown', 'pointerup', 'mousedown', 'mouseup', 'touchstart', 'touchend', 'click', 'wheel']) {
			this.root.addEventListener(type, (event) => event.stopPropagation());
		}
		document.body.append(this.root);
		this.events.on('ui_quest_log_toggle', this.toggle);
		this.events.on('quest_info_checklist_update', this.update);
		for (const event of this.hideEvents) this.events.on(event, this.hide);
		window.addEventListener('pagehide', this.dispose, { once: true });
		this.buildText();
		this.resize();
	}

	toggle = () => { if (this.shown) this.hide(); else { this.show(); this.dot.hide(); } };
	show = (delay = 0) => {
		if (this.shown) return;
		this.shown = true;
		clearTimeout(this.timer);
		this.timer = setTimeout(() => {
			this.root.hidden = false;
			this.events.emit('webgl_play_audio', 'open-box2');
			this.events.emit('webgl_play_audio', 'open-box-checklist');
		}, delay * 1000);
	};
	hide = () => {
		clearTimeout(this.timer);
		if (!this.shown) return;
		this.shown = false;
		this.root.hidden = true;
		this.events.emit('webgl_play_audio', 'open-box1');
	};
	update = (notify = false, completed = false) => {
		if (completed) this.dot.hide();
		else if (notify) this.dot.show();
		this.buildText();
	};
	buildText() {
		const started = Object.values(this.quests).some((quest) => quest.steps.some(Boolean));
		this.list.replaceChildren(...Object.entries(this.quests).map(([id, quest]) => {
			const count = quest.steps.filter(Boolean).length;
			const item = document.createElement('li');
			item.dataset.questId = id;
			item.classList.toggle('is-complete', count === quest.steps.length);
			item.classList.toggle('is-inactive', started && count === 0);
			const zh = document.createElement('span');
			zh.lang = 'zh-CN';
			zh.textContent = this.labels[id].zh;
			const progress = document.createElement('span');
			progress.className = 'quest-progress';
			progress.textContent = ` (${count}/${quest.steps.length})`;
			const en = document.createElement('small');
			en.lang = 'en';
			en.textContent = this.labels[id].en;
			item.append(zh, progress, en);
			return item;
		}));
	}
	resize() {
		const top = this.scene.marginTop;
		const right = this.scene.marginLeft + (this.scene.mobile ? 60 : 90);
		this.root.style.top = `${top}px`;
		this.root.style.right = `${right}px`;
		this.root.style.maxHeight = `calc(100dvh - ${top + 24}px)`;
		this.root.style.width = `min(440px, calc(100vw - ${right + 18}px))`;
		this.dot.mesh.scale.setScalar(this.scene.mobile ? 15 : 20);
		this.dot.mesh.position.set(window.innerWidth - this.scene.marginLeft, -top, 0);
		this.dot.mesh.updateMatrix();
	}
	private dispose = () => {
		clearTimeout(this.timer);
		this.events.off('ui_quest_log_toggle', this.toggle);
		this.events.off('quest_info_checklist_update', this.update);
		for (const event of this.hideEvents) this.events.off(event, this.hide);
		this.root.remove();
	};
}
