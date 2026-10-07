import { describe, expect, test } from "bun:test";
import { Directory } from "./directory";

const DAY = 24 * 60 * 60 * 1000;

function memoryStorage() {
	const items = new Map<string, string>();
	return {
		getItem: (key: string) => items.get(key) ?? null,
		setItem: (key: string, value: string) => void items.set(key, value),
	};
}

describe("Directory", () => {
	test("lists the most recent first", () => {
		const directory = new Directory();
		directory.record([
			{ groupId: "space/old", name: "Old", activity: 1 },
			{ groupId: "dm/new", name: "New", activity: 3 },
			{ groupId: "space/middle", name: "Middle", activity: 2 },
		]);
		expect(directory.entries().map((entry) => entry.name)).toEqual([
			"New",
			"Middle",
			"Old",
		]);
	});

	test("guesses kinds from IDs until the page says otherwise", () => {
		const directory = new Directory();
		directory.record([{ groupId: "dm/a" }, { groupId: "space/b" }]);
		expect(directory.get("dm/a")?.kind).toBe("dm");
		expect(directory.get("space/b")?.kind).toBe("space");

		directory.record([{ groupId: "dm/a", kind: "app" }]);
		directory.record([{ groupId: "dm/a" }]);
		expect(directory.get("dm/a")?.kind).toBe("app");
	});

	test("keeps threads apart from their conversation", () => {
		const directory = new Directory();
		directory.record([
			{ groupId: "space/b", kind: "space", name: "Engineering" },
			{
				groupId: "space/b",
				topic: "t",
				name: "Engineering",
				title: "Bazel is failing",
			},
		]);
		expect(directory.get("space/b")?.kind).toBe("space");
		expect(directory.get("space/b", "t")).toMatchObject({
			key: "space/b/t",
			kind: "thread",
			title: "Bazel is failing",
		});
	});

	test("merges what each sighting knows", () => {
		const directory = new Directory();
		directory.record([
			{ groupId: "dm/a", name: "Ada", activity: 5, starred: true },
		]);
		directory.record([{ groupId: "dm/a", activity: 2, unread: true }]);
		expect(directory.get("dm/a")).toMatchObject({
			name: "Ada",
			activity: 5,
			starred: true,
			unread: true,
		});
	});

	test("only announces real changes", () => {
		const directory = new Directory();
		let changes = 0;
		directory.subscribe(() => changes++);
		directory.record([{ groupId: "dm/a", name: "Ada" }], 1);
		directory.record([{ groupId: "dm/a", name: "Ada" }], 2);
		expect(changes).toBe(1);
		const before = directory.entries();
		directory.record([{ groupId: "dm/a", name: "Ada" }], 3);
		expect(directory.entries()).toBe(before);
	});

	test("visiting marks things read and recent", () => {
		const directory = new Directory();
		directory.record([
			{ groupId: "space/b", name: "B", activity: 1, unread: true },
			{ groupId: "space/b", topic: "t", activity: 1, unread: true },
			{ groupId: "dm/a", name: "A", activity: 2 },
		]);
		directory.visit({ group: "b", topic: "t" }, 10);
		expect(directory.get("space/b")).toMatchObject({
			visited: 10,
			unread: false,
		});
		expect(directory.get("space/b", "t")?.unread).toBe(false);
		expect(directory.entries()[0]?.key).toBe("space/b");
	});

	test("resolves bare route IDs to groups it knows", () => {
		const directory = new Directory();
		directory.record([{ groupId: "dm/a" }]);
		expect(directory.resolve({ group: "a" })).toBe("dm/a");
		expect(directory.resolve({ group: "unknown" })).toBeUndefined();
		expect(directory.resolve({ group: "c", groupId: "space/c" })).toBe(
			"space/c",
		);
	});

	test("persists, forgetting what's long gone", () => {
		const storage = memoryStorage();
		const saved = new Directory(storage, 0);
		saved.record(
			[
				{ groupId: "dm/a", name: "Ada" },
				{ groupId: "space/b", topic: "t", title: "Old thread" },
			],
			0,
		);
		saved.save();

		const soon = new Directory(storage, 7 * DAY);
		expect(soon.entries().map((entry) => entry.key)).toEqual([
			"dm/a",
			"space/b/t",
		]);
		const later = new Directory(storage, 60 * DAY);
		expect(later.entries().map((entry) => entry.key)).toEqual(["dm/a"]);
		const muchLater = new Directory(storage, 365 * DAY);
		expect(muchLater.entries()).toEqual([]);
	});

	test("ignores storage it doesn't understand", () => {
		const storage = memoryStorage();
		storage.setItem("gchat-desktop:switcher", "{not json");
		expect(new Directory(storage).entries()).toEqual([]);
		storage.setItem("gchat-desktop:switcher", '{"version":0,"entries":[]}');
		expect(new Directory(storage).entries()).toEqual([]);
	});
});
