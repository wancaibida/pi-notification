import assert from "node:assert/strict";
import test from "node:test";
import {
	attemptCommand,
	COMMON_SOUND_PATHS,
	playSound,
	ringTerminalBell,
} from "../src/sound.ts";

test("COMMON_SOUND_PATHS defines paths for complete, bell, and warning", () => {
	assert.ok(Array.isArray(COMMON_SOUND_PATHS.complete));
	assert.ok(Array.isArray(COMMON_SOUND_PATHS.bell));
	assert.ok(Array.isArray(COMMON_SOUND_PATHS.warning));
	assert.ok(COMMON_SOUND_PATHS.complete.length > 0);
});

test("attemptCommand returns false for non-existent command", async () => {
	const res = await attemptCommand("non_existent_command_12345", ["-x"]);
	assert.equal(res, false);
});

test("ringTerminalBell writes \\x07 to stdout", () => {
	let output = "";
	const originalWrite = process.stdout.write;
	process.stdout.write = ((chunk: any) => {
		output += String(chunk);
		return true;
	}) as any;

	try {
		const res = ringTerminalBell();
		assert.equal(res, true);
		assert.equal(output, "\x07");
	} finally {
		process.stdout.write = originalWrite;
	}
});

test("playSound runs without throwing when given unknown event", async () => {
	let output = "";
	const originalWrite = process.stdout.write;
	process.stdout.write = ((chunk: any) => {
		output += String(chunk);
		return true;
	}) as any;

	try {
		const res = await playSound("unknown-event-xyz");
		assert.equal(typeof res, "boolean");
	} finally {
		process.stdout.write = originalWrite;
	}
});
