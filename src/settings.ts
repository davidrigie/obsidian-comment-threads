import { App, PluginSettingTab, Setting } from "obsidian";
import type CommentThreadsPlugin from "./main";

export class CommentThreadsSettingTab extends PluginSettingTab {
  plugin: CommentThreadsPlugin;

  constructor(app: App, plugin: CommentThreadsPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    new Setting(containerEl)
      .setName("Author name")
      .setDesc("Your display name shown on comment threads.")
      .addText((text) =>
        text
          .setPlaceholder("Enter your name")
          .setValue(this.plugin.settings.authorName)
          .onChange(async (value) => {
            this.plugin.settings.authorName = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Auto-open panel")
      .setDesc(
        "Automatically show the comments panel when opening a file with comments."
      )
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.autoOpenPanel)
          .onChange(async (value) => {
            this.plugin.settings.autoOpenPanel = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Generate companion file")
      .setDesc(
        "Auto-generate a human-readable .comments.md file alongside .comments.json."
      )
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.generateCompanion)
          .onChange(async (value) => {
            this.plugin.settings.generateCompanion = value;
            await this.plugin.saveSettings();
          })
      );
  }
}
