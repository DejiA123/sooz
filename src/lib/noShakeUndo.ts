/**
 * iPhone's "Undo Typing" pop-up on shake (owner's request: it shouldn't keep coming up).
 *
 * iOS shows it whenever the page's undo list still holds typing — and Safari keeps that list long
 * after the text box is gone (e.g. after Edit profile), which native apps don't. WebKit empties the
 * whole page's undo / redo list when a frame is detached (FrameLoader::detachFromParent → closeURL →
 * Editor::clearUndoRedoOperations → WebPageProxy::ClearAllEditCommands, which removes every undo action
 * from the web view's undo manager). So once someone has typed and then left the text box, SOOZ adds and
 * removes an invisible empty frame: nothing is left to undo, and shaking the phone does nothing — while
 * they're still typing in a box, shake-to-undo works as usual.
 */
const NOT_TEXT = new Set(["button", "checkbox", "color", "file", "hidden", "image", "radio", "range", "reset", "submit"]);

const isTextField = (el: Element | null) =>
  !!el && (el instanceof HTMLTextAreaElement || (el instanceof HTMLInputElement && !NOT_TEXT.has(el.type)) || (el as HTMLElement).isContentEditable === true);

let dirty = false;
let poll: number | undefined;

/** Empties the page's undo list (see above). */
export function clearUndoHistory() {
  try {
    const f = document.createElement("iframe");
    f.setAttribute("aria-hidden", "true");
    f.tabIndex = -1;
    f.style.cssText = "position:fixed;left:-10px;top:-10px;width:0;height:0;border:0;opacity:0;pointer-events:none;";
    document.body.appendChild(f);
    f.remove();
  } catch { /* nothing to do */ }
}

function check() {
  if (!dirty || isTextField(document.activeElement)) return;
  dirty = false;
  if (poll !== undefined) { clearInterval(poll); poll = undefined; }
  clearUndoHistory();
}

export function startNoShakeUndo() {
  if (typeof window === "undefined") return;
  const ua = navigator.userAgent;
  const iOS = /iPhone|iPad|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  if (!iOS && !import.meta.env.DEV && !(window as Window & { __soozNoShakeUndo?: boolean }).__soozNoShakeUndo) return;

  // Typing anywhere marks the list as holding something to undo…
  document.addEventListener("input", (e) => {
    if (!isTextField(e.target as Element)) return;
    dirty = true;
    // …a text box can disappear without losing focus first (a sheet closing), so keep checking until it's cleared.
    if (poll === undefined) poll = window.setInterval(check, 700);
  }, true);
  // …and it's emptied as soon as they've left the text box.
  document.addEventListener("focusout", () => setTimeout(check, 0), true);
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") check(); });
}
