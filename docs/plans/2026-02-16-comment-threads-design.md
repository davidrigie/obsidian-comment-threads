# Comment Threads — Obsidian Plugin Design

## Overview

An Obsidian plugin that brings Gutter's inline commenting system to Obsidian. Fully compatible with Gutter's three-file comment format, enabling collaboration on shared vaults.

## Data Model & File Format

100% compatible with Gutter's three-file model:

### Inline markers in `.md` files
```markdown
This is <mark>highlighted text</mark><sup>[c1]</sup> with a comment.
```

### `.comments.json` sidecar (source of truth)
```json
{
  "version": 1,
  "comments": {
    "c1": {
      "thread": [
        { "id": "m_abc123", "author": "Dave", "timestamp": "2026-02-16T...", "body": "Thoughts on this?" }
      ],
      "resolved": false,
      "createdAt": "2026-02-16T..."
    }
  }
}
```

### `.comments.md` companion
Auto-generated on save. Human-readable summary with thread contents, resolution status, and footer stats. Same format as Gutter.

### File naming
`document.md` -> `document.comments.json` + `document.comments.md`

## Plugin Architecture

```
obsidian-comment-threads/
├── src/
│   ├── main.ts                    # Plugin entry point (onload/onunload)
│   ├── settings.ts                # Settings tab (author name config)
│   ├── types.ts                   # CommentMessage, CommentThread, CommentsFile
│   ├── comment-store.ts           # In-memory state management for threads
│   ├── comment-file-io.ts         # Read/write .comments.json and .comments.md
│   ├── companion-builder.ts       # Builds .comments.md content string
│   ├── cm6/
│   │   ├── comment-decoration.ts  # ViewPlugin — finds markers, applies highlights
│   │   └── comment-widget.ts      # Optional: inline widgets (e.g., comment count badge)
│   ├── post-processor.ts          # MarkdownPostProcessor for reading view
│   └── views/
│       └── comments-panel.ts      # ItemView — sidebar panel with thread list
├── styles.css                     # Comment highlight + panel styling
├── manifest.json                  # Obsidian plugin manifest
├── package.json
├── tsconfig.json
└── esbuild.config.mjs             # Build config
```

### Key design choices
- **No React** — plain DOM manipulation keeps bundle small and avoids framework mismatch with Obsidian internals.
- **comment-store.ts** mirrors Gutter's Zustand store logic (addThread, addReply, resolveThread, deleteThread, getNextCommentId) as a plain class.
- **companion-builder.ts** is a direct port of Gutter's `buildCompanionMarkdown()`.
- **comment-file-io.ts** uses Obsidian's Vault API (`vault.read`, `vault.modify`, `vault.create`) instead of Tauri IPC.

## User Interactions & Workflow

### Creating a comment
1. User selects text in the editor
2. Triggers via: `Cmd+Shift+M` / `Ctrl+Shift+M`, right-click context menu, ribbon icon, or command palette
3. A small modal/popup appears for entering the comment body
4. On submit: inline markers inserted around selection, thread created, sidebar updates

### Viewing & navigating
- Sidebar panel (right leaf) shows all threads, filterable by Open/Resolved/All
- Clicking a thread in panel scrolls editor to highlighted text
- Clicking highlighted text in editor activates that thread in panel

### Replying
- Reply input at bottom of each thread in the panel
- Enter to submit

### Resolving/Unresolving
- Resolve button on each thread header
- Resolved threads dimmed with checkmark badge
- Can unresolve

### Deleting
- Delete button with confirmation
- Removes thread and strips markers from document

### Saving
- Comments save when document saves
- `.comments.json` written via Vault API
- `.comments.md` regenerated on every save
- Both sidecar files removed if all comments deleted

### Commands
- `comment-threads:create-comment` — Create comment on selection
- `comment-threads:toggle-panel` — Show/hide comments panel
- `comment-threads:next-comment` / `comment-threads:prev-comment` — Navigate between comments

## Rendering

### CM6 ViewPlugin (source/live-preview mode)
- Scans document text for `<mark>([\s\S]*?)<\/mark><sup>\[c(\d+)\]<\/sup>`
- Creates `Decoration.mark()` ranges with CSS class for highlighted text
- Hides raw HTML tags, shows just highlighted text (like Obsidian hides markdown syntax in live preview)
- Click on decorated range sets active comment and scrolls panel
- Rebuilds decorations on document changes

### MarkdownPostProcessor (reading view)
- Obsidian already renders `<mark>` as highlighted text
- Post-processor finds `<mark>` + `<sup>[cN]</sup>` elements
- Adds click handlers and interactive highlighting CSS class
- Hides `<sup>[cN]</sup>` visually

### Active comment highlighting
- Selected thread gets `.active` class with stronger highlight
- Works in both modes

## Settings

- **Author name** (required) — display name for comment threads. Prompted on first use.
- **Auto-open panel** — show comments panel when opening a file with comments. Default: true.
- **Companion file** — toggle `.comments.md` generation. Default: on.
