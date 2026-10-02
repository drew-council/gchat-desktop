import { describe, expect, test } from "bun:test";
import {
	isChatUrl,
	isOpenableExternally,
	isSignedOutLanding,
	routeNavigation,
	routeNewWindow,
	unwrapRedirect,
} from "./links";

const CHAT = "https://chat.google.com/u/0/app/chat/AAAA";

describe("isChatUrl", () => {
	test("accepts standalone and Gmail-embedded Chat", () => {
		expect(isChatUrl("https://chat.google.com/")).toBe(true);
		expect(isChatUrl("https://mail.google.com/chat/u/0/#chat/home")).toBe(true);
	});

	test("rejects the rest of Google", () => {
		expect(isChatUrl("https://mail.google.com/mail/u/0/")).toBe(false);
		expect(isChatUrl("https://meet.google.com/abc-defg-hij")).toBe(false);
		expect(isChatUrl("http://chat.google.com/")).toBe(false);
		expect(isChatUrl("https://chat.google.com.evil.example/")).toBe(false);
	});
});

describe("unwrapRedirect", () => {
	test("extracts the target from Google's redirector", () => {
		expect(
			unwrapRedirect(
				"https://www.google.com/url?q=https://example.com/a?b%3Dc&sa=D",
			),
		).toBe("https://example.com/a?b=c");
	});

	test("leaves other URLs alone", () => {
		expect(unwrapRedirect("https://example.com/url?q=x")).toBe(
			"https://example.com/url?q=x",
		);
		expect(unwrapRedirect("https://www.google.com/search?q=x")).toBe(
			"https://www.google.com/search?q=x",
		);
	});
});

describe("routeNewWindow", () => {
	test("keeps Chat and sign-in popups in the app", () => {
		expect(routeNewWindow(CHAT)).toBe("app");
		expect(routeNewWindow("https://accounts.google.com/AddSession")).toBe(
			"app",
		);
	});

	test("sends everything else to the browser", () => {
		expect(
			routeNewWindow("https://www.google.com/url?q=https://example.com"),
		).toBe("external");
		expect(routeNewWindow("https://docs.google.com/document/d/x")).toBe(
			"external",
		);
	});

	test("defers blank windows until they navigate", () => {
		expect(routeNewWindow("about:blank")).toBe("pending");
		expect(routeNewWindow("")).toBe("pending");
	});
});

describe("routeNavigation", () => {
	test("sends links clicked inside Chat to the browser", () => {
		expect(routeNavigation("https://example.com/", CHAT)).toBe("external");
	});

	test("allows Chat and sign-in from anywhere", () => {
		expect(routeNavigation(CHAT, "https://accounts.google.com/")).toBe("app");
		expect(
			routeNavigation("https://accounts.google.com/ServiceLogin", CHAT),
		).toBe("app");
	});

	test("lets sign-in flows reach third-party SSO providers", () => {
		expect(
			routeNavigation(
				"https://sso.example.com/saml",
				"https://accounts.google.com/",
			),
		).toBe("app");
	});
});

describe("isOpenableExternally", () => {
	test("only allows web and mail links", () => {
		expect(isOpenableExternally("https://example.com")).toBe(true);
		expect(isOpenableExternally("mailto:a@example.com")).toBe(true);
		expect(isOpenableExternally("file:///etc/passwd")).toBe(false);
		expect(isOpenableExternally("javascript:alert(1)")).toBe(false);
	});
});

describe("isSignedOutLanding", () => {
	test("recognizes the page Chat sends signed-out visitors to", () => {
		expect(
			isSignedOutLanding("https://workspace.google.com/products/chat/"),
		).toBe(true);
		expect(isSignedOutLanding("https://workspace.google.com/pricing")).toBe(
			false,
		);
		expect(isSignedOutLanding(CHAT)).toBe(false);
	});
});
