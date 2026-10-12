// Adds Back and Forward buttons to Chat's top bar, after its logo, since an
// app window has no browser toolbar to provide them.
//
// They're cloned from the bar's menu button so they match its styling, with
// clicks left to us.

/** The top bar's menu button, which Google's bar marks with `data-ogmb`. */
const MENU_BUTTON = "header[role=banner] [role=button][data-ogmb]";

const BUTTON_CLASS = "gchat-desktop-history";
// Material Symbols' arrow_back and arrow_forward, as the bar draws its icons.
const BACK_ICON =
	"M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z";
const FORWARD_ICON =
	"M12 4l-1.41 1.41L16.17 11H4v2h12.17l-5.58 5.59L12 20l8-8z";

function createButton(
	menu: Element,
	label: string,
	icon: string,
	go: () => void,
): HTMLElement {
	const button = menu.cloneNode(true) as HTMLElement;
	for (const name of ["data-ogmb", "aria-expanded", "jsaction", "jsname"]) {
		button.removeAttribute(name);
	}
	button.classList.add(BUTTON_CLASS);
	button.setAttribute("aria-label", label);
	button.title = label;
	button.querySelector("path")?.setAttribute("d", icon);

	const activate = (event: Event) => {
		// Keep the bar's handlers, which listen above it, out of it.
		event.stopPropagation();
		if (button.getAttribute("aria-disabled") !== "true") go();
	};
	button.addEventListener("click", activate);
	button.addEventListener("keydown", (event) => {
		if (event.key !== "Enter" && event.key !== " ") return;
		event.preventDefault();
		activate(event);
	});
	return button;
}

export function installHistoryButtons() {
	let buttons: { back: HTMLElement; forward: HTMLElement } | undefined;

	const update = () => {
		if (!buttons) return;
		buttons.back.setAttribute("aria-disabled", String(!navigation.canGoBack));
		buttons.forward.setAttribute(
			"aria-disabled",
			String(!navigation.canGoForward),
		);
	};

	const insert = () => {
		if (buttons?.back.isConnected) return;
		const menu = document.querySelector(MENU_BUTTON);
		// The bar's logo, in the same row as the menu button.
		const logo = [...(menu?.parentElement?.children ?? [])].find((child) =>
			child.querySelector("a[href]"),
		);
		if (!menu || !logo) return;
		buttons = {
			back: createButton(menu, "Back", BACK_ICON, () => history.back()),
			forward: createButton(menu, "Forward", FORWARD_ICON, () =>
				history.forward(),
			),
		};
		logo.after(buttons.back, buttons.forward);
		update();
	};

	navigation.addEventListener("currententrychange", update);
	// Chat renders its bar after this runs, and may render it again.
	new MutationObserver(insert).observe(document, {
		childList: true,
		subtree: true,
	});
}
