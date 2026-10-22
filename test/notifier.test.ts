import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { resolveIcon } from "../src/notifier.ts";

test("resolveIcon returns custom path if it exists", () => {
	const icon = resolveIcon("/usr/share/sounds/freedesktop/stereo/complete.oga");
	assert.equal(icon, "/usr/share/sounds/freedesktop/stereo/complete.oga");
});

test("resolveIcon returns stock icon name if provided", () => {
	const icon = resolveIcon("dialog-information");
	assert.equal(icon, "dialog-information");
});

test("resolveIcon returns default pi-logo.svg when no custom icon is specified", () => {
	const icon = resolveIcon();
	assert.ok(icon.endsWith("pi-logo.svg") || icon === "dialog-information");
	if (icon.endsWith("pi-logo.svg")) {
		assert.ok(fs.existsSync(icon));
	}
});
