import {
  Editor,
  MarkdownFileInfo,
  MarkdownView,
  Menu,
  Notice,
  Plugin,
  TFile,
  WorkspaceLeaf,
} from "obsidian";
import { CommentStore } from "./comment-store";
import { CommentFileIO } from "./comment-file-io";
import {
  CommentThreadsView,
  VIEW_TYPE_COMMENT_THREADS,
} from "./views/comments-panel";
import { CommentThreadsSettingTab } from "./settings";
import { EditorView } from "@codemirror/view";
import { commentDecorationPlugin } from "./cm6/comment-decoration";
import { commentPostProcessor } from "./post-processor";
import type { CommentThreadsSettings } from "./types";
import { DEFAULT_SETTINGS } from "./types";

const MARKER_RE = /<mark>([\s\S]*?)<\/mark><sup>\[c(\d+)\]<\/sup>/g;

export default class CommentThreadsPlugin extends Plugin {
  settings: CommentThreadsSettings = DEFAULT_SETTINGS;
  store: CommentStore = new CommentStore();
  fileIO!: CommentFileIO;
  private currentFilePath: string | null = null;
  private saving = false;

  async onload(): Promise<void> {
    await this.loadSettings();
    this.fileIO = new CommentFileIO(this.app.vault, this.store);

    // Register sidebar view
    this.registerView(VIEW_TYPE_COMMENT_THREADS, (leaf) => {
      const view = new CommentThreadsView(leaf, this.store);
      view.setGetAuthor(() => this.getAuthor());
      view.setOnNavigateToComment((id) => this.scrollToComment(id));
      view.setOnDeleteThread((id) => this.deleteComment(id));
      view.setOnResolveThread((id) => this.resolveComment(id));
      return view;
    });

    // Register CM6 extensions for live preview
    this.registerEditorExtension(commentDecorationPlugin);
    this.registerEditorExtension(
      EditorView.domEventHandlers({
        click: (event) => {
          const target = event.target as HTMLElement;
          const highlight =
            target.closest(".ct-comment-highlight") as HTMLElement | null;
          const badge =
            target.closest(".ct-comment-badge") as HTMLElement | null;
          const commentId =
            highlight?.dataset.commentId ?? badge?.dataset.commentId;
          if (commentId) {
            this.setActiveComment(commentId);
            this.activatePanel();
          }
        },
      })
    );

    // Register post-processor for reading view
    this.registerMarkdownPostProcessor((el, ctx) => {
      commentPostProcessor(el, ctx, (commentId) => {
        this.setActiveComment(commentId);
        this.activatePanel();
      });
    });

    // Commands
    this.addCommand({
      id: "create-comment",
      name: "Add comment to selection",
      editorCallback: (editor: Editor) => {
        this.createComment(editor);
      },
      hotkeys: [{ modifiers: ["Mod", "Shift"], key: "m" }],
    });

    this.addCommand({
      id: "toggle-panel",
      name: "Toggle comments panel",
      callback: () => this.togglePanel(),
    });

    this.addCommand({
      id: "next-comment",
      name: "Go to next comment",
      editorCallback: (editor: Editor) => {
        this.navigateComment(editor, "next");
      },
    });

    this.addCommand({
      id: "prev-comment",
      name: "Go to previous comment",
      editorCallback: (editor: Editor) => {
        this.navigateComment(editor, "prev");
      },
    });

    this.addCommand({
      id: "strip-all-markers",
      name: "Strip all comment markers from current file",
      callback: () => this.stripAllMarkers(),
    });

    // Ribbon icon
    this.addRibbonIcon("message-square", "Comment Threads", () => {
      const view = this.app.workspace.getActiveViewOfType(MarkdownView);
      if (view) {
        const selection = view.editor.getSelection();
        if (selection) {
          this.createComment(view.editor);
          return;
        }
      }
      this.togglePanel();
    });

    // Context menu
    this.registerEvent(
      this.app.workspace.on(
        "editor-menu",
        (menu: Menu, editor: Editor, info: MarkdownView | MarkdownFileInfo) => {
          const selection = editor.getSelection();
          if (selection) {
            menu.addItem((item) => {
              item
                .setTitle("Add comment")
                .setIcon("message-square")
                .onClick(() => this.createComment(editor));
            });
          }
        }
      )
    );

    // Load comments when a file opens
    this.registerEvent(
      this.app.workspace.on("file-open", (file: TFile | null) => {
        if (file && file.extension === "md" && !this.fileIO.isCommentsSidecar(file.path)) {
          this.onFileOpen(file);
        }
      })
    );

    // Save comments when file is modified (debounced via the vault modify event)
    this.registerEvent(
      this.app.vault.on("modify", (file) => {
        if (
          file instanceof TFile &&
          file.path === this.currentFilePath &&
          !this.saving
        ) {
          this.debouncedSave();
        }
      })
    );

    // Settings tab
    this.addSettingTab(new CommentThreadsSettingTab(this.app, this));

    // Subscribe to store changes to save comments
    this.store.subscribe(() => {
      if (this.currentFilePath) {
        this.debouncedSave();
      }
    });
  }

