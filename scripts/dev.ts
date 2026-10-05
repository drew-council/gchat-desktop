// Runs the app and keeps it up to date with `src/` as it changes:
//
// - `patches.css` is swapped into open pages in place.
// - Preload changes reload the pages.
// - Main process changes restart Electron.
//
// Run with `bun run dev`; arguments after it are passed to Electron.

import { watch } from "node:fs";
import path from "node:path";
import electron from "electron";
import type { DevCommand } from "../src/dev";

const root = path.join(import.meta.dirname, "..");
const src = path.join(root, "src");
const outputs = {
	main: path.join(root, "dist/main.js"),
	preload: path.join(root, "dist/preload.cjs"),
};

async function hash(file: string) {
	return Bun.hash(await Bun.file(file).arrayBuffer());
}

async function build() {
	const proc = Bun.spawn(["bun", "run", "build"], {
		cwd: root,
		stdout: "ignore",
		stderr: "inherit",
	});
	return (await proc.exited) === 0;
}

let app: Bun.Subprocess<"pipe", "inherit", "inherit"> | undefined;

function launch() {
	const proc = Bun.spawn(
		[electron as unknown as string, ".", ...process.argv.slice(2)],
		{
			cwd: root,
			env: { ...process.env, GCHAT_DEV: "1" },
			stdin: "pipe",
			stdout: "inherit",
			stderr: "inherit",
		},
	);
	app = proc;
	// Quitting the app ends the session, unless we're the ones restarting it.
	void proc.exited.then((code) => {
		if (app === proc) process.exit(code);
	});
}

async function stop() {
	const proc = app;
	app = undefined;
	if (!proc) return;
	proc.kill();
	await proc.exited;
}

function send(command: DevCommand) {
	app?.stdin.write(`${JSON.stringify(command)}\n`);
	void app?.stdin.flush();
}

const isSource = (file: string) => !file.endsWith(".test.ts");

if (!(await build())) process.exit(1);
let hashes = {
	main: await hash(outputs.main),
	preload: await hash(outputs.preload),
};
launch();

let changed = new Set<string>();
let timer: Timer | undefined;
let running = Promise.resolve();

watch(src, { recursive: true }, (_event, file) => {
	if (!file || !isSource(file)) return;
	changed.add(file);
	// Editors often write a file in several steps, so wait for them to settle.
	clearTimeout(timer);
	timer = setTimeout(() => {
		const files = changed;
		changed = new Set();
		running = running.then(() => update(files));
	}, 100);
});

async function update(files: Set<string>) {
	console.log(`[dev] changed: ${[...files].join(", ")}`);
	if (!(await build())) {
		console.log("[dev] build failed; keeping the running app");
		return;
	}
	const next = {
		main: await hash(outputs.main),
		preload: await hash(outputs.preload),
	};
	// The CSS is bundled into main, but is swapped live rather than restarting.
	const cssOnly = [...files].every((file) => file === "patches.css");
	const mainChanged = next.main !== hashes.main && !cssOnly;
	const preloadChanged = next.preload !== hashes.preload;
	hashes = next;

	if (mainChanged) {
		console.log("[dev] restarting");
		await stop();
		launch();
		return;
	}
	if (preloadChanged) {
		console.log("[dev] reloading pages");
		send({ type: "reload" });
	}
	if (files.has("patches.css")) {
		console.log("[dev] updating patches.css");
		send({
			type: "css",
			css: await Bun.file(path.join(src, "patches.css")).text(),
		});
	}
}

for (const signal of ["SIGINT", "SIGTERM"] as const) {
	process.on(signal, async () => {
		await stop();
		process.exit(0);
	});
}
