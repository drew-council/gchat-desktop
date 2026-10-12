// Makes Back and Forward (the mouse's side buttons, or ours in the top bar)
// step through what Chat's side panel shows, not just its routes.
//
// Chat opens threads beside a conversation, and conversations in Home's split
// pane, without touching the URL or history, so Back skipped past them to
// whatever route came before. Its router also leaves a panel open when it goes
// back to a route that had none. So each history entry remembers what the
// panel showed, a change in place pushes an entry of its own, and traversing
// to an entry puts its panel back with Chat's own controls.

import {
	conversationPath,
	type GroupId,
	navigate,
	parsePlace,
} from "./switcher/routes";

/** A thread open beside its conversation (or in place of it), or a conversation in a split pane. */
export interface Panel {
	group?: GroupId;
	topic?: string;
}

/** The thread a panel shows. Its conversation's own threads are other elements. */
const THREAD =
	'[data-topic-id][data-is-detailed-thread-view="true"][data-is-preview-view]';
/** A conversation opened inside another view, like Home's split pane. */
const EMBEDDED_CONVERSATION =
	'[data-group-id][data-is-embedded="true"][data-navigation-type]';
/** The conversation a conversation's route shows. */
const MAIN_CONVERSATION =
	'[data-group-id][data-is-embedded="false"][data-navigation-type]';
/** A row in Home's list (and Mentions'), which opens its thread or conversation in the split pane. */
const LIST_ROW = "[role=listitem][data-group-id][data-group-type]";
/** A thread's reply count under its first message, which opens the thread. */
const THREAD_REPLIES = '[jsname="agxZgf"]';
/** The breadcrumb from a thread in a split pane up to its conversation. */
const PANEL_CONVERSATION = '[jsname="eNEp4e"]';
/** Close buttons: the split pane's, then the side panel's beside a conversation. */
const PANEL_CLOSE = '[jsname="plIjzf"], [jsname="TvD9Pc"] button';

/** When to look for what a click or key press did to the panel, after it. */
const INPUT_CHECKS_MS = [250, 600, 1200, 2500];
/** How often to look at the panel while putting one back. */
const RESTORE_POLL_MS = 50;
/** How long Chat gets to show a panel after one of our clicks before trying again. */
const RESTORE_RETRY_MS = 700;
/** How long to keep the panel put back, since Chat may close it as it finishes routing. */
const RESTORE_HOLD_MS = 1000;
/** How long to wait for Chat to render something to put the panel back with. */
const RESTORE_GIVE_UP_MS = 6000;
/** How long to wait for a thread's replies link before routing to the thread instead. */
const RESTORE_ROUTE_AFTER_MS = 1500;
const STORAGE_KEY = "gchat-desktop:panels";
const STORED_ENTRIES = 200;

export function panelKey(panel: Panel | undefined): string {
	return panel ? JSON.stringify([panel.group ?? "", panel.topic ?? ""]) : "";
}

function parsePanelKey(key: string): Panel | undefined {
	if (!key) return undefined;
	const [group, topic] = JSON.parse(key) as [string, string];
	return {
		group: (group || undefined) as GroupId | undefined,
		topic: topic || undefined,
	};
}

function isShown(element: Element): boolean {
	const rect = element.getBoundingClientRect();
	return rect.width > 0 && rect.height > 0;
}

function shown(selector: string): HTMLElement | undefined {
	return [...document.querySelectorAll<HTMLElement>(selector)].find(isShown);
}

function groupIdOf(element: Element | null | undefined): GroupId | undefined {
	return (
		(element?.getAttribute("data-group-id") as GroupId | null) ?? undefined
	);
}

function panelElement(): HTMLElement | undefined {
	return shown(THREAD) ?? shown(EMBEDDED_CONVERSATION);
}

function readPanel(): Panel | undefined {
	const element = panelElement();
	if (!element) return undefined;
	const topic = element.getAttribute("data-topic-id") ?? undefined;
	const group = topic
		? groupIdOf(element.parentElement?.closest("[data-group-id]"))
		: groupIdOf(element);
	return { group, topic };
}

/** Whether Chat has rendered the page its route is for, rather than the one it left. */
function showsRoute(): boolean {
	const place = parsePlace(location.pathname);
	const main = groupIdOf(shown(MAIN_CONVERSATION));
	return place ? Boolean(main?.endsWith(`/${place.group}`)) : !main;
}

/**
 * Clicks an element the way a mouse would: Chat acts on some, like Home's
 * rows, only after seeing the button go down on them.
 */
