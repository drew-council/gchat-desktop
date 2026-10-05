// Runs in every Chat window before the page's own scripts, in an isolated
// JavaScript world that still shares the page's DOM. Keybind and behavior
// patches go here; styling patches go in patches.css.
//
// For example, a capture-phase listener sees keys before Chat does:
//
//   window.addEventListener("keydown", (event) => { ... }, { capture: true });

import { isChatUrl } from "./links";
import { accentFor, DEFAULT_ACCENT, isGeneratedPalette } from "./theme";

const ACCENT_KEY = "gchat-desktop:catppuccin-accent";

function generatedPalette(): HTMLStyleElement | undefined {
	return [...document.querySelectorAll("body > style")].find(
		(style): style is HTMLStyleElement =>
			isGeneratedPalette(style.textContent ?? ""),
	);
}

/**
 * The Catppuccin theme takes its accent from the color picked in Chat's
 * Appearance settings. Chat applies that color a moment after the document is
 * ready, so the last one seen is remembered to avoid flashing another accent.
 */
function followChatColor() {
	const root = document.documentElement;
	root.dataset.catppuccinAccent =
		localStorage.getItem(ACCENT_KEY) ?? DEFAULT_ACCENT;

	const sync = () => {
		const accent = accentFor(
			document.body.dataset.color,
			generatedPalette()?.textContent ?? undefined,
		);
		if (!accent || accent === root.dataset.catppuccinAccent) return;
		root.dataset.catppuccinAccent = accent;
		localStorage.setItem(ACCENT_KEY, accent);
	};

	// Chat swaps the palette when the setting changes, so watch both it and
	// the body it lives in.
	const observer = new MutationObserver(() => {
		sync();
		watch();
	});
	const watch = () => {
		observer.disconnect();
		observer.observe(document.body, {
			childList: true,
			attributeFilter: ["data-color"],
		});
		const palette = generatedPalette();
		if (palette) {
			observer.observe(palette, {
				childList: true,
				characterData: true,
				subtree: true,
			});
		}
	};

	sync();
	watch();
}

if (isChatUrl(location.href)) {
	window.addEventListener("DOMContentLoaded", followChatColor);
}
