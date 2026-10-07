// The switcher's shortcut. The main process watches for it, which catches it
// wherever focus is, including in Chat's iframes, and before Chat sees it.

/** The IPC channel on which the main process asks a page to toggle the switcher. */
export const TOGGLE_SWITCHER = "gchat-desktop:toggle-switcher";

/** The parts of Electron's `Input` that decide whether a key press is the shortcut. */
export interface KeyPress {
	type: string;
	key: string;
	meta: boolean;
	control: boolean;
	alt: boolean;
	shift: boolean;
}

/** Cmd+K on macOS and Ctrl+K elsewhere, as in Slack and Discord. */
export function isSwitcherShortcut(
	input: KeyPress,
	platform: NodeJS.Platform,
): boolean {
	const command =
		platform === "darwin"
			? input.meta && !input.control
			: input.control && !input.meta;
	return (
		input.type === "keyDown" &&
		input.key.toLowerCase() === "k" &&
		command &&
		!input.alt &&
		!input.shift
	);
}
