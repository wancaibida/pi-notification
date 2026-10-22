import path from "node:path";
import type { ExtensionAPI, ExtensionCommandContext, ExtensionContext } from "@earendil-works/pi-coding-agent";
import {
	getGlobalConfigFile,
	getProjectConfigFile,
	loadConfig,
	saveGlobalConfig,
} from "./config.ts";
import {
	buildNotificationContent,
	extractAssistantSummary,
} from "./formatter.ts";
import { notifyUser } from "./notifier.ts";
import type { NotificationConfig, RunMetrics } from "./types.ts";

export default function (pi: ExtensionAPI) {
	// Register CLI flags so users can customize notifications per run:
	// e.g. pi --no-notify, pi --no-notify-sound, pi --notify-threshold 10
	try {
		pi.registerFlag("notify", {
			description: "Enable desktop notification when job is finished",
			type: "boolean",
		});
		pi.registerFlag("notify-sound", {
			description: "Play sound with job completion notification",
			type: "boolean",
		});
		pi.registerFlag("notify-threshold", {
			description: "Minimum job duration in seconds to trigger notification",
			type: "string",
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

export function getEffectiveConfig(pi: ExtensionAPI, cwd?: string): NotificationConfig {
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
		if (typeof flagThreshold === "string" && flagThreshold.trim().length > 0) {
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

function showMessage(
	ctx: ExtensionCommandContext,
	msg: string,
	type: "info" | "warning" | "error" = "info",
): void {
	if (ctx.hasUI) {
		ctx.ui.notify(msg, type);
	} else {
		console.log(msg);
	}
}

export async function handleNotifyCommand(args: string, ctx: ExtensionCommandContext): Promise<void> {
	const parts = args.split(/\s+/).filter(Boolean);
	const sub = parts[0]?.toLowerCase();

	if (sub === "test") {
		const config = loadConfig(ctx.cwd);
		notifyUser(
			{
				title: "Pi Agent • Test Notification",
				body: '✓ Notifications are working!\n\n"Wayland desktop notification & audio chime test."',
				urgency: "normal",
				soundEvent: config.soundEvent,
			},
			{ ...config, enabled: true },
		);

		showMessage(ctx, "Test notification sent! Check your desktop notifications.", "info");
		return;
	}

	if (sub === "on" || sub === "enable") {
		saveGlobalConfig({ enabled: true });
		showMessage(ctx, "Notifications enabled.", "info");
		return;
	}

	if (sub === "off" || sub === "disable") {
		saveGlobalConfig({ enabled: false });
		showMessage(ctx, "Notifications disabled.", "info");
		return;
	}

	if (sub === "toggle") {
		const current = loadConfig(ctx.cwd);
		const updated = saveGlobalConfig({ enabled: !current.enabled });
		showMessage(ctx, `Notifications ${updated.enabled ? "enabled" : "disabled"}.`, "info");
		return;
	}

	if (sub === "sound") {
		const val = parts[1]?.toLowerCase();
		if (val === "on") {
			saveGlobalConfig({ sound: true });
			showMessage(ctx, "Notification sound enabled.", "info");
			return;
		}
		if (val === "off") {
			saveGlobalConfig({ sound: false });
			showMessage(ctx, "Notification sound disabled.", "info");
			return;
		}
		const current = loadConfig(ctx.cwd);
		const updated = saveGlobalConfig({ sound: !current.sound });
		showMessage(ctx, `Notification sound ${updated.sound ? "enabled" : "disabled"}.`, "info");
		return;
	}

	if (sub === "threshold" || sub === "min") {
		const sec = Number.parseFloat(parts[1] || "");
		if (Number.isNaN(sec) || sec < 0) {
			showMessage(ctx, "Usage: /notify threshold <seconds> (e.g. /notify threshold 5)", "warning");
			return;
		}
		saveGlobalConfig({ minDurationSeconds: sec });
		showMessage(
			ctx,
			`Notification threshold set to ${sec}s (${sec === 0 ? "notify on every run" : `notify if run >= ${sec}s`}).`,
			"info",
		);
		return;
	}

	if (sub === "summary") {
		const val = parts[1]?.toLowerCase();
		if (val === "on") {
			saveGlobalConfig({ includeSummary: true });
			showMessage(ctx, "Assistant summary excerpt enabled.", "info");
			return;
		}
		if (val === "off") {
			saveGlobalConfig({ includeSummary: false });
			showMessage(ctx, "Assistant summary excerpt disabled.", "info");
			return;
		}
		const current = loadConfig(ctx.cwd);
		const updated = saveGlobalConfig({ includeSummary: !current.includeSummary });
		showMessage(ctx, `Assistant summary ${updated.includeSummary ? "enabled" : "disabled"}.`, "info");
		return;
	}

	if (sub === "help") {
		const helpText = [
			"Available /notify commands:",
			"  /notify                Show current notification status",
			"  /notify test           Send an immediate test notification & chime",
			"  /notify toggle         Toggle notifications on/off",
			"  /notify on|off         Enable or disable notifications",
			"  /notify sound on|off   Enable or disable sound chime",
			"  /notify threshold <sec> Set minimum task duration to trigger notification (e.g. 5)",
			"  /notify summary on|off Include assistant response excerpt in notification",
		].join("\n");
		showMessage(ctx, helpText, "info");
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
	];

	const projectConfig = getProjectConfigFile(ctx.cwd);
	if (projectConfig) {
		statusLines.push(`• Project Override: ${projectConfig}`);
	}

	statusLines.push("Type '/notify help' or '/notify test' for more.");

	showMessage(ctx, statusLines.join("\n"), "info");
}
