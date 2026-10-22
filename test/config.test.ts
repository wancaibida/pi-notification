import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
	DEFAULT_CONFIG,
	getGlobalConfigFile,
	loadConfig,
	readRawGlobalConfig,
	sanitizeConfig,
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
	assert.equal(DEFAULT_CONFIG.maxSummaryLength, 140);
	assert.equal(DEFAULT_CONFIG.urgency, "normal");
	assert.equal(DEFAULT_CONFIG.expireTimeoutMs, 6000);
});

test("sanitizeConfig cleans and validates inputs", () => {
	const sanitized = sanitizeConfig({
		enabled: false,
		minDurationSeconds: "12",
		sound: true,
		soundEvent: "  bell  ",
		desktopNotification: false,
		terminalNotification: false,
		notifyOnAbort: false,
		includeSummary: false,
		maxSummaryLength: 80.6,
		urgency: "critical",
		expireTimeoutMs: 3000,
		icon: "  /path/to/icon.png  ",
		unknownField: "ignored",
	});

	assert.deepEqual(sanitized, {
		enabled: false,
		minDurationSeconds: 12,
		sound: true,
		soundEvent: "bell",
		desktopNotification: false,
		terminalNotification: false,
		notifyOnAbort: false,
		includeSummary: false,
		maxSummaryLength: 81,
		urgency: "critical",
		expireTimeoutMs: 3000,
		icon: "/path/to/icon.png",
	});

	// Invalid urgency and invalid minDurationSeconds should be omitted
	const invalid = sanitizeConfig({
		urgency: "super-urgent",
		minDurationSeconds: -5,
		maxSummaryLength: -10,
	});
	assert.deepEqual(invalid, {});
});

test("loadConfig and saveGlobalConfig work with isolated environment", () => {
	const tempGlobalDir = fs.mkdtempSync(path.join(os.tmpdir(), "pi-global-config-"));
	const originalEnv = process.env.PI_CODING_AGENT_DIR;
	process.env.PI_CODING_AGENT_DIR = tempGlobalDir;

	try {
		// Fresh load without any file should return DEFAULT_CONFIG
		const initial = loadConfig();
		assert.deepEqual(initial, DEFAULT_CONFIG);

		// Save an update
		const updated = saveGlobalConfig({ sound: false, minDurationSeconds: 10 });
		assert.equal(updated.sound, false);
		assert.equal(updated.minDurationSeconds, 10);
		assert.equal(updated.enabled, true); // Kept default

		// Verify global file exists and contains only specified/sanitized values
		const raw = readRawGlobalConfig();
		assert.equal(raw.sound, false);
		assert.equal(raw.minDurationSeconds, 10);
		assert.equal(raw.enabled, undefined); // Wasn't explicitly set, so not frozen into raw json

		// Reload configuration
		const reloaded = loadConfig();
		assert.equal(reloaded.sound, false);
		assert.equal(reloaded.minDurationSeconds, 10);
		assert.equal(reloaded.enabled, true);
	} finally {
		if (originalEnv !== undefined) {
			process.env.PI_CODING_AGENT_DIR = originalEnv;
		} else {
			delete process.env.PI_CODING_AGENT_DIR;
		}
		fs.rmSync(tempGlobalDir, { recursive: true, force: true });
	}
});

test("loadConfig merges project-specific overrides if present", () => {
	const tempGlobalDir = fs.mkdtempSync(path.join(os.tmpdir(), "pi-global-config-"));
	const tempProjectDir = fs.mkdtempSync(path.join(os.tmpdir(), "pi-project-config-"));
	const originalEnv = process.env.PI_CODING_AGENT_DIR;
	process.env.PI_CODING_AGENT_DIR = tempGlobalDir;

	try {
		const piDir = path.join(tempProjectDir, ".pi");
		fs.mkdirSync(piDir, { recursive: true });
		fs.writeFileSync(
			path.join(piDir, "notification.json"),
			JSON.stringify({ minDurationSeconds: 15, sound: false }),
		);

		const config = loadConfig(tempProjectDir);
		assert.equal(config.minDurationSeconds, 15);
		assert.equal(config.sound, false);
		assert.equal(config.enabled, true); // Kept default
	} finally {
		if (originalEnv !== undefined) {
			process.env.PI_CODING_AGENT_DIR = originalEnv;
		} else {
			delete process.env.PI_CODING_AGENT_DIR;
		}
		fs.rmSync(tempGlobalDir, { recursive: true, force: true });
		fs.rmSync(tempProjectDir, { recursive: true, force: true });
	}
});

test("loadConfig recovers gracefully from corrupted JSON file", () => {
	const tempGlobalDir = fs.mkdtempSync(path.join(os.tmpdir(), "pi-corrupt-config-"));
	const originalEnv = process.env.PI_CODING_AGENT_DIR;
	process.env.PI_CODING_AGENT_DIR = tempGlobalDir;

	try {
		fs.writeFileSync(getGlobalConfigFile(), "{ invalid json: true ");
		const config = loadConfig();
		assert.deepEqual(config, DEFAULT_CONFIG);
	} finally {
		if (originalEnv !== undefined) {
			process.env.PI_CODING_AGENT_DIR = originalEnv;
		} else {
			delete process.env.PI_CODING_AGENT_DIR;
		}
		fs.rmSync(tempGlobalDir, { recursive: true, force: true });
	}
});
