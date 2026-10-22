import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { NotificationConfig } from "./types.ts";

export const DEFAULT_CONFIG: NotificationConfig = {
	enabled: true,
	minDurationSeconds: 5,
	sound: true,
	soundEvent: "complete",
	desktopNotification: true,
	terminalNotification: true,
	notifyOnAbort: true,
	includeSummary: true,
	maxSummaryLength: 140,
	urgency: "normal",
	expireTimeoutMs: 6000,
	icon: "",
};

export function getGlobalConfigDir(): string {
	return process.env.PI_CODING_AGENT_DIR || path.join(os.homedir(), ".pi", "agent");
}

export function getGlobalConfigFile(): string {
	return path.join(getGlobalConfigDir(), "notification.json");
}

export function getProjectConfigFile(cwd?: string): string | null {
	if (!cwd) return null;
	const projectConfig = path.join(cwd, ".pi", "notification.json");
	return fs.existsSync(projectConfig) ? projectConfig : null;
}

export function loadConfig(cwd?: string): NotificationConfig {
	let config: NotificationConfig = { ...DEFAULT_CONFIG };

	// 1. Try global configuration
	const globalFile = getGlobalConfigFile();
	if (fs.existsSync(globalFile)) {
		try {
			const data = JSON.parse(fs.readFileSync(globalFile, "utf-8"));
			config = { ...config, ...data };
		} catch {
			// Ignore parse errors and keep defaults
		}
	}

	// 2. Try project override if present
	const projectFile = getProjectConfigFile(cwd);
	if (projectFile) {
		try {
			const data = JSON.parse(fs.readFileSync(projectFile, "utf-8"));
			config = { ...config, ...data };
		} catch {
			// Ignore parse errors
		}
	}

	return config;
}

export function saveGlobalConfig(updates: Partial<NotificationConfig>): NotificationConfig {
	const current = loadConfig();
	const next: NotificationConfig = { ...current, ...updates };

	const globalDir = getGlobalConfigDir();
	if (!fs.existsSync(globalDir)) {
		fs.mkdirSync(globalDir, { recursive: true });
	}

	const globalFile = getGlobalConfigFile();
	fs.writeFileSync(globalFile, JSON.stringify(next, null, 2), "utf-8");
	return next;
}
