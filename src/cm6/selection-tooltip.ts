import { EditorState, StateField } from "@codemirror/state";
import { showTooltip, Tooltip, EditorView } from "@codemirror/view";

function getSelectionTooltip(state: EditorState): Tooltip | null {
  const sel = state.selection.main;
  if (sel.empty) return null;

  return {
    pos: sel.from,
    above: true,
    strictSide: true,
    create() {
      const dom = document.createElement("div");
      dom.className = "ct-selection-tooltip";

      const btn = document.createElement("button");
      btn.className = "ct-selection-tooltip-btn";
      btn.textContent = "💬 Comment";
      btn.addEventListener("mousedown", (e) => {
        e.preventDefault();
        e.stopPropagation();
        dom.dispatchEvent(
          new CustomEvent("ct-create-comment", { bubbles: true })
        );
      });

      dom.appendChild(btn);
      return {
        dom,
        mount() {
          // Walk up and strip border from all tooltip wrappers
          let el: HTMLElement | null = dom.parentElement;
          while (el && !el.classList.contains("cm-editor")) {
            el.style.border = "none";
            el.style.outline = "none";
            el = el.parentElement;
          }
        },
      };
    },
  };
}

export const selectionTooltipField = StateField.define<Tooltip | null>({
  create(state) {
    return getSelectionTooltip(state);
  },

  update(value, tr) {
    if (tr.selection || tr.docChanged) {
      return getSelectionTooltip(tr.state);
    }
    return value;
  },

  provide(f) {
    return showTooltip.from(f);
  },
});
