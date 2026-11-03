import {clueText} from './puzzle-rules.mjs';

export const icon = name => `<svg aria-hidden="true"><use href="#i-${name}"/></svg>`;

// Each board mark is decorative ink inside the button that owns its
// interaction and accessible label. CSS rotates the ink around its center.
export function surfaceMark(content) {
  return `<span class="surface-mark" aria-hidden="true">${content}</span>`;
}

export function tileMark(cell, {showMine, incorrect, special, showZero}) {
  if (incorrect) return surfaceMark(icon('close'));
  if (cell.flagged) return surfaceMark(icon('flag'));
  if (showMine) return surfaceMark(icon('mine'));
  if (cell.revealed && (cell.count || showZero)) {
    return surfaceMark(clueText(cell.count, special));
  }
  return '';
}
