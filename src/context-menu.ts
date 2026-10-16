// The right-click menu. Electron shows none of its own, so without this there
// is no way to pick a spelling suggestion for the words Chat underlines.

type MenuItem = Electron.MenuItemConstructorOptions;

/** The parts of Electron's `ContextMenuParams` the menu is built from. */
export type MenuContext = Pick<
	Electron.ContextMenuParams,
	| "misspelledWord"
	| "dictionarySuggestions"
	| "isEditable"
	| "editFlags"
	| "selectionText"
	| "linkURL"
>;

/** What the menu's items do beyond Electron's built-in editing roles. */
export interface MenuActions {
	replaceMisspelling(word: string): void;
	addToDictionary(word: string): void;
	copyLink(url: string): void;
}

/** The menu for a right-click, like Chrome's; empty where Chrome shows nothing useful. */
export function contextMenuTemplate(
	context: MenuContext,
	actions: MenuActions,
): MenuItem[] {
	const groups: MenuItem[][] = [];
	const { misspelledWord: word, editFlags: flags } = context;

	if (word) {
		const suggestions: MenuItem[] = context.dictionarySuggestions.map(
			(suggestion) => ({
				label: suggestion,
				click: () => actions.replaceMisspelling(suggestion),
			}),
		);
		if (suggestions.length === 0) {
			suggestions.push({ label: "No Guesses Found", enabled: false });
		}
		groups.push(suggestions, [
			{
				label: "Add to Dictionary",
				click: () => actions.addToDictionary(word),
			},
		]);
	}

	if (context.isEditable) {
		groups.push([
			{ role: "cut", enabled: flags.canCut },
			{ role: "copy", enabled: flags.canCopy },
			{ role: "paste", enabled: flags.canPaste },
			{
				role: "pasteAndMatchStyle",
				enabled: flags.canPaste && flags.canEditRichly,
			},
			{ role: "selectAll", enabled: flags.canSelectAll },
		]);
	} else if (context.selectionText.trim()) {
		groups.push([{ role: "copy" }]);
	}

	if (context.linkURL) {
		groups.push([
			{
				label: "Copy Link Address",
				click: () => actions.copyLink(context.linkURL),
			},
		]);
	}

	return groups.flatMap((group, i) =>
		i === 0 ? group : [{ type: "separator" }, ...group],
	);
}
