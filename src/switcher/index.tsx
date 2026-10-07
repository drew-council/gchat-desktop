// A quick switcher, like Slack's and Discord's, on Cmd+K (Ctrl+K elsewhere):
// fuzzy-find any DM, space, or thread and jump to it.
//
// The palette is cmdk, rendered by React into a shadow root so Chat's styles
// and ours stay apart; Chat's theme variables still reach it through
// inheritance. It lists what `Directory` has learned from Chat's page.

import { ipcRenderer } from "electron";
import { flushSync } from "react-dom";
import { createRoot, type Root } from "react-dom/client";
import { Directory } from "./directory";
import { harvest } from "./harvest";
import { type Current, Palette } from "./palette";
import { navigate, parsePlace } from "./routes";
import { TOGGLE_SWITCHER } from "./shortcut";
import css from "./switcher.css" with { type: "text" };

/** How often, at most, to read Chat's page as it changes. */
const HARVEST_INTERVAL_MS = 500;
const SAVE_DELAY_MS = 2000;

/**
 * Events from inside the palette that Chat shouldn't act on, like keys it
 * would take as shortcuts since, from outside the shadow root, they look
 * like they come from a plain element rather than a text field.
 */
const CONTAINED_EVENTS = [
	"keydown",
	"keyup",
	"keypress",
	"beforeinput",
	"input",
	"compositionstart",
	"compositionupdate",
	"compositionend",
	"paste",
	"copy",
	"cut",
	"focusin",
	"focusout",
	"pointerdown",
	"pointerup",
	"mousedown",
	"mouseup",
	"click",
	"wheel",
];

function currentOf(directory: Directory): Current | undefined {
	const place = parsePlace(location.pathname);
	const groupId = place && directory.resolve(place);
	return groupId && { groupId, topic: place.topic };
}

class Switcher {
	#host = document.createElement("div");
	#dialog = document.createElement("dialog");
	#root: Root;
	#opened = 0;

	constructor(private readonly directory: Directory) {
		const shadow = this.#host.attachShadow({ mode: "closed" });
		const sheet = new CSSStyleSheet();
		sheet.replaceSync(css);
		shadow.adoptedStyleSheets = [sheet];
		for (const type of CONTAINED_EVENTS) {
			this.#host.addEventListener(type, (event) => event.stopPropagation());
		}
		// Clicking outside and Escape close it, as they do Chat's own dialogs.
		this.#dialog.setAttribute("closedby", "any");
		shadow.append(this.#dialog);
		this.#root = createRoot(this.#dialog);
	}

	get isOpen(): boolean {
		return this.#dialog.open;
	}

	open() {
		if (!this.#host.isConnected) document.body.append(this.#host);
		// A fresh palette each time, with an empty query and the top result picked.
		flushSync(() =>
			this.#root.render(
				<Palette
					key={++this.#opened}
					directory={this.directory}
					current={currentOf(this.directory)}
					onOpen={(path) => {
						this.close();
						navigate(path);
					}}
				/>,
			),
		);
		this.#dialog.showModal();
		this.#dialog.querySelector("input")?.focus();
	}

	close() {
		this.#dialog.close();
	}
}

export function installSwitcher() {
	// Chat embedded in Gmail routes differently, so leave it be.
	if (location.hostname !== "chat.google.com") return;

	const directory = new Directory(localStorage);
	const update = () => directory.record(harvest(document));

	// Chat only renders parts of its lists at a time (Home only while it's
	// open), so learn from whatever it shows as it shows it.
	let scheduled: ReturnType<typeof setTimeout> | undefined;
	new MutationObserver(() => {
		if (scheduled) return;
		scheduled = setTimeout(() => {
			scheduled = undefined;
			update();
		}, HARVEST_INTERVAL_MS);
	}).observe(document, {
		childList: true,
		subtree: true,
		attributeFilter: [
			"data-display-timestamp",
			"data-is-unread",
			"data-starred",
		],
	});

	const visit = () => {
		const place = parsePlace(location.pathname);
		if (place) directory.visit(place);
	};
	navigation.addEventListener("currententrychange", visit);
	visit();

	let saving: ReturnType<typeof setTimeout> | undefined;
	directory.subscribe(() => {
		clearTimeout(saving);
		saving = setTimeout(() => directory.save(), SAVE_DELAY_MS);
	});
	window.addEventListener("pagehide", () => directory.save());

	let switcher: Switcher | undefined;
	ipcRenderer.on(TOGGLE_SWITCHER, () => {
		switcher ??= new Switcher(directory);
		if (switcher.isOpen) {
			switcher.close();
		} else {
			update();
			switcher.open();
		}
	});
}
