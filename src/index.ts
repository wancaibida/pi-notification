import path from "node:path";
import type { ExtensionAPI, ExtensionCommandContext, ExtensionContext } from "@earendil-works/pi-coding-agent";
import {
	getGlobalConfigFile,
	loadConfig,
	saveGlobalConfig,
} from "./config.ts";
import {
	buildNotificationContent,
	extractAssistantSummary,
	formatDuration,
} from "./formatter.ts";
import { notifyUser, sendDesktopNotification } from "./notifier.ts";
import type { NotificationConfig, RunMetrics } from "./types.ts";

export default function (pi: ExtensionAPI) {
	// Register CLI flags so users can customize notifications per run:
	// e.g. pi --no-notify, pi --no-notify-sound, pi --notify-threshold 10
	try {
		pi.registerFlag("notify", {
			description: "Enable desktop notification when job is finished",
			type: "boolean",
			default: true,
		});
		pi.registerFlag("notify-sound", {
			description: "Play sound with job completion notification",
			type: "boolean",
			default: true,
		});
		pi.registerFlag("notify-threshold", {
			description: "Minimum job duration in seconds to trigger notification (default: 5)",
			type: "string",
			default: "5",
		});
	} catch {
		// Ignore if flags are already registered or not supported
	}

	// Track run metrics
	let metrics: RunMetrics = {
		startTime: 0,
		turns: 0,
		toolCalls: 0,
	};
	let isRunning = false;

	// Reset metrics when a new run begins
	pi.on("agent_start", () => {
		metrics = {
			startTime: Date.now(),
			turns: 0,
			toolCalls: 0,
		};
		isRunning = true;
	});

	// Track turns
	pi.on("turn_start", () => {
		if (isRunning) {
			metrics.turns++;
		}
	});

	// Track tool calls
	pi.on("tool_execution_start", () => {
		if (isRunning) {
			metrics.toolCalls++;
		}
	});

	// Final settlement: Pi has finished all automatic continuations and is waiting for user input
	pi.on("agent_settled", async (event, ctx: ExtensionContext) => {
		if (!isRunning) {
			return;
		}
		isRunning = false;

		const durationMs = Date.now() - (metrics.startTime || Date.now());

		// Load config and apply any CLI flag overrides
		const config = getEffectiveConfig(pi, ctx.cwd);
		if (!config.enabled) {
			return;
		}

		// Handle cancelled/aborted runs
		if (event.aborted) {
			if (!config.notifyOnAbort) {
				return;
			}
			const projectName = path.basename(ctx.cwd) || "project";
			const sessionName = ctx.sessionManager.getSessionName();
			const content = buildNotificationContent({
				projectName,
				sessionName,
				durationMs,
				turns: metrics.turns,
				toolCalls: metrics.toolCalls,
				aborted: true,
			});

			notifyUser(
				{
					title: content.title,
					body: content.body,
					urgency: "low",
					sound: config.sound,
					soundEvent: "warning",
				},
				config,
			);
			return;
		}

		// Check minimum duration threshold (skip notifications for quick back-and-forth prompts)
		if (durationMs < config.minDurationSeconds * 1000) {
			return;
		}

		// Extract session information
		const projectName = path.basename(ctx.cwd) || "project";
		const sessionName = ctx.sessionManager.getSessionName();

		// Extract short summary from the assistant's final response if enabled
		let summary: string | null = null;
		if (config.includeSummary) {
			try {
				const branch = ctx.sessionManager.getBranch();
				summary = extractAssistantSummary(branch, config.maxSummaryLength);
			} catch {
				summary = null;
			}
		}

		const content = buildNotificationContent({
			projectName,
			sessionName,
			durationMs,
			turns: metrics.turns,
			toolCalls: metrics.toolCalls,
			aborted: false,
			summary,
		});

		notifyUser(
			{
				title: content.title,
				body: content.body,
				urgency: config.urgency,
				sound: config.sound,
				soundEvent: config.soundEvent,
			},
			config,
		);
	});

	// Register /notify command in Pi interactive mode
	pi.registerCommand("notify", {
		description: "Configure or test desktop completion notifications (Linux/Wayland)",
		handler: async (args: string, ctx: ExtensionCommandContext) => {
			await handleNotifyCommand(args.trim(), ctx);
		},
	});
}

function getEffectiveConfig(pi: ExtensionAPI, cwd?: string): NotificationConfig {
	const config = loadConfig(cwd);

	try {
		const flagNotify = pi.getFlag("notify");
		if (typeof flagNotify === "boolean") {
			config.enabled = flagNotify;
		}

		const flagSound = pi.getFlag("notify-sound");
		if (typeof flagSound === "boolean") {
			config.sound = flagSound;
		}

		const flagThreshold = pi.getFlag("notify-threshold");
		if (typeof flagThreshold === "string") {
			const parsed = Number.parseFloat(flagThreshold);
			if (!Number.isNaN(parsed) && parsed >= 0) {
				config.minDurationSeconds = parsed;
			}
		}
	} catch {
		// Ignore flag lookup issues
	}

	return config;
}

