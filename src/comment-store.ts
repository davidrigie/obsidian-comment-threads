import type { CommentThread, CommentsFile } from "./types";

function generateId(): string {
  return "m_" + Math.random().toString(36).substring(2, 10);
}

type Listener = () => void;

export class CommentStore {
  threads: Record<string, CommentThread> = {};
  private listeners: Set<Listener> = new Set();

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    for (const listener of this.listeners) {
      listener();
    }
  }

  loadComments(data: CommentsFile): void {
    this.threads = data.comments || {};
    this.notify();
  }

  getCommentsFile(): CommentsFile {
    return { version: 1, comments: this.threads };
  }

  getThreadIds(): string[] {
    return Object.keys(this.threads).sort((a, b) => {
      const numA = parseInt(a.replace("c", ""), 10);
      const numB = parseInt(b.replace("c", ""), 10);
      return numA - numB;
    });
  }

  getNextCommentId(): string {
    const ids = Object.keys(this.threads);
    if (ids.length === 0) return "c1";
    const maxNum = Math.max(
      ...ids.map((id) => parseInt(id.replace("c", ""), 10))
    );
    return `c${maxNum + 1}`;
  }

  addThread(commentId: string, author: string, body: string): void {
    const now = new Date().toISOString();
    this.threads = {
      ...this.threads,
      [commentId]: {
        thread: [{ id: generateId(), author, timestamp: now, body }],
        resolved: false,
        createdAt: now,
      },
    };
    this.notify();
  }

  addReply(commentId: string, author: string, body: string): void {
    const thread = this.threads[commentId];
    if (!thread) return;
    const now = new Date().toISOString();
    this.threads = {
      ...this.threads,
      [commentId]: {
        ...thread,
        thread: [
          ...thread.thread,
          { id: generateId(), author, timestamp: now, body },
        ],
      },
    };
    this.notify();
  }

  resolveThread(commentId: string, author: string): void {
    const thread = this.threads[commentId];
    if (!thread) return;
    const now = new Date().toISOString();
    this.threads = {
      ...this.threads,
      [commentId]: {
        ...thread,
        resolved: true,
        resolvedBy: author,
        resolvedAt: now,
      },
    };
    this.notify();
  }

  unresolveThread(commentId: string): void {
    const thread = this.threads[commentId];
    if (!thread) return;
    this.threads = {
      ...this.threads,
      [commentId]: {
        ...thread,
        resolved: false,
        resolvedBy: undefined,
        resolvedAt: undefined,
      },
    };
    this.notify();
  }

  deleteThread(commentId: string): void {
    const { [commentId]: _, ...rest } = this.threads;
    this.threads = rest;
    this.notify();
  }

  clearAll(): void {
    this.threads = {};
    this.notify();
  }

  hasComments(): boolean {
    return Object.keys(this.threads).length > 0;
  }
}
