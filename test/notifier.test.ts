import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import {
	notifyUser,
	resolveIcon,
	sendTerminalNotification,
} from "../src/notifier.ts";
import { DEFAULT_CONFIG } from "../src/config.ts";

test("resolveIcon returns custom path if it exists", () => {
	const icon = resolveIcon("/usr/share/sounds/freedesktop/stereo/complete.oga");
	assert.equal(icon, "/usr/share/sounds/freedesktop/stereo/complete.oga");
});

test("resolveIcon returns stock icon name if provided", () => {
	const icon = resolveIcon("dialog-information");
	assert.equal(icon, "dialog-information");
});

test("resolveIcon returns default pi-logo.svg when no custom icon is specified", () => {
	const icon = resolveIcon();
	assert.ok(icon.endsWith("pi-logo.svg") || icon === "dialog-information");
	if (icon.endsWith("pi-logo.svg")) {
		assert.ok(fs.existsSync(icon));
	}
});

test("sendTerminalNotification emits correct OSC sequence and sanitizes input", () => {
	let output = "";
	const originalWrite = process.stdout.write;
	process.stdout.write = ((chunk: any) => {
		output += String(chunk);
		return true;
	}) as any;

	const origKitty = process.env.KITTY_WINDOW_ID;
	const origWT = process.env.WT_SESSION;

	try {
		// 1. Standard Wayland / Linux terminal (OSC 777)
		delete process.env.KITTY_WINDOW_ID;
		delete process.env.WT_SESSION;
		output = "";
		sendTerminalNotification("Job;Done", "All 3;tasks passed\nSuccessfully");
		assert.ok(output.startsWith("\x1b]777;notify;Job - Done;All 3 - tasks passed Successfully\x07"));
		assert.ok(!output.includes("\x1b]9;")); // Does not duplicate with OSC 9

		// 2. Kitty terminal (OSC 99 with d=1 completion)
		process.env.KITTY_WINDOW_ID = "123";
		output = "";
		sendTerminalNotification("Kitty Title", "Kitty Body");
		assert.ok(output.includes("\x1b]99;i=1:d=0;Kitty Title\x1b\\"));
		assert.ok(output.includes("\x1b]99;i=1:p=body:d=1;Kitty Body\x1b\\"));

		// 3. Windows Terminal (OSC 9)
		delete process.env.KITTY_WINDOW_ID;
		process.env.WT_SESSION = "guid";
		output = "";
		sendTerminalNotification("WT Title", "WT Body");
		assert.ok(output.startsWith("\x1b]9;WT Title: WT Body\x07"));
	} finally {
		process.stdout.write = originalWrite;
		if (origKitty !== undefined) process.env.KITTY_WINDOW_ID = origKitty;
		else delete process.env.KITTY_WINDOW_ID;
		if (origWT !== undefined) process.env.WT_SESSION = origWT;
		else delete process.env.WT_SESSION;
	}
});

test("notifyUser respects disabled config", () => {
	let output = "";
	const originalWrite = process.stdout.write;
	process.stdout.write = ((chunk: any) => {
		output += String(chunk);
		return true;
	}) as any;

	try {
		notifyUser(
			{ title: "Test", body: "Hello" },
			{ ...DEFAULT_CONFIG, enabled: false },
		);
		assert.equal(output, "");
	} finally {
		process.stdout.write = originalWrite;
	}
});
