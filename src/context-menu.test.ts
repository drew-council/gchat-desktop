import { describe, expect, mock, test } from "bun:test";
import { contextMenuTemplate, type MenuContext } from "./context-menu";

const EDIT_FLAGS: Electron.EditFlags = {
	canUndo: true,
	canRedo: true,
	canCut: true,
	canCopy: true,
	canPaste: true,
	canDelete: true,
	canSelectAll: true,
	canEditRichly: true,
};

function context(overrides: Partial<MenuContext>): MenuContext {
	return {
		misspelledWord: "",
		dictionarySuggestions: [],
		isEditable: false,
		editFlags: EDIT_FLAGS,
		selectionText: "",
		linkURL: "",
		...overrides,
	};
}

function actions() {
	return {
		replaceMisspelling: mock(),
		addToDictionary: mock(),
		copyLink: mock(),
	};
}

function labels(template: Electron.MenuItemConstructorOptions[]) {
	return template.map((item) => item.label ?? item.role ?? item.type);
}

describe("contextMenuTemplate", () => {
	test("offers suggestions for a misspelled word ahead of editing", () => {
		const menu = contextMenuTemplate(
			context({
				misspelledWord: "teh",
				dictionarySuggestions: ["the", "tech"],
				isEditable: true,
			}),
			actions(),
		);
		expect(labels(menu)).toEqual([
			"the",
			"tech",
			"separator",
			"Add to Dictionary",
			"separator",
			"cut",
			"copy",
			"paste",
			"pasteAndMatchStyle",
			"selectAll",
		]);
	});

	test("replaces the word or learns it", () => {
		const act = actions();
		const menu = contextMenuTemplate(
			context({
				misspelledWord: "teh",
				dictionarySuggestions: ["the"],
				isEditable: true,
			}),
			act,
		);
		const click = (label: string) => {
			const item = menu.find((item) => item.label === label);
			(item?.click as (() => void) | undefined)?.();
		};
		click("the");
		click("Add to Dictionary");
		expect(act.replaceMisspelling).toHaveBeenCalledWith("the");
		expect(act.addToDictionary).toHaveBeenCalledWith("teh");
	});

	test("says when there are no suggestions", () => {
		const menu = contextMenuTemplate(
			context({ misspelledWord: "qwzx", isEditable: true }),
			actions(),
		);
		expect(menu[0]).toEqual({ label: "No Guesses Found", enabled: false });
	});

	test("follows what the page says it can edit", () => {
		const menu = contextMenuTemplate(
			context({
				isEditable: true,
				editFlags: { ...EDIT_FLAGS, canCut: false, canCopy: false },
			}),
			actions(),
		);
		const enabled = Object.fromEntries(
			menu.map((item) => [item.role, item.enabled]),
		);
		expect(enabled).toMatchObject({ cut: false, copy: false, paste: true });
	});

	test("copies selected text and links outside the composer", () => {
		expect(
			labels(contextMenuTemplate(context({ selectionText: "hi" }), actions())),
		).toEqual(["copy"]);
		expect(
			labels(
				contextMenuTemplate(
					context({ linkURL: "https://example.com/" }),
					actions(),
				),
			),
		).toEqual(["Copy Link Address"]);
	});

	test("is empty where there is nothing to do", () => {
		expect(contextMenuTemplate(context({}), actions())).toEqual([]);
		expect(
			contextMenuTemplate(context({ selectionText: "  \n" }), actions()),
		).toEqual([]);
	});
});
