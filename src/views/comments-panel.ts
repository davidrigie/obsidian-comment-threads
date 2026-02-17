import { ItemView, WorkspaceLeaf } from "obsidian";
import type { CommentStore } from "../comment-store";
import type { CommentThread } from "../types";

export const VIEW_TYPE_COMMENT_THREADS = "comment-threads-view";

type FilterMode = "all" | "open" | "resolved";

export class CommentThreadsView extends ItemView {
  store: CommentStore;
  activeCommentId: string | null = null;
  commentTexts: Record<string, string> = {};
  private filter: FilterMode = "open";
  private unsubscribe: (() => void) | null = null;
  private getAuthor: () => string = () => "Anonymous";
  private onNavigateToComment: (commentId: string) => void = () => {};

  constructor(leaf: WorkspaceLeaf, store: CommentStore) {
    super(leaf);
    this.store = store;
  }

  getViewType(): string {
    return VIEW_TYPE_COMMENT_THREADS;
  }

  getDisplayText(): string {
    return "Comment Threads";
  }

  getIcon(): string {
    return "message-square";
  }

  setGetAuthor(fn: () => string): void {
    this.getAuthor = fn;
  }

  setOnNavigateToComment(fn: (commentId: string) => void): void {
    this.onNavigateToComment = fn;
  }

  async onOpen(): Promise<void> {
    this.unsubscribe = this.store.subscribe(() => this.render());
    this.render();
  }

  async onClose(): Promise<void> {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
  }

  setActiveComment(commentId: string | null): void {
    this.activeCommentId = commentId;
    this.render();
  }

  setCommentTexts(texts: Record<string, string>): void {
    this.commentTexts = texts;
    this.render();
  }

  private render(): void {
    const container = this.contentEl;
    container.empty();
    container.addClass("ct-panel");

    const threadIds = this.store.getThreadIds();
    const threads = this.store.threads;
    const totalCount = threadIds.length;
    const resolvedCount = threadIds.filter(
      (id) => threads[id]?.resolved
    ).length;
    const openCount = totalCount - resolvedCount;

    // Header
    const header = container.createDiv({ cls: "ct-panel-header" });

    const titleRow = header.createDiv({ cls: "ct-panel-title-row" });
    titleRow.createSpan({ cls: "ct-panel-title", text: "Comments" });
    if (totalCount > 0) {
      titleRow.createSpan({
        cls: "ct-panel-badge",
        text: String(openCount),
      });
    }

    const controls = header.createDiv({ cls: "ct-panel-controls" });

    // Filter dropdown
    const select = controls.createEl("select", { cls: "ct-panel-filter" });
    const options: [FilterMode, string][] = [
      ["all", `All (${totalCount})`],
      ["open", `Open (${openCount})`],
      ["resolved", `Resolved (${resolvedCount})`],
    ];
    for (const [value, label] of options) {
      const opt = select.createEl("option", { text: label, value });
      if (value === this.filter) opt.selected = true;
    }
    select.addEventListener("change", () => {
      this.filter = select.value as FilterMode;
      this.render();
    });

    // Filter visible threads
    const visibleThreads = threadIds.filter((id) => {
      if (this.filter === "all") return true;
      if (this.filter === "open") return !threads[id]?.resolved;
      return threads[id]?.resolved;
    });

    // Thread list
    const list = container.createDiv({ cls: "ct-thread-list" });

    if (visibleThreads.length === 0) {
      const empty = list.createDiv({ cls: "ct-empty-state" });
      if (totalCount === 0) {
        empty.createEl("p", {
          cls: "ct-empty-title",
          text: "No comments yet",
        });
        empty.createEl("p", {
          cls: "ct-empty-hint",
          text: "Select text and press Cmd+Shift+M to add a comment.",
        });
      } else {
        empty.createEl("p", {
          cls: "ct-empty-title",
          text:
            this.filter === "open" ? "All resolved" : "No resolved comments",
        });
        empty.createEl("p", {
          cls: "ct-empty-hint",
          text: "Try changing the filter.",
        });
      }
      return;
    }

    for (const id of visibleThreads) {
      const thread = threads[id];
      if (!thread) continue;
      this.renderThread(list, id, thread);
    }
  }

