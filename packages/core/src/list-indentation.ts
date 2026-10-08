/**
 * CommonMark nests a list inside an ordered item only when the nested list is
 * indented to the item's content column (3 spaces for "1. ", 4 for "10. ").
 * Editors and coding agents often indent such lists by just 2 spaces, which
 * CommonMark parses as a separate top-level list. This pre-parse pass re-indents
 * a list line that sits at least 2 spaces deeper than an ordered item's marker
 * but short of its content column, together with the rest of that nested
 * block, so it parses as nested in the ordered item. Bullet items are left
 * alone: their content column is already 2 spaces deep.
 */

// A list item marker followed by 1-4 spaces before content, or an empty item.
const LIST_ITEM = /^([-*+]|\d{1,9}[.)])( {1,4}(?=\S)| *$)/;
const THEMATIC_BREAK = /^([-*_])( *\1){2,} *$/;
const FENCE_OPEN = /^(`{3,}|~{3,})/;
const MIN_NESTING_INDENT = 2;

interface OpenItem {
  originalIndent: number;
  indent: number;
  contentColumn: number;
  ordered: boolean;
}

interface Shift {
  /** Original indentation of the ordered item whose nested block is shifted. */
  parentIndent: number;
  spaces: number;
}

function leadingSpaces(line: string): number {
  return /^ */.exec(line)![0].length;
}

function closesFence(body: string, fence: string): boolean {
  const match = /^(`{3,}|~{3,}) *$/.exec(body);
  return match !== null && match[1]![0] === fence[0] && match[1]!.length >= fence.length;
}

export function nestShallowListsUnderOrderedItems(markdown: string): string {
  // Even indices hold lines, odd indices hold their original line endings.
  const parts = markdown.split(/(\r\n?|\n)/);
  const items: OpenItem[] = [];
  const shifts: Shift[] = [];
  let fence: string | undefined;

  for (let i = 0; i < parts.length; i += 2) {
    const line = parts[i]!;
    if (line.trim().length === 0) continue;

    const originalIndent = leadingSpaces(line);
    while (shifts.length > 0 && originalIndent <= shifts[shifts.length - 1]!.parentIndent) {
      shifts.pop();
    }
    let indent = originalIndent + shifts.reduce((sum, shift) => sum + shift.spaces, 0);
    const body = line.slice(originalIndent);

    const marker = fence === undefined && !THEMATIC_BREAK.test(body) ? LIST_ITEM.exec(body) : null;
    if (fence !== undefined) {
      if (closesFence(body, fence)) fence = undefined;
    } else if (marker === null) {
      fence = FENCE_OPEN.exec(body)?.[1];
      while (items.length > 0 && indent < items[items.length - 1]!.contentColumn) items.pop();
    } else {
      while (items.length > 0 && items[items.length - 1]!.indent >= indent) items.pop();
      const parent = items[items.length - 1];
      if (
        parent?.ordered &&
        indent >= parent.indent + MIN_NESTING_INDENT &&
        indent < parent.contentColumn
      ) {
        const spaces = parent.contentColumn - indent;
        shifts.push({ parentIndent: parent.originalIndent, spaces });
        indent += spaces;
      }
      const [whole, symbol, gap] = marker;
      // An empty item's content column is one space past its marker.
      const gapWidth = whole.length === body.length ? 1 : gap!.length;
      items.push({
        originalIndent,
        indent,
        contentColumn: indent + symbol!.length + gapWidth,
        ordered: /\d/.test(symbol!)
      });
    }

    parts[i] = " ".repeat(indent) + body;
  }

  return parts.join("");
}
