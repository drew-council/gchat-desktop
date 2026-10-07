import { Command, defaultFilter } from "cmdk";
import { useCallback, useMemo, useState, useSyncExternalStore } from "react";
import type { Directory, Entry, Kind } from "./directory";
import { conversationPath, type GroupId, searchPath } from "./routes";
import { inScope, parseQuery, SCOPES, type Scope, score } from "./search";

/** Icons are ligatures in Google Symbols, the icon font Chat loads. */
const KINDS: Record<Kind, { icon: string; label: string }> = {
	dm: { icon: "person", label: "Direct message" },
	group: { icon: "group", label: "Group conversation" },
	space: { icon: "tag", label: "Space" },
	meeting: { icon: "videocam", label: "Meeting chat" },
	app: { icon: "smart_toy", label: "App" },
	thread: { icon: "forum", label: "Thread" },
};

const PLACES = [
	{ path: "/app/home", icon: "home", label: "Home" },
	{ path: "/app/mentions", icon: "alternate_email", label: "Mentions" },
	{ path: "/app/starred", icon: "star", label: "Starred" },
];

const SEARCH_VALUE = "search";

/** When something last happened, the way Chat's own lists put it. */
function formatWhen(time: number, now = new Date()): string {
	const date = new Date(time);
	const age = now.getTime() - time;
	if (date.toDateString() === now.toDateString()) {
		return date.toLocaleTimeString(undefined, {
			hour: "numeric",
			minute: "2-digit",
		});
	}
	if (age < 6 * 24 * 60 * 60 * 1000) {
		return date.toLocaleDateString(undefined, { weekday: "short" });
	}
	return date.toLocaleDateString(undefined, {
		month: "short",
		day: "numeric",
		year: date.getFullYear() === now.getFullYear() ? undefined : "numeric",
	});
}

function Icon({ name }: { name: string }) {
	return (
		<span className="icon" aria-hidden>
			{name}
		</span>
	);
}

function Avatar({ entry }: { entry: Entry }) {
	const [failed, setFailed] = useState(false);
	const { emoji, url } = entry.avatar ?? {};
	if (emoji) {
		return (
			<span className="avatar" aria-hidden>
				{emoji}
			</span>
		);
	}
	if (url && !failed) {
		return (
			<img
				className="avatar"
				src={url}
				alt=""
				loading="lazy"
				onError={() => setFailed(true)}
			/>
		);
	}
	return (
		<span className="avatar">
			<Icon name={KINDS[entry.kind].icon} />
		</span>
	);
}

function EntryItem({
	entry,
	current,
	onOpen,
}: {
	entry: Entry;
	current: boolean;
	onOpen: (path: string) => void;
}) {
	const thread = entry.kind === "thread";
	const description = [
		thread ? `Thread in ${entry.name}` : KINDS[entry.kind].label,
		current && "Open now",
	]
		.filter(Boolean)
		.join(" · ");
	return (
		<Command.Item
			value={entry.key}
			onSelect={() => onOpen(conversationPath(entry.groupId, entry.topic))}
			data-unread={entry.unread || undefined}
		>
			<Avatar entry={entry} />
			<span className="text">
				<span className="primary">
					{thread ? (entry.title ?? "Thread") : entry.name}
				</span>
				<span className="secondary">{description}</span>
			</span>
			{entry.starred && <Icon name="star" />}
			{entry.activity > 0 && (
				<span className="when">{formatWhen(entry.activity)}</span>
			)}
		</Command.Item>
	);
}

/** What Chat has open. */
export interface Current {
	groupId: GroupId;
	topic?: string;
}

/** Whether an entry is the conversation, or the thread, Chat has open. */
function isCurrent(entry: Entry, current: Current | undefined): boolean {
	return (
		entry.groupId === current?.groupId &&
		(!entry.topic || entry.topic === current.topic)
	);
}

export interface PaletteProps {
	directory: Directory;
	/** Listed last, so that the conversation you were in before comes first. */
	current?: Current;
	onOpen: (path: string) => void;
}

export function Palette({ directory, current, onOpen }: PaletteProps) {
	const entries = useSyncExternalStore(directory.subscribe, directory.entries);
	const [input, setInput] = useState("");
	const { scope, text } = parseQuery(input);

	const byKey = useMemo(
		() => new Map(entries.map((entry) => [entry.key, entry])),
		[entries],
	);
	const { conversations, threads } = useMemo(() => {
		const visible = entries.filter(
			(entry) => entry.name && inScope(entry, scope),
		);
		const currentLast = (list: Entry[]) => [
			...list.filter((entry) => !isCurrent(entry, current)),
			...list.filter((entry) => isCurrent(entry, current)),
		];
		return {
			conversations: currentLast(
				visible.filter((entry) => entry.kind !== "thread"),
			),
			threads: currentLast(visible.filter((entry) => entry.kind === "thread")),
		};
	}, [entries, scope, current]);

	const filter = useCallback(
		(value: string, search: string) => {
			const { text } = parseQuery(search);
			const entry = byKey.get(value);
			if (entry) return score(entry, text);
			const place = PLACES.find((place) => place.path === value);
			if (place) return text ? defaultFilter(place.label, text) : 1;
			// Searching messages always comes last.
			return 0;
		},
		[byKey],
	);

	return (
		<Command label="Switch conversations" filter={filter} loop>
			<div className="search">
				<Icon name="search" />
				<Command.Input
					value={input}
					onValueChange={setInput}
					placeholder="Jump to a conversation, space, or thread"
				/>
			</div>
			<Command.List>
				<Command.Empty>No conversations match</Command.Empty>
				<Command.Group heading="Conversations">
					{conversations.map((entry) => (
						<EntryItem
							key={entry.key}
							entry={entry}
							current={isCurrent(entry, current)}
							onOpen={onOpen}
						/>
					))}
				</Command.Group>
				<Command.Group heading="Threads">
					{threads.map((entry) => (
						<EntryItem
							key={entry.key}
							entry={entry}
							current={isCurrent(entry, current)}
							onOpen={onOpen}
						/>
					))}
				</Command.Group>
				{!scope && (
					<Command.Group heading="Go to">
						{PLACES.map((place) => (
							<Command.Item
								key={place.path}
								value={place.path}
								onSelect={() => onOpen(place.path)}
							>
								<span className="avatar">
									<Icon name={place.icon} />
								</span>
								<span className="text">
									<span className="primary">{place.label}</span>
								</span>
							</Command.Item>
						))}
					</Command.Group>
				)}
				{text && (
					<Command.Group>
						<Command.Item
							value={SEARCH_VALUE}
							forceMount
							onSelect={() => onOpen(searchPath(text))}
						>
							<span className="avatar">
								<Icon name="manage_search" />
							</span>
							<span className="text">
								<span className="primary">Search messages for “{text}”</span>
							</span>
						</Command.Item>
					</Command.Group>
				)}
			</Command.List>
			<Footer scope={scope} />
		</Command>
	);
}

function Footer({ scope }: { scope?: Scope }) {
	return (
		<div className="footer">
			<span>
				<kbd>↑</kbd>
				<kbd>↓</kbd> to move
			</span>
			<span>
				<kbd>↵</kbd> to open
			</span>
			<span className="scopes">
				{scope ? (
					<>Only {SCOPES[scope].label}</>
				) : (
					(Object.keys(SCOPES) as Scope[]).map((prefix) => (
						<span key={prefix}>
							<kbd>{prefix}</kbd> {SCOPES[prefix].label}
						</span>
					))
				)}
			</span>
		</div>
	);
}
