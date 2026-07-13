// @ts-check

/**
 * Toggle `can-scroll-up` / `can-scroll-down` on a scrollable element so CSS
 * can show edge-fade affordances when content is hidden above or below.
 * @param {HTMLElement} el
 */
export function updateScrollFades(el) {
  const { scrollTop, scrollHeight, clientHeight } = el;
  el.classList.toggle('can-scroll-up', scrollTop > 1);
  el.classList.toggle('can-scroll-down', scrollTop + clientHeight < scrollHeight - 1);
}
