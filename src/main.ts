import path from "node:path";
import { app, BrowserWindow, shell, type WebContents } from "electron";
import {
	CHAT_URL,
	isChatUrl,
	isOpenableExternally,
	isSignedOutLanding,
	routeNavigation,
	routeNewWindow,
	SIGN_IN_URL,
	unwrapRedirect,
} from "./links";
import patches from "./patches.css" with { type: "text" };

// Google refuses to sign in browsers that identify as embedded, so present as
// the plain Chrome that Electron is built on.
app.userAgentFallback = app.userAgentFallback.replace(
	new RegExp(` (Electron|${app.getName()})/\\S+`, "g"),
	"",
);

let mainWindow: BrowserWindow | undefined;
let quitting = false;

function openExternal(url: string) {
	const target = unwrapRedirect(url);
	if (isOpenableExternally(target)) void shell.openExternal(target);
}

/** Applies link routing and patches to a window's contents, including popups it spawns. */
function manage(contents: WebContents) {
	contents.setWindowOpenHandler(({ url }) => {
		switch (routeNewWindow(url)) {
			case "app":
				return {
					action: "allow",
					overrideBrowserWindowOptions: { autoHideMenuBar: true },
				};
			case "pending":
				return {
					action: "allow",
					overrideBrowserWindowOptions: { autoHideMenuBar: true, show: false },
				};
			case "external":
				openExternal(url);
				return { action: "deny" };
		}
	});

	contents.on("did-create-window", (child, { url }) => {
		manage(child.webContents);
		if (routeNewWindow(url) === "pending") routePendingWindow(child);
	});

	contents.on("will-navigate", (event) => {
		if (routeNavigation(event.url, contents.getURL()) === "external") {
			event.preventDefault();
			openExternal(event.url);
		}
	});

	contents.on("dom-ready", () => {
		if (isChatUrl(contents.getURL())) void contents.insertCSS(patches);
	});
}

/**
 * Pages sometimes open a blank window and point it somewhere afterwards, so
 * hold it hidden until the first real navigation shows where it belongs.
 */
function routePendingWindow(win: BrowserWindow) {
	const contents = win.webContents;
	const onNavigation = (
		event: Electron.Event<Electron.WebContentsDidStartNavigationEventParams>,
	) => {
		if (!event.isMainFrame || event.url === "about:blank") return;
		contents.off("did-start-navigation", onNavigation);
		if (routeNewWindow(event.url) === "external") {
			openExternal(event.url);
			win.destroy();
		} else {
			win.show();
		}
	};
	contents.on("did-start-navigation", onNavigation);

	// Nothing navigated, so the opener is probably writing into it directly.
	setTimeout(() => {
		if (win.isDestroyed() || win.isVisible()) return;
		contents.off("did-start-navigation", onNavigation);
		win.show();
	}, 2000);
}

function createMainWindow() {
	const win = new BrowserWindow({
		width: 1200,
		height: 800,
		title: "Google Chat",
		autoHideMenuBar: true,
		webPreferences: {
			preload: path.join(import.meta.dirname, "preload.cjs"),
		},
	});

	// On macOS, closing the window keeps Chat running for notifications, like
	// other chat apps; the dock icon brings it back.
	win.on("close", (event) => {
		if (process.platform === "darwin" && !quitting) {
			event.preventDefault();
			win.hide();
		}
	});
	win.on("closed", () => {
		mainWindow = undefined;
	});

	win.webContents.on("did-navigate", (_event, url) => {
		if (isSignedOutLanding(url)) void win.loadURL(SIGN_IN_URL);
	});

	manage(win.webContents);
	void win.loadURL(CHAT_URL);
	return win;
}

function showMainWindow() {
	if (!mainWindow) {
		mainWindow = createMainWindow();
		return;
	}
	if (mainWindow.isMinimized()) mainWindow.restore();
	mainWindow.show();
	mainWindow.focus();
}

if (!app.requestSingleInstanceLock()) {
	app.quit();
} else {
	app.on("second-instance", showMainWindow);
	app.on("activate", showMainWindow);
	app.on("before-quit", () => {
		quitting = true;
	});
	app.on("window-all-closed", () => {
		if (process.platform !== "darwin") app.quit();
	});

	// Not a top-level await: Electron holds `ready` until the entry module has
	// finished evaluating, so awaiting it here would never resolve.
	void app.whenReady().then(showMainWindow);
}
