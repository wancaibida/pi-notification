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

export function sanitizeConfig(raw: unknown): Partial<NotificationConfig> {
	if (!raw || typeof raw !== "object") return {};
	const record = raw as Record<string, unknown>;
	const clean: Partial<NotificationConfig> = {};

	if (typeof record.enabled === "boolean") {
		clean.enabled = record.enabled;
	}

	if (typeof record.minDurationSeconds === "number" && !Number.isNaN(record.minDurationSeconds) && record.minDurationSeconds >= 0) {
		clean.minDurationSeconds = record.minDurationSeconds;
	} else if (typeof record.minDurationSeconds === "string") {
		const parsed = Number.parseFloat(record.minDurationSeconds);
		if (!Number.isNaN(parsed) && parsed >= 0) {
			clean.minDurationSeconds = parsed;
		}
	}

	if (typeof record.sound === "boolean") {
		clean.sound = record.sound;
	}

	if (typeof record.soundEvent === "string" && record.soundEvent.trim().length > 0) {
		clean.soundEvent = record.soundEvent.trim();
	}

	if (typeof record.desktopNotification === "boolean") {
		clean.desktopNotification = record.desktopNotification;
	}

	if (typeof record.terminalNotification === "boolean") {
		clean.terminalNotification = record.terminalNotification;
	}

	if (typeof record.notifyOnAbort === "boolean") {
		clean.notifyOnAbort = record.notifyOnAbort;
	}

	if (typeof record.includeSummary === "boolean") {
		clean.includeSummary = record.includeSummary;
	}

	if (typeof record.maxSummaryLength === "number" && record.maxSummaryLength > 0) {
		clean.maxSummaryLength = Math.round(record.maxSummaryLength);
	}

	if (record.urgency === "low" || record.urgency === "normal" || record.urgency === "critical") {
		clean.urgency = record.urgency;
	}

	if (typeof record.expireTimeoutMs === "number" && record.expireTimeoutMs >= 0) {
		clean.expireTimeoutMs = Math.round(record.expireTimeoutMs);
	}

	if (typeof record.icon === "string") {
		clean.icon = record.icon.trim();
	}

	return clean;
}

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

export function readRawGlobalConfig(): Partial<NotificationConfig> {
	const globalFile = getGlobalConfigFile();
	if (fs.existsSync(globalFile)) {
		try {
			const data = JSON.parse(fs.readFileSync(globalFile, "utf-8"));
			return sanitizeConfig(data);
		} catch (err) {
			console.warn(`[pi-notification] Warning: Could not parse global config ${globalFile}:`, err);
		}
	}
	return {};
}

export function loadConfig(cwd?: string): NotificationConfig {
	let config: NotificationConfig = { ...DEFAULT_CONFIG };

	// 1. Merge global configuration
	const globalConfig = readRawGlobalConfig();
	config = { ...config, ...globalConfig };

	// 2. Merge project override if present
	const projectFile = getProjectConfigFile(cwd);
	if (projectFile) {
		try {
			const data = JSON.parse(fs.readFileSync(projectFile, "utf-8"));
			config = { ...config, ...sanitizeConfig(data) };
		} catch (err) {
			console.warn(`[pi-notification] Warning: Could not parse project config ${projectFile}:`, err);
		}
	}

	return config;
}

export function saveGlobalConfig(updates: Partial<NotificationConfig>): NotificationConfig {
	const existingRaw = readRawGlobalConfig();
	const sanitized = sanitizeConfig(updates);
	const nextRaw: Partial<NotificationConfig> = { ...existingRaw, ...sanitized };

	const globalDir = getGlobalConfigDir();
	if (!fs.existsSync(globalDir)) {
		fs.mkdirSync(globalDir, { recursive: true });
	}

	const globalFile = getGlobalConfigFile();
	const tempFile = `${globalFile}.${process.pid}.${Date.now()}.tmp`;
	fs.writeFileSync(tempFile, JSON.stringify(nextRaw, null, 2), "utf-8");
	fs.renameSync(tempFile, globalFile);

	return loadConfig();
}
