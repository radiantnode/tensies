// @ts-check

/**
 * Shared bottom-sheet <dialog> behaviour, used by the lobby places picker and
 * the landing join sheet (both styled by `.places-sheet`):
 *
 *  - modal open (`showModal`);
 *  - slide-down close via `.is-closing` + the `places-sheet-out` animation;
 *  - Escape + backdrop-tap dismissal;
 *  - docking above the iOS soft keyboard (`visualViewport` → `--kb-lift` +
 *    `.is-kb-docked`), optionally pinning a fixed height so a scrolling list
 *    fills the space above the keyboard.
 */
export class SheetController {
  /** @type {HTMLDialogElement} */
  #dialog;
  /** @type {(() => void) | undefined} */
  #onClosed;
  /** @type {boolean} */
  #pinHeight;

  /**
   * @param {HTMLDialogElement} dialog
   * @param {{ onClosed?: () => void, pinHeight?: boolean }} [opts]
   *   `onClosed` runs after the slide-out; `pinHeight` fixes the docked height
   *   to the space above the keyboard (for a list that should fill it).
   */
  constructor(dialog, { onClosed, pinHeight = false } = {}) {
    this.#dialog = dialog;
    this.#onClosed = onClosed;
    this.#pinHeight = pinHeight;
    // Escape instant-closes a modal <dialog>; intercept so it slides down.
    dialog.addEventListener('cancel', (event) => {
      event.preventDefault();
      this.close();
    });
    // Backdrop tap (a modal dialog reports it as a click on the dialog itself).
    dialog.addEventListener('click', (event) => {
      const r = dialog.getBoundingClientRect();
      const outside = event.clientX < r.left || event.clientX > r.right ||
                      event.clientY < r.top || event.clientY > r.bottom;
      if (outside) this.close();
    });
  }

  /** Open the sheet modally and start tracking the keyboard. */
  open() {
    if (this.#dialog.open) return;
    this.#dialog.classList.remove('is-closing');
    this.#clearKeyboardStyles();
    this.#dialog.showModal();
    this.#bindKeyboard();
  }

  /** Slide the sheet down, then close it and clear keyboard docking. */
  close() {
    const d = this.#dialog;
    if (!d.open || d.classList.contains('is-closing')) return;
    this.#stopKeyboard();
    d.classList.add('is-closing');
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      d.classList.remove('is-closing');
      d.close();
      this.#clearKeyboardStyles();
      this.#onClosed?.();
    };
    d.addEventListener('animationend', finish, { once: true });
    // Fallback so the sheet still closes if the slide-out animation never fires
    // its `animationend` (reduced motion, a backgrounded tab). Slightly longer
    // than the 0.2s `places-sheet-out` duration.
    setTimeout(finish, 300);
  }

  /** Stop tracking without animating — for a host component disconnecting. */
  destroy() {
    this.#stopKeyboard();
  }

  #bindKeyboard() {
    const vv = window.visualViewport;
    if (!vv) return;
    vv.addEventListener('resize', this.#syncToKeyboard);
    vv.addEventListener('scroll', this.#syncToKeyboard);
  }

  #stopKeyboard() {
    const vv = window.visualViewport;
    if (!vv) return;
    vv.removeEventListener('resize', this.#syncToKeyboard);
    vv.removeEventListener('scroll', this.#syncToKeyboard);
  }

  /**
   * Dock the sheet above the iOS soft keyboard. iOS shrinks the visual viewport
   * but leaves position:fixed pinned to the layout viewport, so the keyboard
   * would otherwise cover the sheet: lift the bottom to the keyboard top (via
   * `bottom`, not transform, so the slide animation stays intact) and — when
   * `pinHeight` — cap the height to the space that remains.
   */
  #syncToKeyboard = () => {
    const vv = window.visualViewport;
    if (!vv) return;
    const kb = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
    // >120px filters out URL-bar-sized viewport changes; a keyboard is taller.
    if (kb > 120) {
      // `kb` is measured against the full-screen innerHeight, but iOS reports
      // vv.height from below the status bar — so the raw lift overshoots by the
      // top safe-area. CSS subtracts env(safe-area-inset-top) from --kb-lift.
      this.#dialog.style.setProperty('--kb-lift', `${Math.round(kb)}px`);
      this.#dialog.classList.add('is-kb-docked');
      if (this.#pinHeight) {
        const h = `${Math.round(vv.height - 12)}px`;
        this.#dialog.style.blockSize = h;
        this.#dialog.style.maxBlockSize = h;
      }
    } else {
      this.#clearKeyboardStyles();
    }
  };

  #clearKeyboardStyles() {
    const d = this.#dialog;
    d.classList.remove('is-kb-docked');
    d.style.removeProperty('--kb-lift');
    d.style.blockSize = '';
    d.style.maxBlockSize = '';
  }
}
