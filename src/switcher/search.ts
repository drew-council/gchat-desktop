// Narrowing and matching what the switcher lists against what's typed.

import { defaultFilter } from "cmdk";
import type { Entry, Kind } from "./directory";

/** Prefixes that narrow the list to one sort of thing, as in Discord's switcher. */
export const SCOPES = {
	"@": { label: "people", kinds: ["dm", "group", "app"] },
	"#": { label: "spaces", kinds: ["space", "meeting"] },
	">": { label: "threads", kinds: ["thread"] },
} as const satisfies Record<string, { label: string; kinds: Kind[] }>;

export type Scope = keyof typeof SCOPES;

export interface Query {
	scope?: Scope;
	text: string;
}

function isScope(char: string): char is Scope {
	return Object.hasOwn(SCOPES, char);
}

export function parseQuery(input: string): Query {
	const trimmed = input.trimStart();
	const first = trimmed.charAt(0);
	if (isScope(first)) return { scope: first, text: trimmed.slice(1).trim() };
	return { text: trimmed.trim() };
}

export function inScope(entry: Entry, scope: Scope | undefined): boolean {
	return (
		!scope || (SCOPES[scope].kinds as readonly Kind[]).includes(entry.kind)
	);
}

/** Threads would otherwise tie with the conversation they're in. */
const THREAD_WEIGHT = 0.9;
/**
 * cmdk's scoring matches letters scattered anywhere, as "eng" in "Bot
 * Testing"; those score well below any match on word starts or typos.
 */
const MIN_SCORE = 0.05;

/** How well an entry matches, from 0 (not at all) to 1, using cmdk's own scoring. */
export function score(entry: Entry, text: string): number {
	if (!text) return 1;
	const score =
		entry.kind === "thread"
			? THREAD_WEIGHT * defaultFilter(entry.title ?? "", text, [entry.name])
			: defaultFilter(entry.name, text);
	return score < MIN_SCORE ? 0 : score;
}
