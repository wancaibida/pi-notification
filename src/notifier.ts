import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { playSound } from "./sound.ts";
import type { NotificationConfig, NotificationPayload } from "./types.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DEFAULT_ICON_PATH = path.resolve(__dirname, "..", "assets", "pi-logo.svg");

export function resolveIcon(customIcon?: string): string {
	if (customIcon && customIcon.trim().length > 0) {
		const trimmed = customIcon.trim();
		// If it's a file path that exists, use it
		if (fs.existsSync(trimmed)) {
			return trimmed;
		}
		// Otherwise it might be a stock icon name like "dialog-information"
		return trimmed;
	}

	if (fs.existsSync(DEFAULT_ICON_PATH)) {
		return DEFAULT_ICON_PATH;
	}

	return "dialog-information";
}

/**
 * Send terminal notification escape sequences for Wayland-compatible terminals
 * (Ghostty, WezTerm, Kitty, Foot, Alacritty, rxvt).
 */
export function sendTerminalNotification(title: string, body: string): void {
	try {
		const cleanTitle = title.replace(/[\r\n\x00-\x1f]/g, " ");
		const cleanBody = body.replace(/[\r\n\x00-\x1f]/g, " ");

		if (process.env.KITTY_WINDOW_ID) {
			// Kitty OSC 99
			process.stdout.write(`\x1b]99;i=1:d=0;${cleanTitle}\x1b\\`);
			process.stdout.write(`\x1b]99;i=1:p=body;${cleanBody}\x1b\\`);
		} else {
			// OSC 777 (Ghostty, WezTerm, rxvt, foot)
			process.stdout.write(`\x1b]777;notify;${cleanTitle};${cleanBody}\x07`);
			// OSC 9 (fallback for other modern terminals)
			process.stdout.write(`\x1b]9;${cleanTitle}: ${cleanBody}\x07`);
		}
	} catch {
		// Ignore any stream writing errors
	}
}

/**
 * Send native desktop notification via notify-send or D-Bus under Linux/Wayland.
 */
export function sendDesktopNotification(payload: NotificationPayload): void {
	const icon = resolveIcon(payload.iconPath);
	const urgency = payload.urgency || "normal";
	const timeout = payload.expireTimeoutMs ?? 6000;
	const category = payload.category || "job.complete";
	const appName = "Pi Coding Agent";

	const args = [
		"-a",
		appName,
		"-i",
		icon,
		"-u",
		urgency,
		"-t",
		String(timeout),
		"-c",
		category,
		"--",
		payload.title,
		payload.body,
	];

	try {
		const child = spawn("notify-send", args, {
			stdio: "ignore",
			detached: true,
		});

		child.on("error", () => {
			// If notify-send failed, fallback to gdbus freedesktop notification call
			sendGdbusNotification(appName, icon, payload.title, payload.body, timeout);
		});

		child.unref();
	} catch {
		sendGdbusNotification(appName, icon, payload.title, payload.body, timeout);
	}
}

function sendGdbusNotification(
	appName: string,
	icon: string,
	title: string,
	body: string,
	timeoutMs: number,
): void {
	try {
		const gdbusArgs = [
			"call",
			"--session",
			"--dest",
			"org.freedesktop.Notifications",
			"--object-path",
			"/org/freedesktop/Notifications",
			"--method",
			"org.freedesktop.Notifications.Notify",
			appName,
			"0",
			icon,
			title,
			body,
			"[]",
			"{}",
			String(timeoutMs),
		];

		const child = spawn("gdbus", gdbusArgs, {
			stdio: "ignore",
			detached: true,
		});
		child.on("error", () => {});
		child.unref();
	} catch {
		// Ignore
	}
}

/**
 * Main dispatcher to send all requested notifications based on config.
 */
export function notifyUser(payload: NotificationPayload, config: NotificationConfig): void {
	if (!config.enabled) return;

	// 1. Desktop notification (Wayland notification server)
	if (config.desktopNotification) {
		sendDesktopNotification({
			...payload,
			iconPath: config.icon || payload.iconPath,
			urgency: payload.urgency || config.urgency,
			expireTimeoutMs: payload.expireTimeoutMs ?? config.expireTimeoutMs,
		});
	}

	// 2. Terminal notification (Wayland terminal escape sequences)
	if (config.terminalNotification) {
		sendTerminalNotification(payload.title, payload.body);
	}

	// 3. Audio notification chime
	if (config.sound && (payload.sound !== false)) {
		playSound(payload.soundEvent || config.soundEvent);
	}
}
