export interface NotificationConfig {
	/** Master switch to enable or disable notifications */
	enabled: boolean;

	/**
	 * Minimum elapsed duration (in seconds) of an agent run to trigger notification.
	 * If a task finishes faster than this threshold, no notification is sent.
	 * Set to 0 to notify on every finished run.
	 * Default: 5
	 */
	minDurationSeconds: number;

	/**
	 * Whether to play an audio notification chime on completion.
	 * Default: true
	 */
	sound: boolean;

	/**
	 * System sound event name (e.g. 'complete', 'dialog-information') or audio file path.
	 * Default: 'complete'
	 */
	soundEvent: string;

	/**
	 * Whether to trigger native desktop notifications via notify-send or D-Bus.
	 * Default: true
	 */
	desktopNotification: boolean;

	/**
	 * Whether to send terminal notifications (OSC 777 / OSC 99 / BEL)
	 * for Wayland terminal emulators (Ghostty, Foot, WezTerm, Kitty, etc.).
	 * Default: true
	 */
	terminalNotification: boolean;

	/**
	 * Whether to send a notification when the agent task was aborted / cancelled.
	 * Default: true
	 */
	notifyOnAbort: boolean;

	/**
	 * Whether to include a clean excerpt of the assistant's final response in the notification.
	 * Default: true
	 */
	includeSummary: boolean;

	/**
	 * Maximum character length of the assistant response snippet.
	 * Default: 140
	 */
	maxSummaryLength: number;

	/**
	 * Notification urgency level for successful completion ("low" | "normal" | "critical").
	 * Default: "normal"
	 */
	urgency: "low" | "normal" | "critical";

	/**
	 * Milliseconds after which the notification expires and dismisses (0 for default).
	 * Default: 6000
	 */
	expireTimeoutMs: number;

	/**
	 * Custom icon name or absolute path to an image/SVG.
	 * Leave empty to use the bundled Pi logo.
	 */
	icon?: string;
}

export interface RunMetrics {
	startTime: number;
	turns: number;
	toolCalls: number;
}

export interface NotificationPayload {
	title: string;
	body: string;
	urgency?: "low" | "normal" | "critical";
	expireTimeoutMs?: number;
	iconPath?: string;
	category?: string;
	sound?: boolean;
	soundEvent?: string;
}
