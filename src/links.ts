/** Where the app starts; Google redirects to sign-in from here when needed. */
export const CHAT_URL = "https://chat.google.com/";

/** Google's sign-in page, returning to Chat afterwards. */
export const SIGN_IN_URL = `https://accounts.google.com/ServiceLogin?continue=${encodeURIComponent(CHAT_URL)}`;

/** Where a URL a page asked to open should go. */
export type Destination = "app" | "external" | "pending";

const SIGN_IN_HOSTS = new Set(["accounts.google.com", "accounts.youtube.com"]);

function parse(url: string): URL | undefined {
	try {
		return new URL(url);
	} catch {
		return undefined;
	}
}

/** Chat itself, either standalone or embedded in Gmail. */
export function isChatUrl(url: string): boolean {
	const parsed = parse(url);
	if (parsed?.protocol !== "https:") return false;
	return (
		parsed.hostname === "chat.google.com" ||
		(parsed.hostname === "mail.google.com" &&
			parsed.pathname.startsWith("/chat"))
	);
}

function isSignInUrl(url: string): boolean {
	const parsed = parse(url);
	return parsed?.protocol === "https:" && SIGN_IN_HOSTS.has(parsed.hostname);
}

/** Where Chat sends signed-out visitors: a marketing page rather than sign-in. */
export function isSignedOutLanding(url: string): boolean {
	const parsed = parse(url);
	return (
		parsed?.hostname === "workspace.google.com" &&
		parsed.pathname.startsWith("/products/chat")
	);
}

function isBlank(url: string): boolean {
	return url === "" || url === "about:blank";
}

/**
 * Chat routes outbound links through `https://www.google.com/url?q=<target>`;
 * returns the real target so the browser doesn't bounce through Google first.
 */
export function unwrapRedirect(url: string): string {
	const parsed = parse(url);
	if (
		parsed &&
		(parsed.hostname === "www.google.com" ||
			parsed.hostname === "google.com") &&
		parsed.pathname === "/url"
	) {
		return (
			parsed.searchParams.get("q") ?? parsed.searchParams.get("url") ?? url
		);
	}
	return url;
}

/** Whether a URL is safe to hand to the system's default handler. */
export function isOpenableExternally(url: string): boolean {
	const protocol = parse(url)?.protocol;
	return (
		protocol === "https:" || protocol === "http:" || protocol === "mailto:"
	);
}

/** Decides where a window the page tried to open (`window.open`, `target=_blank`) belongs. */
export function routeNewWindow(url: string): Destination {
	if (isBlank(url)) return "pending";
	if (isChatUrl(url) || isSignInUrl(url)) return "app";
	return "external";
}

/**
 * Decides whether a page-initiated navigation from `currentUrl` to `targetUrl`
 * stays in the window. Off-Chat pages are left alone so that sign-in flows,
 * including third-party SSO providers, can go wherever they need to.
 */
export function routeNavigation(
	targetUrl: string,
	currentUrl: string,
): Destination {
	if (isChatUrl(targetUrl) || isSignInUrl(targetUrl)) return "app";
	if (!isChatUrl(currentUrl)) return "app";
	return "external";
}
