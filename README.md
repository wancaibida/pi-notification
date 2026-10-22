# pi-notification

> Native **Linux & Wayland** desktop notification extension for the [Pi Coding Agent](https://github.com/earendil-works/pi).

Reminds you with a desktop popup and audio chime when a background task or agent run has finished, so you can switch windows, work in your IDE, or step away without worrying about missing when Pi needs your input.

---

## ✨ Features

- **🐧 Designed for Linux & Wayland**: Uses FreeDesktop standard desktop notifications (`notify-send` / D-Bus `org.freedesktop.Notifications`), seamlessly integrating with KDE Plasma, GNOME, Sway, Hyprland, etc.
- **🔊 Subtle Audio Chimes**: Plays desktop completion audio chimes (`canberra-gtk-play`, `paplay`, or `pw-play`) upon job settlement.
- **💻 Wayland Terminal Support**: Emits terminal escape sequences (OSC 777, OSC 99, OSC 9) for Wayland terminals like Ghostty, Kitty, Foot, WezTerm, and Alacritty.
- **⏱ Smart Duration Threshold**: Ignores rapid, sub-second interactive prompts (default threshold: 5s) so you aren't spammed while actively chatting.
- **📊 Rich Task Information**: Displays project name, elapsed time, turns and tool-call count, plus an excerpt of the assistant's final response.
- **🛑 Cancellation Aware**: Notifies with distinct low-urgency styling if a run is cancelled or aborted.
- **⚡ Non-blocking & Lightweight**: Zero external npm runtime dependencies. All notifications and audio processes are spawned asynchronously and detached.

---

## 🚀 Installation

Install directly into Pi via the CLI:

```bash
pi install /path/to/pi-notification
```

Or if you cloned it to `~/project/personal/pi-notification`:

```bash
pi install ~/project/personal/pi-notification
```

Verify the installation:

```bash
pi list
```

---

## 🎮 Interactive Commands

While inside Pi interactive session, use the `/notify` slash command:

| Command | Description |
|---|---|
| `/notify` | Display current notification settings and configuration path |
| `/notify test` | Fire an immediate test desktop notification and audio chime |
| `/notify toggle` | Toggle notifications on/off |
| `/notify sound on\|off` | Enable or disable the audio completion chime |
| `/notify threshold <sec>` | Set the minimum run duration before notifying (e.g. `0` for always) |
| `/notify summary on\|off` | Toggle including an excerpt of the agent's answer |
| `/notify help` | Show available `/notify` subcommands |

---

## ⚙️ CLI Flags

You can customize notifications on a per-run basis:

```bash
# Disable notifications for this run
pi --no-notify

# Disable sound only
pi --no-notify-sound

# Change duration threshold (e.g., notify on any run >= 10s, or 0 for all)
pi --notify-threshold 10
```

---

## 🛠 Configuration File

Settings are automatically saved and loaded from `~/.pi/agent/notification.json`:

```json
{
  "enabled": true,
  "minDurationSeconds": 5,
  "sound": true,
  "soundEvent": "complete",
  "desktopNotification": true,
  "terminalNotification": true,
  "notifyOnAbort": true,
  "includeSummary": true,
  "maxSummaryLength": 140,
  "urgency": "normal",
  "expireTimeoutMs": 6000,
  "icon": ""
}
```

You can also place a `.pi/notification.json` inside any project folder to override settings for that specific workspace.

### Options Reference

- `enabled` *(boolean, default: `true`)*: Master switch for notifications.
- `minDurationSeconds` *(number, default: `5`)*: Minimum elapsed time in seconds to trigger a notification. Set to `0` to notify on every settled run.
- `sound` *(boolean, default: `true`)*: Whether to play an audio chime on completion.
- `soundEvent` *(string, default: `"complete"`)*: System sound event name or path to a sound file (`.oga`, `.ogg`, `.wav`).
- `desktopNotification` *(boolean, default: `true`)*: Trigger native Linux desktop popups via `notify-send`.
- `terminalNotification` *(boolean, default: `true`)*: Emit terminal notification sequences (OSC 777 / OSC 99).
- `notifyOnAbort` *(boolean, default: `true`)*: Send a notification when the job was aborted or cancelled.
- `includeSummary` *(boolean, default: `true`)*: Include a sanitized snippet of the assistant's final message.
- `maxSummaryLength` *(number, default: `140`)*: Maximum characters for the response excerpt.
- `urgency` *(`"low"` \| `"normal"` \| `"critical"`, default: `"normal"`)*: FreeDesktop notification urgency.
- `expireTimeoutMs` *(number, default: `6000`)*: Time in milliseconds before the desktop toast expires.
- `icon` *(string, default: `""`)*: Stock icon name or custom file path. Defaults to bundled Pi icon.

---

## 🧪 Testing

Run the automated test suite:

```bash
npm test
```

---

## 📄 License

[MIT](LICENSE)
