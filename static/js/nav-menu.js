const navMenu = document.getElementById('nav-menu');
const btns = ['landing', 'join', 'lobby'].map(id =>
  document.getElementById(`${id}-menu-btn`)
);

let activeBtn = null;

function open(btn) {
  if (activeBtn && activeBtn !== btn) activeBtn.classList.remove('open');
  activeBtn = btn;
  btn.classList.add('open');
  navMenu.classList.add('open');
  btn.setAttribute('aria-expanded', 'true');
  btn.setAttribute('aria-label', 'Close menu');
  navMenu.setAttribute('aria-hidden', 'false');
}

function close() {
  if (activeBtn) {
    activeBtn.classList.remove('open');
    activeBtn.setAttribute('aria-expanded', 'false');
    activeBtn.setAttribute('aria-label', 'Open menu');
    activeBtn = null;
  }
  navMenu.classList.remove('open');
  navMenu.classList.remove('show-changelog');
  navMenu.setAttribute('aria-hidden', 'true');
}

export function closeAllNavMenus() {
  close();
}

btns.forEach(btn => {
  btn.addEventListener('click', () =>
    btn.classList.contains('open') ? close() : open(btn)
  );
});

function updateChangelogFades(body) {
  const { scrollTop, scrollHeight, clientHeight } = body;
  body.classList.toggle('can-scroll-up', scrollTop > 1);
  body.classList.toggle('can-scroll-down', scrollTop + clientHeight < scrollHeight - 1);
}

const changelogBody = navMenu.querySelector('.menu-changelog-body');
changelogBody.addEventListener('scroll', () => updateChangelogFades(changelogBody), { passive: true });

document.addEventListener('click', ev => {
  if (ev.target.closest('.menu-whats-new-btn')) {
    navMenu.classList.add('show-changelog');
    changelogBody.scrollTop = 0;
    requestAnimationFrame(() => updateChangelogFades(changelogBody));
  }
  if (ev.target.closest('.menu-changelog-back-btn')) {
    navMenu.classList.remove('show-changelog');
  }
});

document.addEventListener('keydown', ev => {
  if (ev.key === 'Escape') close();
});
