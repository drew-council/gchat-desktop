import { describe, expect, test } from "bun:test";
import type { Entry } from "./directory";
import { inScope, parseQuery, score } from "./search";

function entry(overrides: Partial<Entry>): Entry {
	return {
		key: "space/b",
		groupId: "space/b",
		kind: "space",
		name: "",
		activity: 0,
		visited: 0,
		seen: 0,
		unread: false,
		starred: false,
		...overrides,
	};
}

describe("parseQuery", () => {
	test("reads a scope prefix", () => {
		expect(parseQuery("@ada")).toEqual({ scope: "@", text: "ada" });
		expect(parseQuery("  # eng ")).toEqual({ scope: "#", text: "eng" });
		expect(parseQuery(">")).toEqual({ scope: ">", text: "" });
	});

	test("leaves other queries alone", () => {
		expect(parseQuery(" ada lovelace ")).toEqual({ text: "ada lovelace" });
		expect(parseQuery("a@b")).toEqual({ text: "a@b" });
	});
});

test("inScope narrows by kind", () => {
	const dm = entry({ kind: "dm" });
	const meeting = entry({ kind: "meeting" });
	const thread = entry({ kind: "thread" });
	expect(inScope(dm, undefined)).toBe(true);
	expect(inScope(dm, "@")).toBe(true);
	expect(inScope(dm, "#")).toBe(false);
	expect(inScope(meeting, "#")).toBe(true);
	expect(inScope(thread, ">")).toBe(true);
	expect(inScope(thread, "@")).toBe(false);
});

describe("score", () => {
	const engineering = entry({ name: "Engineering" });
	const thread = entry({
		kind: "thread",
		topic: "t",
		name: "Engineering",
		title: "Meghana Bhat: Bazel upgrade is failing",
	});

	test("matches everything when there's nothing to match", () => {
		expect(score(engineering, "")).toBe(1);
	});

	test("prefers a conversation to threads in it", () => {
		expect(score(engineering, "eng")).toBeGreaterThan(score(thread, "eng"));
		expect(score(thread, "eng")).toBeGreaterThan(0);
	});

	test("matches threads by their first message", () => {
		expect(score(thread, "bazel")).toBeGreaterThan(0);
	});

	test("drops letters scattered through a name", () => {
		expect(score(entry({ name: "Bot Testing" }), "eng")).toBe(0);
	});
});
