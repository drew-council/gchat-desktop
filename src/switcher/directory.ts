// Everything the switcher can switch to, learned from what Chat has shown and
// kept across sessions, since Chat only renders some of it at a time.

import { type GroupId, type Place, splitGroupId } from "./routes";

export type Kind = "dm" | "group" | "space" | "meeting" | "app" | "thread";

export interface Avatar {
	emoji?: string;
	url?: string;
}

/** What Chat's page showed about a conversation, or a thread in one. */
export interface Sighting {
	groupId: GroupId;
	topic?: string;
	/** Left out when the page didn't say. */
	kind?: Exclude<Kind, "thread">;
	/** The conversation's name; for threads, the conversation they're in. */
	name?: string;
	/** A thread's first message. */
	title?: string;
	avatar?: Avatar;
	/** When it last had a message, in milliseconds since the epoch. */
	activity?: number;
	unread?: boolean;
	starred?: boolean;
}

export interface Entry {
	/** The group ID, followed by `/<topic>` for threads. */
	key: string;
	groupId: GroupId;
	topic?: string;
	kind: Kind;
	name: string;
	title?: string;
	avatar?: Avatar;
	/** When it last had a message, or 0 if unknown. */
	activity: number;
	/** When it was last opened here, or 0 if never. */
	visited: number;
	/** When it was last on the page, for forgetting what's gone from Chat. */
	seen: number;
	unread: boolean;
	starred: boolean;
}

const STORAGE_KEY = "gchat-desktop:switcher";
const STORAGE_VERSION = 1;
const DAY = 24 * 60 * 60 * 1000;
/** How long to remember entries Chat stopped showing and that weren't opened. */
const RETENTION = { conversation: 180 * DAY, thread: 30 * DAY };

export function entryKey(groupId: GroupId, topic?: string): string {
	return topic ? `${groupId}/${topic}` : groupId;
}

/** How recently an entry was relevant to you, for ordering. */
export function recency(entry: Entry): number {
	return Math.max(entry.activity, entry.visited);
}

/** Whether two versions of an entry differ in more than when they were seen. */
function differs(a: Entry, b: Entry): boolean {
	return (
		JSON.stringify({ ...a, seen: 0 }) !== JSON.stringify({ ...b, seen: 0 })
	);
}

export class Directory {
	#entries = new Map<string, Entry>();
	#listeners = new Set<() => void>();
	#sorted: Entry[] | undefined;

	constructor(
		private readonly storage?: Pick<Storage, "getItem" | "setItem">,
		now = Date.now(),
	) {
		this.#load(now);
	}

	/** All entries, most recent first. The same array until something changes. */
	entries = (): Entry[] => {
		this.#sorted ??= [...this.#entries.values()].sort(
			(a, b) => recency(b) - recency(a),
		);
		return this.#sorted;
	};

	subscribe = (listener: () => void): (() => void) => {
		this.#listeners.add(listener);
		return () => this.#listeners.delete(listener);
	};

	get(groupId: GroupId, topic?: string): Entry | undefined {
		return this.#entries.get(entryKey(groupId, topic));
	}

	/** Finds the group a route's bare ID belongs to, as `/app/chat/<id>` doesn't say. */
	resolve(place: Place): GroupId | undefined {
		if (place.groupId) return place.groupId;
		for (const groupId of [
			`dm/${place.group}`,
			`space/${place.group}`,
		] as const) {
			if (this.#entries.has(groupId)) return groupId;
		}
		return undefined;
	}

	record(sightings: Iterable<Sighting>, now = Date.now()) {
		let changed = false;
		for (const sighting of sightings) {
			changed = this.#record(sighting, now) || changed;
		}
		if (changed) this.#changed();
	}

	/** Notes that a conversation, and thread, was opened, and so has been read. */
	visit(place: Place, now = Date.now()) {
		const groupId = this.resolve(place);
		if (!groupId) return;
		const keys = [entryKey(groupId)];
		if (place.topic) keys.push(entryKey(groupId, place.topic));
		let changed = false;
		for (const key of keys) {
			const entry = this.#entries.get(key);
			if (!entry) continue;
			this.#entries.set(key, { ...entry, visited: now, unread: false });
			changed = true;
		}
		if (changed) this.#changed();
	}

	save() {
		this.storage?.setItem(
			STORAGE_KEY,
			JSON.stringify({
				version: STORAGE_VERSION,
				entries: [...this.#entries.values()],
			}),
		);
	}

	#record(sighting: Sighting, now: number): boolean {
		const key = entryKey(sighting.groupId, sighting.topic);
		const existing = this.#entries.get(key);
		const base: Entry = existing ?? {
			key,
			groupId: sighting.groupId,
			topic: sighting.topic,
			kind: sighting.topic
				? "thread"
				: splitGroupId(sighting.groupId)[0] === "dm"
					? "dm"
					: "space",
			name: "",
			activity: 0,
			visited: 0,
			seen: now,
			unread: false,
			starred: false,
		};
		const entry: Entry = {
			...base,
			kind: (!sighting.topic && sighting.kind) || base.kind,
			name: sighting.name || base.name,
			title: sighting.title || base.title,
			avatar: sighting.avatar ?? base.avatar,
			activity: Math.max(base.activity, sighting.activity ?? 0),
			unread: sighting.unread ?? base.unread,
			starred: sighting.starred ?? base.starred,
			seen: now,
		};
		this.#entries.set(key, entry);
		// Being seen again alone isn't worth telling anyone about.
		return !existing || differs(existing, entry);
	}

	#changed() {
		this.#sorted = undefined;
		for (const listener of this.#listeners) listener();
	}

	#load(now: number) {
		let stored: unknown;
		try {
			stored = JSON.parse(this.storage?.getItem(STORAGE_KEY) ?? "null");
		} catch {
			return;
		}
		if (
			typeof stored !== "object" ||
			stored === null ||
			!("version" in stored) ||
			stored.version !== STORAGE_VERSION ||
			!("entries" in stored) ||
			!Array.isArray(stored.entries)
		) {
			return;
		}
		for (const entry of stored.entries as Entry[]) {
			const retention =
				entry.kind === "thread" ? RETENTION.thread : RETENTION.conversation;
			if (now - Math.max(entry.seen, entry.visited) > retention) continue;
			this.#entries.set(entry.key, entry);
		}
	}
}
