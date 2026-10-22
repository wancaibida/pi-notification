import assert from "node:assert/strict";
import test from "node:test";
import {
	buildNotificationContent,
	cleanMarkdownText,
	extractAssistantSummary,
	formatDuration,
	truncateText,
} from "../src/formatter.ts";

test("formatDuration formats various times accurately", () => {
	assert.equal(formatDuration(400), "< 1s");
	assert.equal(formatDuration(1000), "1s");
	assert.equal(formatDuration(5400), "5s");
	assert.equal(formatDuration(59200), "59s");
	assert.equal(formatDuration(60000), "1m");
	assert.equal(formatDuration(75000), "1m 15s");
	assert.equal(formatDuration(3600000), "1h");
	assert.equal(formatDuration(3720000), "1h 2m");
});

test("cleanMarkdownText strips markdown syntax correctly", () => {
	const raw = `
### Task Summary
Here is what was done:
- Fixed \`src/notifier.ts\` and **improved** error handling.
- See [documentation](https://example.com) for details.
> Note: Check tests!

\`\`\`typescript
const x = 10;
\`\`\`
	`;

	const cleaned = cleanMarkdownText(raw);
	assert.ok(!cleaned.includes("###"));
	assert.ok(!cleaned.includes("`"));
	assert.ok(!cleaned.includes("**"));
	assert.ok(!cleaned.includes("[documentation]"));
	assert.ok(cleaned.includes("Fixed src/notifier.ts and improved error handling."));
	assert.ok(cleaned.includes("See documentation for details."));
});

test("truncateText truncates cleanly with ellipsis", () => {
	assert.equal(truncateText("Hello world", 20), "Hello world");
	assert.equal(truncateText("Hello world, this is a very long text", 15), "Hello world,...");
});

test("extractAssistantSummary extracts and trims assistant text", () => {
	const branch = [
		{
			type: "message",
			message: {
				role: "user",
				content: "Please fix the notification bug",
			},
		},
		{
			type: "message",
			message: {
				role: "assistant",
				content: [
					{
						type: "text",
						text: "I have fixed the issue in **src/index.ts** and all unit tests pass now.",
					},
				],
			},
		},
	];

	const summary = extractAssistantSummary(branch, 60);
	assert.ok(summary);
	assert.ok(summary.includes("I have fixed the issue in src/index.ts"));
});

test("buildNotificationContent builds regular and aborted messages", () => {
	const normal = buildNotificationContent({
		projectName: "my-project",
		durationMs: 14000,
		turns: 2,
		toolCalls: 3,
		aborted: false,
		summary: "All tests completed.",
	});

	assert.equal(normal.title, "Pi • my-project");
	assert.ok(normal.body.includes("Job finished in 14s (2 turns, 3 tool calls)"));
	assert.ok(normal.body.includes('"All tests completed."'));

	const aborted = buildNotificationContent({
		projectName: "my-project",
		durationMs: 5000,
		turns: 1,
		toolCalls: 0,
		aborted: true,
	});

	assert.equal(aborted.title, "Pi • my-project (Cancelled)");
	assert.ok(aborted.body.includes("Job was cancelled after 5s."));
});
