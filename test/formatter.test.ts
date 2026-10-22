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
console.log(x);
\`\`\`
	`;

	const cleaned = cleanMarkdownText(raw);
	assert.ok(!cleaned.includes("###"));
	assert.ok(!cleaned.includes("`"));
	assert.ok(!cleaned.includes("**"));
	assert.ok(!cleaned.includes("[documentation]"));
	assert.ok(!cleaned.includes("const x = 10;"));
	assert.ok(cleaned.includes("Fixed src/notifier.ts and improved error handling."));
	assert.ok(cleaned.includes("See documentation for details."));
});

test("cleanMarkdownText handles edge cases: snake_case, multiplication, images, HTML", () => {
	// Images should be removed without leaving '!alt'
	const withImage = "Here is the icon: ![Pi Logo](assets/pi.svg) and [Docs](https://example.com).";
	assert.equal(cleanMarkdownText(withImage), "Here is the icon: and Docs.");

	// Underscores in identifiers must not be removed
	const snakeCase = "Modified my_variable_name and config_dir in source.";
	assert.equal(cleanMarkdownText(snakeCase), "Modified my_variable_name and config_dir in source.");

	// Multiplication asterisks must not be stripped
	const math = "Result is 2 * 3 * 4 = 24 items.";
	assert.equal(cleanMarkdownText(math), "Result is 2 * 3 * 4 = 24 items.");

	// Inequalities must not be stripped as HTML tags
	const inequalities = "Check if count < 10 and max > 5 is true. <span>Keep clean</span>";
	assert.equal(cleanMarkdownText(inequalities), "Check if count < 10 and max > 5 is true. Keep clean");
});

test("truncateText truncates cleanly with ellipsis and handles short limits", () => {
	assert.equal(truncateText("Hello world", 20), "Hello world");
	assert.equal(truncateText("Hello world, this is a very long text", 15), "Hello world,...");
	assert.equal(truncateText("Hello", 0), "");
	assert.equal(truncateText("Hello", 2), "He");
	assert.equal(truncateText("Hello", 3), "Hel");
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
			type: "custom",
			customType: "something_else",
			data: {},
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
