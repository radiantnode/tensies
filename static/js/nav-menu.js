const entries = ['landing', 'join', 'lobby'].map(id => ({
  btn:  document.getElementById(`${id}-menu-btn`),
  menu: document.getElementById(`${id}-menu`),
}));

function open({ btn, menu }) {
  btn.classList.add('open');
  menu.classList.add('open');
  btn.setAttribute('aria-expanded', 'true');
  btn.setAttribute('aria-label', 'Close menu');
  menu.setAttribute('aria-hidden', 'false');
}

function close({ btn, menu }) {
  btn.classList.remove('open');
  menu.classList.remove('open');
  btn.setAttribute('aria-expanded', 'false');
  btn.setAttribute('aria-label', 'Open menu');
  menu.setAttribute('aria-hidden', 'true');
}

export function closeAllNavMenus() {
  entries.forEach(e => { if (e.btn.classList.contains('open')) close(e); });
}

entries.forEach(e => {
  e.btn.addEventListener('click', () => e.btn.classList.contains('open') ? close(e) : open(e));
});

document.addEventListener('keydown', ev => {
  if (ev.key === 'Escape') closeAllNavMenus();
});