  private renderThread(
    parent: HTMLElement,
    commentId: string,
    thread: CommentThread
  ): void {
    const isActive = this.activeCommentId === commentId;
    const el = parent.createDiv({
      cls: `ct-thread ${isActive ? "ct-thread-active" : ""} ${thread.resolved ? "ct-thread-resolved" : ""}`,
    });

    el.addEventListener("click", () => {
      this.activeCommentId = commentId;
      this.onNavigateToComment(commentId);
      this.render();
    });

    // Header row
    const headerRow = el.createDiv({ cls: "ct-thread-header" });
    headerRow.createSpan({
      cls: "ct-thread-id",
      text: `[${commentId}]`,
    });

    const actions = headerRow.createDiv({ cls: "ct-thread-actions" });

    // Resolve/unresolve button
    if (!thread.resolved) {
      const resolveBtn = actions.createEl("button", {
        cls: "ct-btn ct-btn-resolve",
        title: "Resolve",
        text: "✓",
      });
      resolveBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        this.store.resolveThread(commentId, this.getAuthor());
      });
    } else {
      const unresolveBtn = actions.createEl("button", {
        cls: "ct-btn ct-btn-unresolve",
        title: "Unresolve",
        text: "↩",
      });
      unresolveBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        this.store.unresolveThread(commentId);
      });
    }

    // Delete button
    const deleteBtn = actions.createEl("button", {
      cls: "ct-btn ct-btn-delete",
      title: "Delete",
      text: "✕",
    });
    let deleteConfirmTimeout: number | null = null;
    deleteBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      if (deleteBtn.hasClass("ct-btn-confirm")) {
        this.store.deleteThread(commentId);
        if (deleteConfirmTimeout !== null) {
          window.clearTimeout(deleteConfirmTimeout);
        }
      } else {
        deleteBtn.addClass("ct-btn-confirm");
        deleteBtn.textContent = "Confirm?";
        deleteConfirmTimeout = window.setTimeout(() => {
          deleteBtn.removeClass("ct-btn-confirm");
          deleteBtn.textContent = "✕";
        }, 3000);
      }
    });

    // Quoted text
    const quotedText = this.commentTexts[commentId];
    if (quotedText) {
      const quote = el.createDiv({ cls: "ct-thread-quote" });
      const displayText =
        quotedText.length > 80
          ? quotedText.slice(0, 80) + "..."
          : quotedText;
      quote.textContent = `"${displayText}"`;
    }

    // Resolution status
    if (thread.resolved) {
      const status = el.createDiv({ cls: "ct-thread-status-resolved" });
      status.textContent = `Resolved by ${thread.resolvedBy}`;
      if (thread.resolvedAt) {
        status.textContent += ` — ${this.formatDate(thread.resolvedAt)}`;
      }
    }

    // Messages
    const messages = el.createDiv({ cls: "ct-thread-messages" });
    for (const msg of thread.thread) {
      const msgEl = messages.createDiv({ cls: "ct-message" });
      const meta = msgEl.createDiv({ cls: "ct-message-meta" });
      meta.createSpan({ cls: "ct-message-author", text: msg.author });
      meta.createSpan({ cls: "ct-message-sep", text: " · " });
      meta.createSpan({
        cls: "ct-message-time",
        text: this.formatDate(msg.timestamp),
      });
      msgEl.createEl("p", { cls: "ct-message-body", text: msg.body });
    }

    // Reply input (only for open threads)
    if (!thread.resolved) {
      const replyContainer = el.createDiv({ cls: "ct-reply" });
      const replyInput = replyContainer.createEl("input", {
        cls: "ct-reply-input",
        type: "text",
        placeholder: "Reply...",
      });
      replyInput.addEventListener("click", (e) => e.stopPropagation());
      replyInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          const text = replyInput.value.trim();
          if (!text) return;
          this.store.addReply(commentId, this.getAuthor(), text);
          replyInput.value = "";
        }
      });
    }
  }

  private formatDate(iso: string): string {
    const d = new Date(iso);
    return (
      d.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      }) +
      " " +
      d.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
      })
    );
  }
}
