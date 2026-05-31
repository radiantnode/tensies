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
  menu.classList.remove('show-changelog');
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

function updateChangelogFades(body) {
  const { scrollTop, scrollHeight, clientHeight } = body;
  body.classList.toggle('can-scroll-up', scrollTop > 1);
  body.classList.toggle('can-scroll-down', scrollTop + clientHeight < scrollHeight - 1);
}

document.querySelectorAll('.menu-changelog-body').forEach(body => {
  body.addEventListener('scroll', () => updateChangelogFades(body), { passive: true });
});

document.addEventListener('click', ev => {
  if (ev.target.closest('.menu-whats-new-btn')) {
    const menu = ev.target.closest('.game-menu');
    menu.classList.add('show-changelog');
    const body = menu.querySelector('.menu-changelog-body');
    body.scrollTop = 0;
    requestAnimationFrame(() => updateChangelogFades(body));
  }
  if (ev.target.closest('.menu-changelog-back-btn')) {
    ev.target.closest('.game-menu').classList.remove('show-changelog');
  }
});

document.addEventListener('keydown', ev => {
  if (ev.key === 'Escape') closeAllNavMenus();
});