async function handleNotifyCommand(args: string, ctx: ExtensionCommandContext): Promise<void> {
	const parts = args.split(/\s+/).filter(Boolean);
	const sub = parts[0]?.toLowerCase();

	if (sub === "test") {
		const config = loadConfig(ctx.cwd);
		notifyUser(
			{
				title: "Pi Agent • Test Notification",
				body: '✓ Notifications are working!\n\n"Wayland desktop notification & audio chime test."',
				urgency: "normal",
				sound: config.sound,
				soundEvent: config.soundEvent,
			},
			{ ...config, enabled: true },
		);

		if (ctx.hasUI) {
			ctx.ui.notify("Test notification sent! Check your desktop notifications.", "info");
		}
		return;
	}

	if (sub === "on" || sub === "enable") {
		saveGlobalConfig({ enabled: true });
		if (ctx.hasUI) ctx.ui.notify("Notifications enabled.", "info");
		return;
	}

	if (sub === "off" || sub === "disable") {
		saveGlobalConfig({ enabled: false });
		if (ctx.hasUI) ctx.ui.notify("Notifications disabled.", "info");
		return;
	}

	if (sub === "toggle") {
		const current = loadConfig(ctx.cwd);
		const updated = saveGlobalConfig({ enabled: !current.enabled });
		if (ctx.hasUI) {
			ctx.ui.notify(`Notifications ${updated.enabled ? "enabled" : "disabled"}.`, "info");
		}
		return;
	}

	if (sub === "sound") {
		const val = parts[1]?.toLowerCase();
		if (val === "on") {
			saveGlobalConfig({ sound: true });
			if (ctx.hasUI) ctx.ui.notify("Notification sound enabled.", "info");
			return;
		}
		if (val === "off") {
			saveGlobalConfig({ sound: false });
			if (ctx.hasUI) ctx.ui.notify("Notification sound disabled.", "info");
			return;
		}
		const current = loadConfig(ctx.cwd);
		const updated = saveGlobalConfig({ sound: !current.sound });
		if (ctx.hasUI) {
			ctx.ui.notify(`Notification sound ${updated.sound ? "enabled" : "disabled"}.`, "info");
		}
		return;
	}

	if (sub === "threshold" || sub === "min") {
		const sec = Number.parseFloat(parts[1] || "");
		if (Number.isNaN(sec) || sec < 0) {
			if (ctx.hasUI) ctx.ui.notify("Usage: /notify threshold <seconds> (e.g. /notify threshold 5)", "warning");
			return;
		}
		saveGlobalConfig({ minDurationSeconds: sec });
		if (ctx.hasUI) {
			ctx.ui.notify(
				`Notification threshold set to ${sec}s (${sec === 0 ? "notify on every run" : `notify if run >= ${sec}s`}).`,
				"info",
			);
		}
		return;
	}

	if (sub === "summary") {
		const val = parts[1]?.toLowerCase();
		if (val === "on") {
			saveGlobalConfig({ includeSummary: true });
			if (ctx.hasUI) ctx.ui.notify("Assistant summary excerpt enabled.", "info");
			return;
		}
		if (val === "off") {
			saveGlobalConfig({ includeSummary: false });
			if (ctx.hasUI) ctx.ui.notify("Assistant summary excerpt disabled.", "info");
			return;
		}
		const current = loadConfig(ctx.cwd);
		const updated = saveGlobalConfig({ includeSummary: !current.includeSummary });
		if (ctx.hasUI) {
			ctx.ui.notify(`Assistant summary ${updated.includeSummary ? "enabled" : "disabled"}.`, "info");
		}
		return;
	}

	if (sub === "help") {
		const helpText = [
			"Available /notify commands:",
			"  /notify            Show current notification status",
			"  /notify test       Send an immediate test notification & chime",
			"  /notify toggle     Toggle notifications on/off",
			"  /notify sound on|off  Enable or disable sound chime",
			"  /notify threshold <sec> Set minimum task duration to trigger notification (e.g. 5)",
			"  /notify summary on|off  Include assistant response excerpt in notification",
		].join("\n");
		if (ctx.hasUI) {
			ctx.ui.notify(helpText, "info");
		}
		return;
	}

	// Default: show current configuration status
	const config = loadConfig(ctx.cwd);
	const statusLines = [
		`🔔 Pi Notification (${config.enabled ? "Enabled" : "Disabled"})`,
		`• Min Duration:    ${config.minDurationSeconds}s ${config.minDurationSeconds === 0 ? "(always notify)" : ""}`,
		`• Sound Chime:     ${config.sound ? `Enabled (${config.soundEvent})` : "Disabled"}`,
		`• Desktop Popup:   ${config.desktopNotification ? "Enabled (Wayland/notify-send)" : "Disabled"}`,
		`• Terminal OSC:    ${config.terminalNotification ? "Enabled" : "Disabled"}`,
		`• Response Snippet: ${config.includeSummary ? "Enabled" : "Disabled"}`,
		`• Config Path:     ${getGlobalConfigFile()}`,
		`Type '/notify help' or '/notify test' for more.`,
	].join("\n");

	if (ctx.hasUI) {
		ctx.ui.notify(statusLines, "info");
	}
}
