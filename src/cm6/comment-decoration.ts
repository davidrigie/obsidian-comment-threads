import { RangeSetBuilder } from "@codemirror/state";
import {
  Decoration,
  DecorationSet,
  EditorView,
  PluginSpec,
  PluginValue,
  ViewPlugin,
  ViewUpdate,
  WidgetType,
} from "@codemirror/view";

const COMMENT_RE =
  /<mark>([\s\S]*?)<\/mark><sup>\[c(\d+)\]<\/sup>/g;

/**
 * Small widget that renders a clickable comment badge like [c1]
 * after the highlighted text.
 */
class CommentBadgeWidget extends WidgetType {
  constructor(readonly commentId: string) {
    super();
  }

  toDOM(): HTMLElement {
    const badge = document.createElement("span");
    badge.className = "ct-comment-badge";
    badge.textContent = `[${this.commentId}]`;
    badge.dataset.commentId = this.commentId;
    return badge;
  }

  eq(other: CommentBadgeWidget): boolean {
    return this.commentId === other.commentId;
  }
}

export interface CommentRange {
  fullFrom: number;
  fullTo: number;
  textFrom: number;
  textTo: number;
  commentId: string;
}

/**
 * Scans the full document for comment markers and returns their positions.
 */
function findCommentRanges(docText: string): CommentRange[] {
  const ranges: CommentRange[] = [];
  const re = new RegExp(COMMENT_RE.source, "g");
  let match;
  while ((match = re.exec(docText)) !== null) {
    const fullFrom = match.index;
    const fullTo = match.index + match[0].length;
    // <mark> is 6 chars, </mark><sup>[cN]</sup> is the rest
    const textFrom = fullFrom + 6; // after <mark>
    const textTo = textFrom + match[1]!.length; // before </mark>
    const commentId = `c${match[2]}`;
    ranges.push({ fullFrom, fullTo, textFrom, textTo, commentId });
  }
  return ranges;
}

// Decoration that hides the raw HTML tags
const hiddenDeco = Decoration.replace({});

class CommentDecorationPlugin implements PluginValue {
  decorations: DecorationSet;
  ranges: CommentRange[] = [];

  constructor(view: EditorView) {
    const result = this.buildDecorations(view);
    this.decorations = result.decorations;
    this.ranges = result.ranges;
  }

  update(update: ViewUpdate): void {
    if (update.docChanged || update.viewportChanged) {
      const result = this.buildDecorations(update.view);
      this.decorations = result.decorations;
      this.ranges = result.ranges;
    }
  }

  destroy(): void {}

  private buildDecorations(
    view: EditorView
  ): { decorations: DecorationSet; ranges: CommentRange[] } {
    const builder = new RangeSetBuilder<Decoration>();
    const docText = view.state.doc.toString();
    const ranges = findCommentRanges(docText);

    for (const r of ranges) {
      // Hide <mark> opening tag
      builder.add(r.fullFrom, r.textFrom, hiddenDeco);
      // Highlight the actual text
      builder.add(
        r.textFrom,
        r.textTo,
        Decoration.mark({
          class: "ct-comment-highlight",
          attributes: { "data-comment-id": r.commentId },
        })
      );
      // Hide </mark><sup>[cN]</sup> and replace with badge widget
      builder.add(
        r.textTo,
        r.fullTo,
        Decoration.replace({
          widget: new CommentBadgeWidget(r.commentId),
        })
      );
    }

    return { decorations: builder.finish(), ranges };
  }
}

const pluginSpec: PluginSpec<CommentDecorationPlugin> = {
  decorations: (v) => v.decorations,
};

export const commentDecorationPlugin = ViewPlugin.fromClass(
  CommentDecorationPlugin,
  pluginSpec
);

export { findCommentRanges as findCommentRangesInText };
