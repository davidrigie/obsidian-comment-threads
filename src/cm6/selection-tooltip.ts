import {
  EditorView,
  PluginValue,
  ViewPlugin,
  ViewUpdate,
} from "@codemirror/view";

class SelectionTooltipPlugin implements PluginValue {
  private tooltip: HTMLElement | null = null;
  private view: EditorView;

  constructor(view: EditorView) {
    this.view = view;
  }

  update(update: ViewUpdate): void {
    if (update.selectionSet || update.docChanged || update.geometryChanged) {
      // Defer layout read — coordsAtPos is not allowed during an update cycle
      requestAnimationFrame(() => this.updateTooltip());
    }
  }

  destroy(): void {
    this.removeTooltip();
  }

  private updateTooltip(): void {
    const sel = this.view.state.selection.main;

    if (sel.empty) {
      this.removeTooltip();
      return;
    }

    const fromCoords = this.view.coordsAtPos(sel.from);
    if (!fromCoords) {
      this.removeTooltip();
      return;
    }

    if (!this.tooltip) {
      this.tooltip = document.createElement("div");
      this.tooltip.className = "ct-selection-tooltip";
      this.tooltip.innerHTML = `<button class="ct-selection-tooltip-btn">Comment</button>`;
      this.tooltip.querySelector("button")!.addEventListener("mousedown", (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.view.dom.dispatchEvent(
          new CustomEvent("ct-create-comment", { bubbles: true })
        );
        this.removeTooltip();
      });
      this.view.dom.appendChild(this.tooltip);
    }

    // Position relative to the editor dom
    const editorRect = this.view.dom.getBoundingClientRect();
    const top = fromCoords.top - editorRect.top - 34;
    const left = fromCoords.left - editorRect.left;

    this.tooltip.style.top = `${top}px`;
    this.tooltip.style.left = `${left}px`;
  }

  private removeTooltip(): void {
    if (this.tooltip) {
      this.tooltip.remove();
      this.tooltip = null;
    }
  }
}

export const selectionTooltipPlugin = ViewPlugin.fromClass(
  SelectionTooltipPlugin
);
