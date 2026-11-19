const BLOCKED_CLIPBOARD_EVENTS = ['copy', 'cut', 'paste'];
const BLOCKED_CONTEXT_EVENTS = ['contextmenu', 'selectstart', 'dragstart'];

function preventDefault(event) {
  event.preventDefault();
}

function blockClipboardShortcuts(event) {
  const isInsertPaste = event.shiftKey && String(event.key || '').toLowerCase() === 'insert';
  if (!(event.ctrlKey || event.metaKey || isInsertPaste)) return;
  const key = String(event.key || '').toLowerCase();
  if (key === 'c' || key === 'x' || key === 'v' || key === 'a' ||
      key === 'insert') {
    event.preventDefault();
    event.stopPropagation();
  }
}

/**
 * Disables text selection and clipboard actions throughout the game UI.
 * Text inputs remain usable for typing; only selection/copy/cut/paste is blocked.
 */
export function registerTextInteractionGuard(target = globalThis.document) {
  if (!target?.addEventListener) return () => {};

  for (const type of [...BLOCKED_CLIPBOARD_EVENTS, ...BLOCKED_CONTEXT_EVENTS]) {
    target.addEventListener(type, preventDefault, true);
  }
  target.addEventListener('keydown', blockClipboardShortcuts, true);

  return () => {
    for (const type of [...BLOCKED_CLIPBOARD_EVENTS, ...BLOCKED_CONTEXT_EVENTS]) {
      target.removeEventListener(type, preventDefault, true);
    }
    target.removeEventListener('keydown', blockClipboardShortcuts, true);
  };
}