  async onunload(): Promise<void> {
    // Save any pending changes
    if (this.currentFilePath) {
      await this.saveCurrentComments();
    }
  }

  // --- Settings ---

  async loadSettings(): Promise<void> {
    this.settings = Object.assign(
      {},
      DEFAULT_SETTINGS,
      await this.loadData()
    );
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }

  getAuthor(): string {
    return this.settings.authorName || "Anonymous";
  }

  // --- File handling ---

  private async onFileOpen(file: TFile): Promise<void> {
    this.currentFilePath = file.path;
    await this.fileIO.loadComments(file.path);

    // Extract quoted texts from the file content
    const content = await this.app.vault.read(file);
    this.updateCommentTexts(content);

    // Update panel
    this.updatePanel();

    // Auto-open panel if enabled and there are comments
    if (this.settings.autoOpenPanel && this.store.hasComments()) {
      this.activatePanel();
    }
  }

  private saveTimeout: number | null = null;

  private debouncedSave(): void {
    if (this.saveTimeout !== null) {
      window.clearTimeout(this.saveTimeout);
    }
    this.saveTimeout = window.setTimeout(() => {
      this.saveCurrentComments();
    }, 1000);
  }

  private async saveCurrentComments(): Promise<void> {
    if (!this.currentFilePath || this.saving) return;
    this.saving = true;
    try {
      await this.fileIO.saveComments(this.currentFilePath);

      const file = this.app.vault.getFileByPath(this.currentFilePath);
      if (file) {
        const content = await this.app.vault.read(file);
        this.updateCommentTexts(content);
        if (this.settings.generateCompanion) {
          await this.fileIO.saveCompanion(this.currentFilePath, content);
        }
      }
    } finally {
      this.saving = false;
    }
  }

  // --- Comment creation ---

  private createComment(editor: Editor): void {
    const selection = editor.getSelection();
    if (!selection) {
      new Notice("Select text first to add a comment.");
      return;
    }

    if (!this.settings.authorName) {
      new Notice(
        "Please set your author name in Comment Threads settings first."
      );
      return;
    }

    const commentId = this.store.getNextCommentId();

    // Create empty thread in the store
    this.store.addThread(commentId);

    // Wrap selection with markers in the editor
    const wrapped = `<mark>${selection}</mark><sup>[${commentId}]</sup>`;
    editor.replaceSelection(wrapped);

    // Open panel, set active, and focus the input
    this.setActiveComment(commentId);
    this.activatePanel().then(() => {
      this.focusPanelInput(commentId);
    });
  }

  // --- Marker stripping ---

  private async stripMarkers(commentId: string): Promise<void> {
    if (!this.currentFilePath) return;
    const file = this.app.vault.getFileByPath(this.currentFilePath);
    if (!file) return;

    const content = await this.app.vault.read(file);
    const re = new RegExp(MARKER_RE.source, "g");
    let newContent = content;
    let match;
    while ((match = re.exec(content)) !== null) {
      if (`c${match[2]}` === commentId) {
        newContent =
          content.slice(0, match.index) +
          match[1]! +
          content.slice(match.index + match[0].length);
        break;
      }
    }
    if (newContent !== content) {
      this.saving = true;
      await this.app.vault.modify(file, newContent);
      this.saving = false;
    }
  }

  private async stripAllMarkers(): Promise<void> {
    if (!this.currentFilePath) return;
    const file = this.app.vault.getFileByPath(this.currentFilePath);
    if (!file) return;

    const content = await this.app.vault.read(file);
    const newContent = content.replace(
      new RegExp(MARKER_RE.source, "g"),
      (_, text) => text as string
    );
    if (newContent !== content) {
      this.saving = true;
      await this.app.vault.modify(file, newContent);
      this.saving = false;
      new Notice("All comment markers stripped.");
    } else {
      new Notice("No comment markers found.");
    }
  }

  // --- Comment deletion ---

  private async deleteComment(commentId: string): Promise<void> {
    await this.stripMarkers(commentId);
    this.store.deleteThread(commentId);
  }

