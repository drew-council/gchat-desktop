// Adds a "Copy text" button to the toolbar Chat shows when hovering a message.
//
// Chat's markup is minified, so these selectors lean on the attributes that
// look least likely to change between its releases.

/** Marks where the "More actions" menu sits in a message's hover toolbar. */
const MORE_ACTIONS = "[data-more-actions-menu-button-id]";
/** A message, whose `data-id` is its message ID. */
const MESSAGE = "[data-id]";
/** The formatted text of a message. */
const MESSAGE_TEXT = 'div[jsname="bgckF"]';
/** Chat's handlers that show a button's tooltip and hover state, but not its click. */
const HOVER_ACTIONS = /^(pointerenter|pointerleave|focus|blur):/;

const COPY_CLASS = "gchat-desktop-copy";
// Material Symbols' content_copy and check.
const COPY_ICON =
	"M360-240q-33 0-56.5-23.5T280-320v-480q0-33 23.5-56.5T360-880h360q33 0 56.5 23.5T800-800v480q0 33-23.5 56.5T720-240H360Zm0-80h360v-480H360v480ZM200-80q-33 0-56.5-23.5T120-160v-560h80v560h440v80H200Zm160-240v-480 480Z";
const COPIED_ICON = "M382-240 154-468l57-57 171 171 367-367 57 57-424 424Z";

let tooltipCount = 0;

/**
 * Copies a message's text as Chat itself would if it were selected, which
 * keeps links and formatting and leaves out the link previews in the markup.
 */
async function copyMessageText(text: Element) {
	const selection = getSelection();
	if (!selection) return;
	const saved = Array.from({ length: selection.rangeCount }, (_, i) =>
		selection.getRangeAt(i),
	);
	selection.selectAllChildren(text);
	const clipboardData = new DataTransfer();
	text.dispatchEvent(
		new ClipboardEvent("copy", {
			clipboardData,
			bubbles: true,
			cancelable: true,
		}),
	);
	const plain = clipboardData.getData("text/plain") || selection.toString();
	const html = clipboardData.getData("text/html");
	selection.removeAllRanges();
	for (const range of saved) selection.addRange(range);

	const item: Record<string, Blob> = {
		"text/plain": new Blob([plain], { type: "text/plain" }),
	};
	if (html) item["text/html"] = new Blob([html], { type: "text/html" });
	await navigator.clipboard.write([new ClipboardItem(item)]);
}

/**
 * Adds a copy button before "More actions", cloned from it so it matches
 * Chat's styling and keeps its tooltip, but with clicks left to us.
 */
function addCopyButton(moreActions: Element) {
	const message = moreActions.closest(MESSAGE);
	const source = moreActions.nextElementSibling?.querySelector(
		"[data-is-tooltip-wrapper]",
	);
	if (!message?.querySelector(MESSAGE_TEXT) || !source) return;

	const wrapper = source.cloneNode(true) as Element;
	wrapper.classList.add(COPY_CLASS);
	const button = wrapper.querySelector("button");
	const tooltip = wrapper.querySelector("[role=tooltip]");
	const svg = wrapper.querySelector("svg");
	if (!button || !tooltip || !svg) return;

	for (const name of ["jsname", "jslog", "aria-expanded", "aria-haspopup"]) {
		button.removeAttribute(name);
	}
	const actions = (button.getAttribute("jsaction") ?? "")
		.split(";")
		.map((action) => action.trim())
		.filter((action) => HOVER_ACTIONS.test(action));
	button.setAttribute("jsaction", actions.join(";"));
	button.setAttribute("aria-label", "Copy text");
	tooltip.id = `${COPY_CLASS}-tooltip-${++tooltipCount}`;
	tooltip.textContent = "Copy text";
	button.setAttribute("data-tooltip-id", tooltip.id);

	svg.setAttribute("viewBox", "0 -960 960 960");
	const icon = document.createElementNS("http://www.w3.org/2000/svg", "path");
	icon.setAttribute("d", COPY_ICON);
	svg.replaceChildren(icon);

	let reset: ReturnType<typeof setTimeout> | undefined;
	button.addEventListener("click", (event) => {
		// Keep Chat's document-level handlers from treating this as a click on the message.
		event.stopPropagation();
		// Look the text up now, since Chat may have re-rendered the message.
		const text = button.closest(MESSAGE)?.querySelector(MESSAGE_TEXT);
		if (!text) return;
		void copyMessageText(text).then(() => {
			icon.setAttribute("d", COPIED_ICON);
			clearTimeout(reset);
			reset = setTimeout(() => icon.setAttribute("d", COPY_ICON), 1500);
		});
	});

	moreActions.before(wrapper);
}

export function installCopyButton() {
	// Chat only renders the toolbar for the hovered message, so watch for it
	// appearing (and Chat re-rendering it without our button).
	new MutationObserver(() => {
		for (const moreActions of document.querySelectorAll(MORE_ACTIONS)) {
			if (!moreActions.previousElementSibling?.classList.contains(COPY_CLASS)) {
				addCopyButton(moreActions);
			}
		}
	}).observe(document, { childList: true, subtree: true });
}
