// Reads conversations and threads off Chat's page.
//
// Chat's markup is minified, so these lean on its data attributes, which look
// least likely to change between its releases, and on `jsname`s where nothing
// else marks the element.

import type { Avatar, Sighting } from "./directory";
import type { GroupId } from "./routes";

/** A row in Home, which lists every conversation and thread with recent activity. */
const HOME_ROW = "[role=listitem][data-group-id][data-group-type]";
/** A conversation in the navigation sidebar. */
const SIDEBAR_ITEM = "[role=listitem][data-group-id][data-starred]";

const HOME_NAME = '[jsname="VYJYmb"]';
const HOME_AVATAR = '[jsname="aXLJRd"]';
/** A thread's first message, after its author's name. */
const HOME_THREAD_MESSAGE = '[jsname="JzStRd"] [jsname="ok3btb"]';
/** Wraps the name (then a visually hidden description) of a sidebar conversation. */
const SIDEBAR_LABEL = '[jsname="dfY7oc"]';

/** Chat's `data-group-type`s. Spaces include group conversations, which are unnamed spaces. */
const GROUP_TYPES = {
	2: "app",
	4: "space",
	6: "dm",
	10: "meeting",
} as const;

const GROUP_ID = /^(dm|space)\/[\w-]+$/;

function groupIdOf(element: Element): GroupId | undefined {
	const id = element.getAttribute("data-group-id");
	return id && GROUP_ID.test(id) ? (id as GroupId) : undefined;
}

function clean(text: string | null | undefined): string | undefined {
	return text?.replace(/\s+/g, " ").trim() || undefined;
}

function textOf(element: Element | null | undefined): string | undefined {
	return clean(element?.textContent);
}

/** The element's own text, leaving out badges like "App" that Chat nests in it. */
function ownTextOf(element: Element | null | undefined): string | undefined {
	if (!element) return undefined;
	const own = [...element.childNodes]
		.filter((node) => node.nodeType === Node.TEXT_NODE)
		.map((node) => node.textContent)
		.join("");
	return clean(own) ?? textOf(element);
}

function timestampOf(element: Element): number | undefined {
	const timestamp = Number(element.getAttribute("data-display-timestamp"));
	return timestamp > 0 ? timestamp : undefined;
}

/** Google's image server sizes images by the options after `=`, like `=s20-c`. */
const IMAGE_OPTIONS = /=[\w-]*$/;
/** Twice the size the switcher shows avatars at, for high-density screens. */
const AVATAR_OPTIONS = "=s64-c";

function avatarOf(element: Element | null | undefined): Avatar | undefined {
	const image = element?.querySelector("img");
	if (!image) return undefined;
	const emoji = image.getAttribute("data-emoji");
	if (emoji) return { emoji };
	if (!image.src.startsWith("https://")) return undefined;
	// Each list asks for its own size, so ask for one size to keep the URL the same.
	const url = new URL(image.src);
	if (url.hostname.endsWith(".googleusercontent.com")) {
		url.pathname = url.pathname.replace(IMAGE_OPTIONS, "") + AVATAR_OPTIONS;
	}
	return { url: url.href };
}

function* homeSightings(row: Element): Iterable<Sighting> {
	const groupId = groupIdOf(row);
	if (!groupId) return;
	const type = Number(row.getAttribute("data-group-type"));
	let kind: Sighting["kind"] = GROUP_TYPES[type as keyof typeof GROUP_TYPES];
	const avatarElement = row.querySelector(HOME_AVATAR);
	const avatar = avatarOf(avatarElement);
	// Group conversations show their members' faces, where spaces have one icon.
	if (
		kind === "space" &&
		!avatar?.emoji &&
		(avatarElement?.querySelectorAll("img").length ?? 0) > 1
	) {
		kind = "group";
	}
	const name = ownTextOf(row.querySelector(HOME_NAME));
	const activity = timestampOf(row);
	const unread = row.getAttribute("data-is-unread") === "true";
	const topic = row.getAttribute("data-topic-id") || undefined;

	if (!topic) {
		yield { groupId, kind, name, avatar, activity, unread };
		return;
	}
	yield { groupId, kind, name, avatar, activity };
	const title = textOf(row.querySelector(HOME_THREAD_MESSAGE));
	yield { groupId, topic, name, title, avatar, activity, unread };
}

function sidebarSighting(item: Element): Sighting | undefined {
	const groupId = groupIdOf(item);
	if (!groupId) return undefined;
	const label = item.querySelector(SIDEBAR_LABEL)?.firstElementChild;
	// Group conversations are named after their members, so their names are made
	// of people; the sidebar doesn't otherwise tell DMs from apps.
	const kind = groupId.startsWith("space/")
		? label?.querySelector("[data-member-id]")
			? "group"
			: "space"
		: undefined;
	return {
		groupId,
		kind,
		name: textOf(label),
		avatar: avatarOf(item),
		activity: timestampOf(item),
		starred: item.getAttribute("data-starred") === "true",
	};
}

/** Everything about conversations and threads that the page currently shows. */
export function* harvest(root: ParentNode = document): Iterable<Sighting> {
	for (const item of root.querySelectorAll(SIDEBAR_ITEM)) {
		const sighting = sidebarSighting(item);
		if (sighting) yield sighting;
	}
	for (const row of root.querySelectorAll(HOME_ROW)) yield* homeSightings(row);
}
