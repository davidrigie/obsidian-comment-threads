# Comment Threads for Obsidian

Add threaded comments to any text in your notes — like Google Docs, but for Obsidian.

Select text, leave a comment, and discuss in threads. Comments are stored in a separate sidecar file so your prose stays clean.

## Features

- **Threaded comments** — Start a thread on any selected text. Reply, resolve, or delete threads from the sidebar panel.
- **Multiple ways to comment** — Use the keyboard shortcut (`Cmd/Ctrl + Shift + M`), the right-click context menu, or the floating button that appears when you select text.
- **Sidebar panel** — View all comment threads for the current file. Filter by open or resolved. Click a thread to jump to its location in the editor.
- **In-editor highlighting** — Commented text is highlighted with a clickable badge (e.g. `[c1]`) in both Live Preview and Reading View.
- **Navigate between comments** — Jump to the next or previous comment in a file via commands.
- **Companion markdown file** — Optionally generates a human-readable `.comments.md` file alongside each note, useful for reviewing discussions outside Obsidian.
- **Non-destructive** — Resolving a thread strips the markers from your note but keeps the conversation history. Deleting removes everything.

## Installation

### With BRAT (recommended)

1. Install the [BRAT](https://github.com/TfTHacker/obsidian42-brat) plugin if you don't have it
2. Open **Settings → BRAT → Add Beta Plugin**
3. Enter `davidrigie/obsidian-comment-threads`
4. Enable the plugin in **Settings → Community Plugins**

BRAT will keep the plugin updated automatically.

### Manual installation

1. Go to the [latest release](https://github.com/davidrigie/obsidian-comment-threads/releases/latest)
2. Download `main.js`, `manifest.json`, and `styles.css`
3. Create a folder at `<your-vault>/.obsidian/plugins/comment-threads/`
4. Move the three downloaded files into that folder
5. Restart Obsidian and enable the plugin in **Settings → Community Plugins**

## Usage

1. **Set your author name** in **Settings → Comment Threads** (required before adding comments)
2. Select text in the editor
3. Press `Cmd/Ctrl + Shift + M` (or right-click → **Add comment**, or click the floating **Comment** button)
4. Type your comment in the sidebar panel and press **Enter**

### Commands

| Command | Description |
|---|---|
| **Add comment to selection** | Create a new comment thread on selected text |
| **Toggle comments panel** | Open or close the sidebar panel |
| **Go to next comment** | Jump to the next comment marker |
| **Go to previous comment** | Jump to the previous comment marker |
| **Strip all comment markers** | Remove all comment markers from the current file |

### Settings

| Setting | Default | Description |
|---|---|---|
| **Author name** | — | Your display name on comments |
| **Auto-open panel** | On | Automatically open the panel when a file has comments |
| **Generate companion file** | On | Create a readable `.comments.md` alongside the JSON data |

## How it works

When you add a comment, the selected text gets wrapped in a `<mark>` tag with a `<sup>` badge in your markdown file. All comment data (messages, timestamps, authors) is stored in a `<notename>.comments.json` sidecar file — not in your note content.

When the last thread is deleted, the sidecar files are cleaned up automatically.

## License

MIT
