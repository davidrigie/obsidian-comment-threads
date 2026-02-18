import { Notice, TFile, Vault } from "obsidian";
import type { CommentsFile } from "./types";
import { CommentStore } from "./comment-store";
import { buildCompanionMarkdown } from "./companion-builder";

function commentsJsonPath(mdPath: string): string {
  return mdPath.replace(/\.md$/, ".comments.json");
}

function companionMdPath(mdPath: string): string {
  return mdPath.replace(/\.md$/, ".comments.md");
}

export class CommentFileIO {
  constructor(
    private vault: Vault,
    private store: CommentStore
  ) {}

  async loadComments(mdPath: string): Promise<void> {
    const jsonPath = commentsJsonPath(mdPath);
    try {
      const file = this.vault.getFileByPath(jsonPath);
      if (file) {
        const content = await this.vault.read(file);
        const data: CommentsFile = JSON.parse(content);
        this.store.loadComments(data);
      } else {
        this.store.loadComments({ version: 1, comments: {} });
      }
    } catch {
      this.store.loadComments({ version: 1, comments: {} });
    }
  }

  async saveComments(mdPath: string): Promise<void> {
    const jsonPath = commentsJsonPath(mdPath);
    const data = this.store.getCommentsFile();
    const hasComments = Object.keys(data.comments).length > 0;

    if (hasComments) {
      const json = JSON.stringify(data, null, 2);
      try {
        const existing = this.vault.getFileByPath(jsonPath);
        if (existing) {
          await this.vault.modify(existing, json);
        } else {
          await this.vault.create(jsonPath, json);
        }
      } catch (e) {
        console.error("Comment Threads: failed to save comments JSON", e);
        new Notice("Comment Threads: failed to save comments file.");
      }
    } else {
      // No comments left — delete sidecar files
      await this.deleteFile(jsonPath);
      await this.deleteFile(companionMdPath(mdPath));
    }
  }

  async saveCompanion(mdPath: string): Promise<void> {
    const companionPath = companionMdPath(mdPath);
    const data = this.store.getCommentsFile();
    const hasComments = Object.keys(data.comments).length > 0;

    if (!hasComments) {
      await this.deleteFile(companionPath);
      return;
    }

    const fileName = mdPath.split("/").pop() || "document.md";
    const companion = buildCompanionMarkdown(fileName, data, mdPath);

    try {
      const existing = this.vault.getFileByPath(companionPath);
      if (existing) {
        await this.vault.modify(existing, companion);
      } else {
        await this.vault.create(companionPath, companion);
      }
    } catch (e) {
      console.error("Comment Threads: failed to save companion file", e);
      new Notice("Comment Threads: failed to save companion file.");
    }
  }

  private async deleteFile(path: string): Promise<void> {
    const file = this.vault.getFileByPath(path);
    if (file) {
      await this.vault.delete(file);
    }
  }

  isCommentsSidecar(path: string): boolean {
    return path.endsWith(".comments.json") || path.endsWith(".comments.md");
  }
}
