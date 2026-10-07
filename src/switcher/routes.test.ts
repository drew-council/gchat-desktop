import { describe, expect, test } from "bun:test";
import {
	conversationPath,
	inAccountOf,
	parsePlace,
	searchPath,
} from "./routes";

describe("conversationPath", () => {
	test("opens DMs and spaces alike", () => {
		expect(conversationPath("dm/39GvXKAAAAE")).toBe("/app/chat/39GvXKAAAAE");
		expect(conversationPath("space/AAAAKR5qRdg")).toBe("/app/chat/AAAAKR5qRdg");
	});

	test("opens threads beside their conversation", () => {
		expect(conversationPath("space/AAAARMNPLf4", "RG9ItKsz_YI")).toBe(
			"/app/chat/AAAARMNPLf4/topic/RG9ItKsz_YI",
		);
		expect(conversationPath("dm/39GvXKAAAAE", "GulaO3D81_g")).toBe(
			"/app/chat/39GvXKAAAAE/topic/GulaO3D81_g",
		);
	});
});

test("searchPath encodes the query", () => {
	expect(searchPath("sprint 12 & co")).toBe("/app/search?q=sprint+12+%26+co");
});

describe("inAccountOf", () => {
	test("stays on the current account", () => {
		expect(inAccountOf("/app/home", "/u/1/app/chat/AAAA")).toBe(
			"/u/1/app/home",
		);
	});

	test("leaves the default account's routes alone", () => {
		expect(inAccountOf("/app/home", "/app/chat/AAAA")).toBe("/app/home");
	});
});

describe("parsePlace", () => {
	test("reads conversations, whose kind the route doesn't say", () => {
		expect(parsePlace("/app/chat/AAAAKR5qRdg")).toEqual({
			group: "AAAAKR5qRdg",
			topic: undefined,
		});
	});

	test("reads threads shown beside their conversation", () => {
		expect(parsePlace("/app/chat/AAAARMNPLf4/topic/RG9ItKsz_YI")).toEqual({
			group: "AAAARMNPLf4",
			topic: "RG9ItKsz_YI",
		});
	});

	test("reads threads shown on their own", () => {
		expect(parsePlace("/app/chat/AAAARMNPLf4/thread/RG9ItKsz_YI")).toEqual({
			group: "AAAARMNPLf4",
			topic: "RG9ItKsz_YI",
		});
	});

	test("reads legacy routes, which do say", () => {
		expect(parsePlace("/room/AAAARMNPLf4/RG9ItKsz_YI")).toEqual({
			group: "AAAARMNPLf4",
			groupId: "space/AAAARMNPLf4",
			topic: "RG9ItKsz_YI",
		});
		expect(parsePlace("/dm/39GvXKAAAAE")).toEqual({
			group: "39GvXKAAAAE",
			groupId: "dm/39GvXKAAAAE",
			topic: undefined,
		});
	});

	test("reads routes on other accounts", () => {
		expect(parsePlace("/u/1/app/chat/AAAAKR5qRdg")?.group).toBe("AAAAKR5qRdg");
	});

	test("ignores everything else", () => {
		expect(parsePlace("/app/home")).toBeUndefined();
		expect(parsePlace("/app/search")).toBeUndefined();
		expect(parsePlace("/")).toBeUndefined();
	});
});
