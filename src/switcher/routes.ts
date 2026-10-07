// Chat's in-app routes, and switching between them without a page load.

/** A DM (including with an app) or a space (including group conversations). */
export type GroupId = `dm/${string}` | `space/${string}`;

/** Where Chat is, as far as the switcher cares. */
export interface Place {
	/** The group's ID without its `dm/` or `space/` prefix, as in `/app/chat/<id>`. */
	group: string;
	/** Set when the route says which kind of group it is. */
	groupId?: GroupId;
	topic?: string;
}

export function splitGroupId(groupId: GroupId): ["dm" | "space", string] {
	const slash = groupId.indexOf("/");
	return [groupId.slice(0, slash) as "dm" | "space", groupId.slice(slash + 1)];
}

/** The route that opens a conversation, or one with a thread open beside it. */
export function conversationPath(groupId: GroupId, topic?: string): string {
	const path = `/app/chat/${encodeURIComponent(splitGroupId(groupId)[1])}`;
	return topic ? `${path}/topic/${encodeURIComponent(topic)}` : path;
}

export function searchPath(query: string): string {
	return `/app/search?${new URLSearchParams({ q: query })}`;
}

const ACCOUNT_PREFIX = /^\/u\/\d+(?=\/)/;

/** Keeps a route on the signed-in account the current path is on, like `/u/1/`. */
export function inAccountOf(path: string, currentPathname: string): string {
	return (currentPathname.match(ACCOUNT_PREFIX)?.[0] ?? "") + path;
}

/** Reads which conversation, and thread, a Chat path shows. */
export function parsePlace(pathname: string): Place | undefined {
	const parts = pathname
		.replace(ACCOUNT_PREFIX, "")
		.split("/")
		.filter(Boolean)
		.map((part) => decodeURIComponent(part));

	const [first, second, third, fourth, fifth] = parts;
	if (first === "app" && second === "chat" && third) {
		// `topic` shows the thread beside its conversation, `thread` on its own.
		const topic = fourth === "topic" || fourth === "thread" ? fifth : undefined;
		return { group: third, topic };
	}
	// Older routes, which Chat still accepts.
	if ((first === "room" || first === "dm") && second) {
		const kind = first === "room" ? "space" : "dm";
		return { group: second, groupId: `${kind}/${second}`, topic: third };
	}
	return undefined;
}

/**
 * Switches Chat to a route of its own. Chat routes on `popstate`, so pushing
 * the route and announcing it navigates in place, like following a link would.
 */
export function navigate(path: string) {
	history.pushState(null, "", inAccountOf(path, location.pathname));
	window.dispatchEvent(new PopStateEvent("popstate", { state: null }));
}
