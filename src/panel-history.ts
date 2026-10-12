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
/** A row in Home's list (and Mentions'), which opens its thread or conversation in the split pane. */
const LIST_ROW = "[role=listitem][data-group-id][data-group-type]";
/** A thread's reply count under its first message, which opens the thread. */
const THREAD_REPLIES = '[jsname="agxZgf"]';
/** The breadcrumb from a thread in a split pane up to its conversation. */
const PANEL_CONVERSATION = '[jsname="eNEp4e"]';
/** Close buttons: the split pane's, then the side panel's beside a conversation. */
const PANEL_CLOSE = '[jsname="plIjzf"], [jsname="TvD9Pc"] button';

/** How long after arriving somewhere the panel is still part of getting there. */
const ARRIVAL_MS = 1000;
/** How recently the user must have clicked or typed for a change in the panel to be theirs. */
const INPUT_MS = 3000;
/** How long the page must go unchanged before reading its panel. */
const SETTLE_MS = 250;
/** How many times to try putting a panel back before settling for what's shown. */
const RESTORE_ATTEMPTS = 3;
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

/** Takes one step toward showing `target` in the panel; false if nothing could. */
function showPanel(target: Panel | undefined): boolean {
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
		if (group && place && !place.topic && group.endsWith(`/${place.group}`)) {
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
	attempts: number;
}

export function installPanelHistory() {
	if (location.hostname !== "chat.google.com") return;

	/** What the panel showed on each history entry, by its key, which survives Chat's `replaceState`s. */
	const panels = new Map<string, string>(
		JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? "[]") as [
			string,
			string,
		][],
	);
	const remember = (entry: string, panel: string) => {
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

	let arrivedAt = performance.now();
	let inputAt = Number.NEGATIVE_INFINITY;
	for (const type of ["pointerdown", "keydown"]) {
		window.addEventListener(
			type,
			(event) => {
				if (event.isTrusted) inputAt = performance.now();
			},
			{ capture: true },
		);
	}
	let restoring: Restoring | undefined;
	/**
	 * What's shown on an entry whose panel couldn't be put back, which isn't
	 * a change of its own. The entry keeps its panel to try again next time.
	 */
	let unrestored: { entry: string; panel: string } | undefined;
	let pushing = false;
	let url = location.href;

	const restoreStep = (entry: string): boolean => {
		if (!restoring) return false;
		if (restoring.entry !== entry) {
			restoring = undefined;
			return false;
		}
		const current = panelKey(readPanel());
		if (current === restoring.target) {
			restoring = undefined;
		} else if (
			restoring.attempts++ < RESTORE_ATTEMPTS &&
			showPanel(parsePanelKey(restoring.target))
		) {
			// Check again even if Chat's change doesn't touch the page.
			schedule(SETTLE_MS * 3);
		} else {
			restoring = undefined;
			unrestored = { entry, panel: current };
		}
		return true;
	};

	const check = () => {
		const entry = navigation.currentEntry;
		if (!entry || restoreStep(entry.key)) return;

		const panel = panelKey(readPanel());
		const recorded = panels.get(entry.key);
		if (
			recorded === panel ||
			(unrestored?.entry === entry.key && unrestored.panel === panel)
		) {
			return;
		}
		// Only the user changes the panel in place. Otherwise it's part of
		// arriving, or Chat loading the page fresh without the panel it had.
		const now = performance.now();
		if (
			recorded === undefined ||
			now - arrivedAt < ARRIVAL_MS ||
			now - inputAt > INPUT_MS
		) {
			remember(entry.key, panel);
			return;
		}

		// Closing the panel goes back to how the page was before it opened.
		const previous = navigation.entries()[entry.index - 1];
		if (
			!panel &&
			previous?.url === location.href &&
			panels.get(previous.key) === ""
		) {
			restoring = { entry: previous.key, target: "", attempts: 0 };
			history.back();
			return;
		}
		pushing = true;
		history.pushState(history.state, "", location.href);
		pushing = false;
		if (navigation.currentEntry) remember(navigation.currentEntry.key, panel);
	};

	let timer: ReturnType<typeof setTimeout> | undefined;
	const schedule = (delay = SETTLE_MS) => {
		clearTimeout(timer);
		timer = setTimeout(check, delay);
	};

	navigation.addEventListener("currententrychange", (event) => {
		const entry = navigation.currentEntry;
		if (pushing || !entry) return;
		const moved = location.href !== url;
		url = location.href;
		if (event.navigationType === "traverse") {
			const target = panels.get(entry.key);
			if (target !== undefined && restoring?.entry !== entry.key) {
				restoring = { entry: entry.key, target, attempts: 0 };
			}
			// Let Chat route there first, then fix up the panel.
			schedule(SETTLE_MS * 2);
		} else if (moved) {
			arrivedAt = performance.now();
		}
	});

	new MutationObserver(() => schedule()).observe(document, {
		subtree: true,
		childList: true,
		attributeFilter: ["class", "style", "hidden"],
	});
}
