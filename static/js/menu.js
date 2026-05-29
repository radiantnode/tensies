const btn  = document.getElementById('game-menu-btn');
const menu = document.getElementById('game-menu');

function isOpen() { return btn.classList.contains('open'); }

export function openMenu() {
  btn.classList.add('open');
  menu.classList.add('open');
  btn.setAttribute('aria-expanded', 'true');
  btn.setAttribute('aria-label', 'Close menu');
  menu.setAttribute('aria-hidden', 'false');
}

export function closeMenu() {
  btn.classList.remove('open');
  menu.classList.remove('open');
  btn.setAttribute('aria-expanded', 'false');
  btn.setAttribute('aria-label', 'Open menu');
  menu.setAttribute('aria-hidden', 'true');
}

btn.addEventListener('click', () => { isOpen() ? closeMenu() : openMenu(); });

document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && isOpen()) closeMenu();
});
