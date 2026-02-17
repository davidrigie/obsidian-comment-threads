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
        mount(view: EditorView) {
          const wrapper = dom.parentElement;
          if (wrapper) {
            wrapper.style.setProperty("background", "none", "important");
            wrapper.style.setProperty("border", "none", "important");
            wrapper.style.setProperty("box-shadow", "none", "important");
            wrapper.style.setProperty("padding", "0", "important");
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
