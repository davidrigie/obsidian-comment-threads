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
    this.updateTooltip();
  }

  update(update: ViewUpdate): void {
    if (
      update.selectionSet ||
      update.docChanged ||
      update.geometryChanged
    ) {
      this.updateTooltip();
    }
  }

  destroy(): void {
    this.removeTooltip();
  }

  private updateTooltip(): void {
    const { state } = this.view;
    const sel = state.selection.main;

    // Only show when there's a non-empty selection
    if (sel.empty) {
      this.removeTooltip();
      return;
    }

    // Get the coordinates of the selection head
    const coords = this.view.coordsAtPos(sel.head);
    if (!coords) {
      this.removeTooltip();
      return;
    }

    if (!this.tooltip) {
      this.tooltip = document.createElement("div");
      this.tooltip.className = "ct-selection-tooltip";

      const btn = document.createElement("button");
      btn.className = "ct-selection-tooltip-btn";
      btn.textContent = "Comment";
      btn.addEventListener("mousedown", (e) => {
        e.preventDefault();
        e.stopPropagation();
        // Dispatch a custom event that main.ts can listen for
        this.view.dom.dispatchEvent(
          new CustomEvent("ct-create-comment", { bubbles: true })
        );
        this.removeTooltip();
      });

      this.tooltip.appendChild(btn);
      document.body.appendChild(this.tooltip);
    }

    // Position above the selection
    const editorRect = this.view.dom.getBoundingClientRect();
    const tooltipHeight = 32;
    const gap = 6;

    // Use the top of the selection for positioning
    const fromCoords = this.view.coordsAtPos(sel.from);
    const top = (fromCoords?.top ?? coords.top) - tooltipHeight - gap;
    const left = coords.left;

    this.tooltip.style.top = `${top}px`;
    this.tooltip.style.left = `${left}px`;

    // Keep within viewport
    const rect = this.tooltip.getBoundingClientRect();
    if (rect.right > window.innerWidth) {
      this.tooltip.style.left = `${window.innerWidth - rect.width - 8}px`;
    }
    if (rect.top < 0) {
      // Show below instead
      const bottom = (fromCoords?.bottom ?? coords.bottom) + gap;
      this.tooltip.style.top = `${bottom}px`;
    }
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