  // --- Comment resolution ---

  private async resolveComment(commentId: string): Promise<void> {
    await this.stripMarkers(commentId);
    this.store.resolveThread(commentId, this.getAuthor());
  }

  // --- Comment navigation ---

  private updateCommentTexts(content: string): void {
    const texts: Record<string, string> = {};
    const re = new RegExp(MARKER_RE.source, "g");
    let match;
    while ((match = re.exec(content)) !== null) {
      const commentId = `c${match[2]}`;
      texts[commentId] = match[1]!;
    }

    // Update the panel
    const leaves = this.app.workspace.getLeavesOfType(
      VIEW_TYPE_COMMENT_THREADS
    );
    for (const leaf of leaves) {
      if (leaf.view instanceof CommentThreadsView) {
        leaf.view.setCommentTexts(texts);
      }
    }
  }

  private scrollToComment(commentId: string): void {
    // Find the MarkdownView for the current file (can't use getActiveViewOfType
    // because the sidebar panel may be focused instead)
    let mdView: MarkdownView | null = null;
    this.app.workspace.iterateAllLeaves((leaf) => {
      if (
        leaf.view instanceof MarkdownView &&
        leaf.view.file?.path === this.currentFilePath
      ) {
        mdView = leaf.view;
      }
    });
    if (!mdView) return;

    const editor = (mdView as MarkdownView).editor;
    const content = editor.getValue();

    const re = new RegExp(MARKER_RE.source, "g");
    let match;
    while ((match = re.exec(content)) !== null) {
      if (`c${match[2]}` === commentId) {
        const pos = editor.offsetToPos(match.index);
        editor.setCursor(pos);
        editor.scrollIntoView(
          { from: pos, to: editor.offsetToPos(match.index + match[0].length) },
          true
        );
        break;
      }
    }
  }

  private navigateComment(editor: Editor, direction: "next" | "prev"): void {
    const content = editor.getValue();
    const cursor = editor.posToOffset(editor.getCursor());

    const re = new RegExp(MARKER_RE.source, "g");
    const positions: number[] = [];
    let match;
    while ((match = re.exec(content)) !== null) {
      positions.push(match.index);
    }

    if (positions.length === 0) return;

    let target: number;
    if (direction === "next") {
      target = positions.find((p) => p > cursor) ?? positions[0]!;
    } else {
      target =
        [...positions].reverse().find((p) => p < cursor) ??
        positions[positions.length - 1]!;
    }

    const pos = editor.offsetToPos(target);
    editor.setCursor(pos);
    editor.scrollIntoView({ from: pos, to: pos }, true);
  }

  // --- Panel management ---

  private focusPanelInput(commentId: string): void {
    const leaves = this.app.workspace.getLeavesOfType(
      VIEW_TYPE_COMMENT_THREADS
    );
    for (const leaf of leaves) {
      if (leaf.view instanceof CommentThreadsView) {
        leaf.view.focusCommentInput(commentId);
      }
    }
  }

  private setActiveComment(commentId: string): void {
    const leaves = this.app.workspace.getLeavesOfType(
      VIEW_TYPE_COMMENT_THREADS
    );
    for (const leaf of leaves) {
      if (leaf.view instanceof CommentThreadsView) {
        leaf.view.setActiveComment(commentId);
      }
    }
  }

  private updatePanel(): void {
    const leaves = this.app.workspace.getLeavesOfType(
      VIEW_TYPE_COMMENT_THREADS
    );
    for (const leaf of leaves) {
      if (leaf.view instanceof CommentThreadsView) {
        // Re-render triggers from store subscription
        leaf.view.setActiveComment(null);
      }
    }
  }

  async activatePanel(): Promise<void> {
    const { workspace } = this.app;
    const leaves = workspace.getLeavesOfType(VIEW_TYPE_COMMENT_THREADS);

    if (leaves.length > 0) {
      workspace.revealLeaf(leaves[0]!);
      return;
    }

    const leaf = workspace.getRightLeaf(false);
    if (leaf) {
      await leaf.setViewState({
        type: VIEW_TYPE_COMMENT_THREADS,
        active: true,
      });
      workspace.revealLeaf(leaf);
    }
  }

  private async togglePanel(): Promise<void> {
    const leaves = this.app.workspace.getLeavesOfType(
      VIEW_TYPE_COMMENT_THREADS
    );
    if (leaves.length > 0) {
      leaves[0]!.detach();
    } else {
      await this.activatePanel();
    }
  }
}
