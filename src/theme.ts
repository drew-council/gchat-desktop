/** Catppuccin accents; keep in sync with `@accents` in catppuccin.less. */
export type Accent =
	| "rosewater"
	| "flamingo"
	| "pink"
	| "mauve"
	| "red"
	| "maroon"
	| "peach"
	| "yellow"
	| "green"
	| "teal"
	| "sky"
	| "sapphire"
	| "blue"
	| "lavender"
	| "subtext0";

/** Used until Chat's color setting has been read. */
export const DEFAULT_ACCENT: Accent = "mauve";

/**
 * The colors in Chat's Appearance settings, in order, each with the light-mode
 * primary Chat generates from it and the closest Catppuccin accent. Sapphire,
 * Chat's default, generates nothing.
 */
const COLORS: readonly { name: string; primary?: string; accent: Accent }[] = [
	{ name: "Sapphire", accent: "blue" },
	{ name: "Orchid", primary: "#7b4e80", accent: "pink" },
	{ name: "Peony", primary: "#894a68", accent: "flamingo" },
	{ name: "Crimson", primary: "#904a42", accent: "red" },
	{ name: "Ochre", primary: "#8c4f27", accent: "peach" },
	{ name: "Sunflower", primary: "#785a0b", accent: "yellow" },
	{ name: "Hazelnut", primary: "#705a4d", accent: "rosewater" },
	{ name: "Matcha", primary: "#5b631e", accent: "green" },
	{ name: "Forest", primary: "#36693e", accent: "teal" },
	{ name: "Aquamarine", primary: "#006b5f", accent: "sky" },
	{ name: "Ocean", primary: "#00677c", accent: "sapphire" },
	{ name: "Wildflower", primary: "#5a5891", accent: "lavender" },
	{ name: "Lavender", primary: "#6a538c", accent: "mauve" },
	{ name: "Noir", primary: "#000000", accent: "subtext0" },
];

/** Whether a stylesheet is the palette Chat generates from its color setting. */
export function isGeneratedPalette(css: string): boolean {
	return css.startsWith(":root {--gm3-sys-color-");
}

function rgb(hex: string): [number, number, number] {
	const n = Number.parseInt(hex.slice(1), 16);
	return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/**
 * Picks the accent for Chat's color setting, given `<body data-color>` and the
 * palette Chat generated, if any. The palette's primary is matched to the
 * nearest known color, so small changes to Google's generator still land.
 */
export function accentFor(
	scheme: string | undefined,
	palette: string | undefined,
): Accent | undefined {
	if (scheme === "baseline") return "blue";
	const primary = palette?.match(
		/--gm3-sys-color-primary:\s*(#[0-9a-f]{6})\b/i,
	)?.[1];
	if (!primary) return undefined;

	const target = rgb(primary);
	let best: Accent | undefined;
	let bestDistance = Number.POSITIVE_INFINITY;
	for (const color of COLORS) {
		if (!color.primary) continue;
		const [r, g, b] = rgb(color.primary);
		const distance =
			(r - target[0]) ** 2 + (g - target[1]) ** 2 + (b - target[2]) ** 2;
		if (distance < bestDistance) {
			best = color.accent;
			bestDistance = distance;
		}
	}
	return best;
}
