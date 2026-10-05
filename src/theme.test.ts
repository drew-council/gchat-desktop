import { describe, expect, test } from "bun:test";
import { accentFor, isGeneratedPalette } from "./theme";

// Trimmed from what Chat generates for Lavender in light and dark mode.
const LAVENDER = `:root {--gm3-sys-color-background: #fef7ff; --gm3-sys-color-primary: #6a538c; --gm3-sys-color-primary-rgb: 106, 83, 140;}[data-theme="dark"], Pc6wn {--gm3-sys-color-primary: #d6bbfb;}`;

describe("accentFor", () => {
	test("maps Chat's default color to blue", () => {
		expect(accentFor("baseline", undefined)).toBe("blue");
	});

	test("maps generated palettes by their light-mode primary", () => {
		expect(accentFor("tonalspot", LAVENDER)).toBe("mauve");
		expect(
			accentFor("tonalspot", ":root {--gm3-sys-color-primary: #5a5891;}"),
		).toBe("lavender");
		expect(
			accentFor("neutral", ":root {--gm3-sys-color-primary: #705a4d;}"),
		).toBe("rosewater");
		expect(
			accentFor("monochrome", ":root {--gm3-sys-color-primary: #000000;}"),
		).toBe("subtext0");
	});

	test("tolerates small changes to Google's generated colors", () => {
		expect(
			accentFor("tonalspot", ":root {--gm3-sys-color-primary: #6c548a;}"),
		).toBe("mauve");
	});

	test("leaves the accent alone before Chat has applied a color", () => {
		expect(accentFor(undefined, undefined)).toBeUndefined();
		expect(accentFor("tonalspot", ":root {}")).toBeUndefined();
	});
});

describe("isGeneratedPalette", () => {
	test("recognizes the palette but not Chat's other styles", () => {
		expect(isGeneratedPalette(LAVENDER)).toBe(true);
		expect(isGeneratedPalette(":root {--companion-shell-width: 300px;}")).toBe(
			false,
		);
	});
});