function press(element: Element) {
	const rect = element.getBoundingClientRect();
	const init: MouseEventInit = {
		bubbles: true,
		cancelable: true,
		composed: true,
		view: window,
		clientX: rect.left + Math.min(rect.width / 2, 40),
		clientY: rect.top + rect.height / 2,
		button: 0,
	};
	element.dispatchEvent(
		new PointerEvent("pointerdown", { ...init, buttons: 1 }),
	);
	element.dispatchEvent(new MouseEvent("mousedown", { ...init, buttons: 1 }));
	element.dispatchEvent(new PointerEvent("pointerup", init));
	element.dispatchEvent(new MouseEvent("mouseup", init));
	element.dispatchEvent(new MouseEvent("click", init));
}

/** Clicks the first of `selector` that's on screen and, if `within` is given, lines up with it. */
function clickShown(selector: string, within?: Element): boolean {
	const bounds = within?.getBoundingClientRect();
	const target = [...document.querySelectorAll<HTMLElement>(selector)].find(
		(element) => {
			if (!isShown(element)) return false;
			if (!bounds) return true;
			const rect = element.getBoundingClientRect();
			return rect.left >= bounds.left - 1 && rect.right <= bounds.right + 1;
		},
	);
	if (target) press(target);
	return Boolean(target);
}

/**
 * Takes one step toward showing `target` in the panel; false if nothing on
 * the page can yet. With `canRoute`, routes to a thread Chat hasn't rendered.
 */
function showPanel(target: Panel | undefined, canRoute = false): boolean {
	const current = panelElement();
	if (!target) return Boolean(current) && clickShown(PANEL_CLOSE, current);

	const { group, topic } = target;
	if (topic) {
		const escaped = CSS.escape(topic);
		if (
			clickShown(`${LIST_ROW}[data-topic-id="${escaped}"]`) ||
			clickShown(`[data-topic-id="${escaped}"] ${THREAD_REPLIES}`)
		) {
			return true;
		}
		// Its conversation has scrolled it out of the page, but Chat can route
		// to a thread beside its conversation.
		const place = parsePlace(location.pathname);
		if (
			canRoute &&
			group &&
			place &&
			!place.topic &&
			group.endsWith(`/${place.group}`)
		) {
			navigate(conversationPath(group, topic), { replace: true });
			return true;
		}
		// Open its conversation in the split pane, and the thread from there next.
		const shownPanel = readPanel();
		const inConversation = shownPanel?.group === group && !shownPanel?.topic;
		return Boolean(group) && !inConversation && showPanel({ group });
	}
	if (!group) return false;
	if (readPanel()?.group === group && clickShown(PANEL_CONVERSATION, current)) {
		return true;
	}
	return clickShown(
		`${LIST_ROW}[data-group-id="${CSS.escape(group)}"]:not([data-topic-id])`,
	);
}

interface Restoring {
	entry: string;
	target: string;
	startedAt: number;
	actedAt: number;
	matchedAt?: number;
}

/** The user's last click or key press, and what came of it. */
interface Input {
	/** Chat went somewhere since, so the panel changed with it. */
	navigated: boolean;
	/** The panel's change already has an entry, which later changes update. */
	recorded: boolean;
}

/** Turns on logging of what this module sees and does, for debugging. */
const DEBUG_KEY = "gchat-desktop:debug-panel-history";

