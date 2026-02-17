import { MarkdownPostProcessorContext } from "obsidian";

/**
 * Post-processor for reading view. Obsidian natively renders <mark> as
 * highlighted text. This processor finds <mark> elements followed by
 * <sup>[cN]</sup> elements, adds interactive styling, and hides the
 * superscript reference.
 */
export function commentPostProcessor(
  el: HTMLElement,
  ctx: MarkdownPostProcessorContext,
  onClickComment: (commentId: string) => void
): void {
  // Find all <sup> elements that contain comment references like [c1]
  const sups = el.querySelectorAll("sup");
  for (const sup of Array.from(sups)) {
    const text = sup.textContent || "";
    const match = text.match(/^\[c(\d+)\]$/);
    if (!match) continue;

    const commentId = `c${match[1]}`;
    const mark = sup.previousElementSibling;

    // The <mark> should be the previous sibling
    if (mark && mark.tagName === "MARK") {
      mark.classList.add("ct-comment-highlight");
      mark.setAttribute("data-comment-id", commentId);
      mark.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        onClickComment(commentId);
      });
    }

    // Replace <sup>[c1]</sup> with a small badge
    const badge = document.createElement("span");
    badge.className = "ct-comment-badge";
    badge.textContent = `[${commentId}]`;
    badge.dataset.commentId = commentId;
    badge.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      onClickComment(commentId);
    });
    sup.replaceWith(badge);
  }
}
