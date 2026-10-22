import { spawn } from "node:child_process";
import fs from "node:fs";

const COMMON_SOUND_PATHS: Record<string, string[]> = {
	complete: [
		"/usr/share/sounds/freedesktop/stereo/complete.oga",
		"/usr/share/sounds/Oxygen-Sys-App-Positive.ogg",
		"/usr/share/sounds/freedesktop/stereo/message.oga",
		"/usr/share/sounds/Oxygen-Im-Message-In.ogg",
	],
	bell: [
		"/usr/share/sounds/freedesktop/stereo/bell.oga",
		"/usr/share/sounds/Oxygen-Sys-App-Message.ogg",
	],
	warning: [
		"/usr/share/sounds/freedesktop/stereo/dialog-warning.oga",
		"/usr/share/sounds/Oxygen-Sys-App-Warning.ogg",
	],
};

function trySpawn(cmd: string, args: string[]): boolean {
	try {
		const child = spawn(cmd, args, {
			stdio: "ignore",
			detached: true,
		});
		child.on("error", () => {
			// Ignore command not found or spawn errors
		});
		child.unref();
		return true;
	} catch {
		return false;
	}
}

export function playSound(soundEventOrPath = "complete"): void {
	// 1. If it is an explicit file path that exists, play it
	if (fs.existsSync(soundEventOrPath)) {
		if (trySpawn("canberra-gtk-play", ["-f", soundEventOrPath])) return;
		if (trySpawn("paplay", [soundEventOrPath])) return;
		if (trySpawn("pw-play", [soundEventOrPath])) return;
	}

	// 2. Try canberra-gtk-play with event name (standard freedesktop theme sound)
	const eventName = soundEventOrPath || "complete";
	try {
		const child = spawn("canberra-gtk-play", ["-i", eventName], {
			stdio: "ignore",
			detached: true,
		});
		let hasError = false;
		child.on("error", () => {
			hasError = true;
			// Canberra failed, fallback to file players below
			fallbackToFilePlayers(eventName);
		});
		child.unref();
		return;
	} catch {
		fallbackToFilePlayers(eventName);
	}
}

function fallbackToFilePlayers(eventName: string): void {
	const candidates = COMMON_SOUND_PATHS[eventName] || COMMON_SOUND_PATHS.complete;
	for (const soundPath of candidates) {
		if (fs.existsSync(soundPath)) {
			if (trySpawn("paplay", [soundPath])) return;
			if (trySpawn("pw-play", [soundPath])) return;
		}
	}

	// Final fallback: terminal audio bell
	try {
		process.stdout.write("\x07");
	} catch {
		// Ignore
	}
}
