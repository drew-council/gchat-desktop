import readline from "node:readline";

/** Set by `bun run dev`, which drives the app through `DevCommand`s on stdin. */
export const isDev = Boolean(process.env.GCHAT_DEV);

export type DevCommand =
	/** The preload script changed, so pages need a reload to run it. */
	| { type: "reload" }
	/** `patches.css` changed; swap it into open pages in place. */
	| { type: "css"; css: string };

/** Calls `handler` with each command the dev runner sends, one JSON object per line. */
export function onDevCommand(handler: (command: DevCommand) => void) {
	readline
		.createInterface({ input: process.stdin })
		.on("line", (line) => handler(JSON.parse(line) as DevCommand));
}
