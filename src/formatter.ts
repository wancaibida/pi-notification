export function formatDuration(ms: number): string {
	if (ms < 1000) {
		return "< 1s";
	}
	const totalSeconds = Math.round(ms / 1000);
	if (totalSeconds < 60) {
		return `${totalSeconds}s`;
	}
	const minutes = Math.floor(totalSeconds / 60);
	const seconds = totalSeconds % 60;
	if (minutes < 60) {
		return seconds > 0 ? `${minutes}m ${seconds}s` : `${minutes}m`;
	}
	const hours = Math.floor(minutes / 60);
	const remainingMinutes = minutes % 60;
	return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
}

export function cleanMarkdownText(text: string): string {
	if (!text) return "";

	return text
		// Remove code blocks
		.replace(/```[\s\S]*?```/g, (match) => {
			const lines = match.split("\n").slice(1, -1);
			return lines.length > 0 ? lines[0] : "";
		})
		// Remove inline code
		.replace(/`([^`]+)`/g, "$1")
		// Remove markdown links [text](url) -> text
		.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
		// Remove markdown images
		.replace(/!\[([^\]]*)\]\([^)]+\)/g, "")
		// Remove bold and italics
		.replace(/(\*\*|__)(.*?)\1/g, "$2")
		.replace(/(\*|_)(.*?)\1/g, "$2")
		// Remove headers # Title
		.replace(/^#{1,6}\s+/gm, "")
		// Remove blockquotes
		.replace(/^>\s+/gm, "")
		// Remove HTML tags
		.replace(/<[^>]*>/g, "")
		// Collapse multiple whitespaces/newlines
		.replace(/\s+/g, " ")
		.trim();
}

export function truncateText(text: string, maxLength: number): string {
	if (text.length <= maxLength) return text;
	return text.slice(0, maxLength - 3).trimEnd() + "...";
}

export function extractAssistantSummary(
	branchEntries: readonly any[],
	maxLength = 140,
): string | null {
	if (!branchEntries || branchEntries.length === 0) return null;

	// Traverse backwards to find the last assistant message
	for (let i = branchEntries.length - 1; i >= 0; i--) {
		const entry = branchEntries[i];
		if (!entry) continue;

		// SessionMessageEntry
		const msg = entry.message || (entry.type === "message" ? entry.message : null);
		if (msg && msg.role === "assistant" && msg.content) {
			let rawText = "";

			if (typeof msg.content === "string") {
				rawText = msg.content;
			} else if (Array.isArray(msg.content)) {
				const parts: string[] = [];
				for (const part of msg.content) {
					if (part && typeof part === "object") {
						if (part.type === "text" && typeof part.text === "string") {
							parts.push(part.text);
						}
					}
				}
				rawText = parts.join(" ");
			}

			const cleaned = cleanMarkdownText(rawText);
			if (cleaned.length > 0) {
				return truncateText(cleaned, maxLength);
			}
		}
	}

	return null;
}

export interface FormatNotificationParams {
	projectName: string;
	sessionName?: string;
	durationMs: number;
	turns: number;
	toolCalls: number;
	aborted: boolean;
	summary?: string | null;
}

export function buildNotificationContent(params: FormatNotificationParams): {
	title: string;
	body: string;
} {
	const displayName = params.sessionName || params.projectName || "Pi";
	const durationStr = formatDuration(params.durationMs);

	if (params.aborted) {
		const title = `Pi • ${displayName} (Cancelled)`;
		const body = `Job was cancelled after ${durationStr}.`;
		return { title, body };
	}

	const title = `Pi • ${displayName}`;
	const statsList: string[] = [];
	if (params.turns > 1) {
		statsList.push(`${params.turns} turns`);
	}
	if (params.toolCalls > 0) {
		statsList.push(`${params.toolCalls} tool ${params.toolCalls === 1 ? "call" : "calls"}`);
	}

	const statsSuffix = statsList.length > 0 ? ` (${statsList.join(", ")})` : "";
	const header = `✓ Job finished in ${durationStr}${statsSuffix}`;

	if (params.summary) {
		return {
			title,
			body: `${header}\n\n"${params.summary}"`,
		};
	}

	return {
		title,
		body: header,
	};
}
