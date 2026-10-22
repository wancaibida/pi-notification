import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { getEffectiveConfig, handleNotifyCommand } from "../src/index.ts";
import { loadConfig } from "../src/config.ts";

function createMockPi(flags: Record<string, any> = {}) {
	return {
		getFlag: (name: string) => flags[name],
	} as any;
}

test("getEffectiveConfig respects config file when flags are undefined", () => {
	const tempGlobalDir = fs.mkdtempSync(path.join(os.tmpdir(), "pi-index-test-"));
	const originalEnv = process.env.PI_CODING_AGENT_DIR;
	process.env.PI_CODING_AGENT_DIR = tempGlobalDir;

	try {
		const pi = createMockPi({});
		const config = getEffectiveConfig(pi);
		assert.equal(config.enabled, true);
		assert.equal(config.sound, true);
		assert.equal(config.minDurationSeconds, 5);
	} finally {
		if (originalEnv !== undefined) {
			process.env.PI_CODING_AGENT_DIR = originalEnv;
		} else {
			delete process.env.PI_CODING_AGENT_DIR;
		}
		fs.rmSync(tempGlobalDir, { recursive: true, force: true });
	}
});

test("getEffectiveConfig overrides config with CLI flags", () => {
	const tempGlobalDir = fs.mkdtempSync(path.join(os.tmpdir(), "pi-index-test-"));
	const originalEnv = process.env.PI_CODING_AGENT_DIR;
	process.env.PI_CODING_AGENT_DIR = tempGlobalDir;

	try {
		const pi = createMockPi({
			notify: false,
			"notify-sound": false,
			"notify-threshold": "15",
		});
		const config = getEffectiveConfig(pi);
		assert.equal(config.enabled, false);
		assert.equal(config.sound, false);
		assert.equal(config.minDurationSeconds, 15);
	} finally {
		if (originalEnv !== undefined) {
			process.env.PI_CODING_AGENT_DIR = originalEnv;
		} else {
			delete process.env.PI_CODING_AGENT_DIR;
		}
		fs.rmSync(tempGlobalDir, { recursive: true, force: true });
	}
});

test("handleNotifyCommand executes subcommands correctly", async () => {
	const tempGlobalDir = fs.mkdtempSync(path.join(os.tmpdir(), "pi-cmd-test-"));
	const originalEnv = process.env.PI_CODING_AGENT_DIR;
	process.env.PI_CODING_AGENT_DIR = tempGlobalDir;

	const notifications: Array<{ msg: string; type: string }> = [];
	const mockCtx = {
		hasUI: true,
		cwd: tempGlobalDir,
		ui: {
			notify: (msg: string, type: string) => {
				notifications.push({ msg, type });
			},
		},
	} as any;

	try {
		// 1. /notify off
		await handleNotifyCommand("off", mockCtx);
		let cfg = loadConfig();
		assert.equal(cfg.enabled, false);
		assert.ok(notifications.at(-1)?.msg.includes("disabled"));

		// 2. /notify on
		await handleNotifyCommand("on", mockCtx);
		cfg = loadConfig();
		assert.equal(cfg.enabled, true);
		assert.ok(notifications.at(-1)?.msg.includes("enabled"));

		// 3. /notify toggle
		await handleNotifyCommand("toggle", mockCtx);
		cfg = loadConfig();
		assert.equal(cfg.enabled, false);

		// 4. /notify threshold 10
		await handleNotifyCommand("threshold 10", mockCtx);
		cfg = loadConfig();
		assert.equal(cfg.minDurationSeconds, 10);

		// 5. /notify sound off
		await handleNotifyCommand("sound off", mockCtx);
		cfg = loadConfig();
		assert.equal(cfg.sound, false);

		// 6. /notify summary off
		await handleNotifyCommand("summary off", mockCtx);
		cfg = loadConfig();
		assert.equal(cfg.includeSummary, false);

		// 7. /notify help
		await handleNotifyCommand("help", mockCtx);
		assert.ok(notifications.at(-1)?.msg.includes("Available /notify commands"));

		// 8. /notify (status)
		await handleNotifyCommand("", mockCtx);
		assert.ok(notifications.at(-1)?.msg.includes("Pi Notification"));
	} finally {
		if (originalEnv !== undefined) {
			process.env.PI_CODING_AGENT_DIR = originalEnv;
		} else {
			delete process.env.PI_CODING_AGENT_DIR;
		}
		fs.rmSync(tempGlobalDir, { recursive: true, force: true });
	}
});
