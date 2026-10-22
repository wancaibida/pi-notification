import { spawn } from "node:child_process";
import fs from "node:fs";

export const COMMON_SOUND_PATHS: Record<string, string[]> = {
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

export function attemptCommand(cmd: string, args: string[], timeoutMs = 3000): Promise<boolean> {
	return new Promise((resolve) => {
		let settled = false;
		let timer: NodeJS.Timeout | undefined;

		const finish = (result: boolean) => {
			if (!settled) {
				settled = true;
				if (timer) clearTimeout(timer);
				resolve(result);
			}
		};

		timer = setTimeout(() => {
			try {
				child?.kill("SIGKILL");
			} catch {
				// Ignore
			}
			finish(false);
		}, timeoutMs);

		let child;
		try {
			child = spawn(cmd, args, {
				stdio: "ignore",
			});
		} catch {
			finish(false);
			return;
		}

		child.on("error", () => finish(false));
		child.on("close", (code) => finish(code === 0));
	});
}

export function ringTerminalBell(): boolean {
	try {
		process.stdout.write("\x07");
		return true;
	} catch {
		return false;
	}
}

export async function playSound(soundEventOrPath = "complete"): Promise<boolean> {
	// 1. If explicit file path exists, play it
	if (fs.existsSync(soundEventOrPath)) {
		if (await attemptCommand("canberra-gtk-play", ["-f", soundEventOrPath])) return true;
		if (await attemptCommand("pw-play", [soundEventOrPath])) return true;
		if (await attemptCommand("paplay", [soundEventOrPath])) return true;
		if (await attemptCommand("aplay", ["-q", soundEventOrPath])) return true;
		return ringTerminalBell();
	}

	// 2. Try canberra-gtk-play with event name (freedesktop sound theme)
	const eventName = soundEventOrPath || "complete";
	if (await attemptCommand("canberra-gtk-play", ["-i", eventName])) {
		return true;
	}

	// 3. Fallback to common sound file paths
	const candidates = COMMON_SOUND_PATHS[eventName] || COMMON_SOUND_PATHS.complete;
	for (const soundPath of candidates) {
		if (fs.existsSync(soundPath)) {
			if (await attemptCommand("pw-play", [soundPath])) return true;
			if (await attemptCommand("paplay", [soundPath])) return true;
			if (await attemptCommand("canberra-gtk-play", ["-f", soundPath])) return true;
			if (await attemptCommand("aplay", ["-q", soundPath])) return true;
		}
	}

	// 4. Final fallback: terminal audio bell
	return ringTerminalBell();
}
