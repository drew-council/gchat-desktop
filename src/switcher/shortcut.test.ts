import { describe, expect, test } from "bun:test";
import { isSwitcherShortcut, type KeyPress } from "./shortcut";

function press(overrides: Partial<KeyPress>): KeyPress {
	return {
		type: "keyDown",
		key: "k",
		meta: false,
		control: false,
		alt: false,
		shift: false,
		...overrides,
	};
}

describe("isSwitcherShortcut", () => {
	test("is Cmd+K on macOS", () => {
		expect(isSwitcherShortcut(press({ meta: true }), "darwin")).toBe(true);
		expect(isSwitcherShortcut(press({ control: true }), "darwin")).toBe(false);
	});

	test("is Ctrl+K elsewhere", () => {
		expect(isSwitcherShortcut(press({ control: true }), "linux")).toBe(true);
		expect(isSwitcherShortcut(press({ meta: true }), "linux")).toBe(false);
	});

	test("ignores other keys, modifiers, and releases", () => {
		const base = { control: true };
		expect(isSwitcherShortcut(press({ ...base, key: "j" }), "linux")).toBe(
			false,
		);
		expect(isSwitcherShortcut(press({ ...base, shift: true }), "linux")).toBe(
			false,
		);
		expect(isSwitcherShortcut(press({ ...base, alt: true }), "linux")).toBe(
			false,
		);
		expect(isSwitcherShortcut(press({ ...base, type: "keyUp" }), "linux")).toBe(
			false,
		);
		expect(isSwitcherShortcut(press({ ...base, key: "K" }), "linux")).toBe(
			true,
		);
	});
});
