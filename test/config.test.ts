import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
	DEFAULT_CONFIG,
	getGlobalConfigFile,
	loadConfig,
	saveGlobalConfig,
} from "../src/config.ts";

test("DEFAULT_CONFIG has expected defaults", () => {
	assert.equal(DEFAULT_CONFIG.enabled, true);
	assert.equal(DEFAULT_CONFIG.minDurationSeconds, 5);
	assert.equal(DEFAULT_CONFIG.sound, true);
	assert.equal(DEFAULT_CONFIG.desktopNotification, true);
	assert.equal(DEFAULT_CONFIG.terminalNotification, true);
	assert.equal(DEFAULT_CONFIG.notifyOnAbort, true);
	assert.equal(DEFAULT_CONFIG.includeSummary, true);
});

test("loadConfig merges project-specific overrides if present", () => {
	const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "pi-test-config-"));
	try {
		const piDir = path.join(tempDir, ".pi");
		fs.mkdirSync(piDir, { recursive: true });
		fs.writeFileSync(
			path.join(piDir, "notification.json"),
			JSON.stringify({ minDurationSeconds: 15, sound: false }),
		);

		const config = loadConfig(tempDir);
		assert.equal(config.minDurationSeconds, 15);
		assert.equal(config.sound, false);
		assert.equal(config.enabled, true); // Kept default
	} finally {
		fs.rmSync(tempDir, { recursive: true, force: true });
	}
});