export function installPanelHistory() {
	if (location.hostname !== "chat.google.com") return;

	const debug = (...args: unknown[]) => {
		if (localStorage.getItem(DEBUG_KEY)) {
			console.debug("[panel-history]", ...args);
		}
	};

	/** What the panel showed on each history entry, by its key, which survives Chat's `replaceState`s. */
	const panels = new Map<string, string>(
		JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? "[]") as [
			string,
			string,
		][],
	);
	const remember = (entry: string, panel: string) => {
		if (panels.get(entry) !== panel) debug("remember", entry, panel);
		panels.delete(entry);
		panels.set(entry, panel);
		for (const old of panels.keys()) {
			if (panels.size <= STORED_ENTRIES) break;
			panels.delete(old);
		}
	};
	window.addEventListener("pagehide", () =>
		sessionStorage.setItem(STORAGE_KEY, JSON.stringify([...panels])),
	);

	let input: Input | undefined;
	let restoring: Restoring | undefined;
	let pushing = false;
	/** Set while going back for the user, where the page already shows where it's going. */
	let closing = false;
	let url = location.href;
	const timers = new Set<ReturnType<typeof setTimeout>>();
	const after = (delay: number, callback: () => void) => {
		const timer = setTimeout(() => {
			timers.delete(timer);
			callback();
		}, delay);
		timers.add(timer);
	};
	const cancelTimers = () => {
		for (const timer of timers) clearTimeout(timer);
		timers.clear();
	};

	const stopRestoring = () => {
		if (!restoring) return;
		const entry = navigation.currentEntry;
		// Whatever is shown when it stops is what the entry shows now.
		if (entry?.key === restoring.entry) {
			remember(entry.key, panelKey(readPanel()));
		}
		debug("stop restoring", restoring);
		restoring = undefined;
	};

	const restoreTick = () => {
		if (!restoring) return;
		const entry = navigation.currentEntry;
		if (entry?.key !== restoring.entry) {
			restoring = undefined;
			return;
		}
		const now = performance.now();
		const elapsed = now - restoring.startedAt;
		if (panelKey(readPanel()) === restoring.target) {
			restoring.matchedAt ??= now;
			if (now - restoring.matchedAt >= RESTORE_HOLD_MS) {
				debug("restored", restoring);
				restoring = undefined;
				return;
			}
		} else {
			restoring.matchedAt = undefined;
			if (elapsed >= RESTORE_GIVE_UP_MS) {
				stopRestoring();
				return;
			}
			if (
				now - restoring.actedAt >= RESTORE_RETRY_MS &&
				showsRoute() &&
				showPanel(
					parsePanelKey(restoring.target),
					elapsed >= RESTORE_ROUTE_AFTER_MS,
				)
			) {
				debug("restore step", restoring.target);
				restoring.actedAt = now;
			}
		}
		after(RESTORE_POLL_MS, restoreTick);
	};

	/** Records what the user's input did to the panel, if anything. */
	const checkInput = () => {
		const entry = navigation.currentEntry;
		if (!input || restoring || !entry) return;
		const panel = panelKey(readPanel());
		const recorded = panels.get(entry.key);
		if (recorded === panel) return;
		if (recorded === undefined || input.navigated || input.recorded) {
			remember(entry.key, panel);
			return;
		}
		input.recorded = true;

		// Closing the panel goes back to how the page was before it opened.
		const previous = navigation.entries()[entry.index - 1];
		if (
			!panel &&
			previous?.url === location.href &&
			panels.get(previous.key) === ""
		) {
			debug("closed, so going back");
			closing = true;
			history.back();
			return;
		}
		pushing = true;
		history.pushState(history.state, "", location.href);
		pushing = false;
		debug("push", panel);
		if (navigation.currentEntry) remember(navigation.currentEntry.key, panel);
	};

	const onInput = (event: Event) => {
		if (!event.isTrusted) return;
		// Only the main button picks things; the side buttons go back and forward.
		if (event instanceof PointerEvent && event.button !== 0) return;
		// Typing doesn't open panels, and it shouldn't pay for looking.
		const target = event.target;
		if (
			event instanceof KeyboardEvent &&
			target instanceof HTMLElement &&
			(target.isContentEditable || target.matches("input, textarea")) &&
			event.key !== "Enter"
		) {
			return;
		}
		stopRestoring();
		cancelTimers();
		// A change since the last input that nothing has recorded yet was its doing.
		if (input) checkInput();
		const entry = navigation.currentEntry;
		// Otherwise, whatever changed since happened without the user (like
		// Chat loading the page fresh) and is just how this entry is now.
		if (entry && !input) remember(entry.key, panelKey(readPanel()));
		input = { navigated: false, recorded: false };
		for (const delay of INPUT_CHECKS_MS) after(delay, checkInput);
		after(INPUT_CHECKS_MS.at(-1) ?? 0, () => {
			input = undefined;
		});
	};
	window.addEventListener("pointerdown", onInput, { capture: true });
	window.addEventListener("keydown", onInput, { capture: true });

	navigation.addEventListener("currententrychange", (event) => {
		const entry = navigation.currentEntry;
		if (pushing || !entry) return;
		const moved = location.href !== url;
		url = location.href;
		if (event.navigationType !== "traverse") {
			if (moved && input) input.navigated = true;
			return;
		}

		// Chat routes on `popstate`, after this, so the page still shows where
		// it's leaving.
		const from = event.from;
		if (from.key && restoring?.entry !== from.key && !closing) {
			remember(from.key, panelKey(readPanel()));
		}
		closing = false;
		cancelTimers();
		input = undefined;
		const target = panels.get(entry.key);
		restoring = undefined;
		if (target === undefined) return;
		const now = performance.now();
		restoring = {
			entry: entry.key,
			target,
			startedAt: now,
			actedAt: now - RESTORE_RETRY_MS,
		};
		debug("restoring", restoring);
		after(RESTORE_POLL_MS, restoreTick);
	});
}
