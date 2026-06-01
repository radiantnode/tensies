// Entry point: register the screen components, set the shared random-name
// placeholder, and bootstrap the router. The loading screen is inline HTML in
// index.html (paints before this module runs); the rest are components.
import './components/landing-screen.js';
import './components/join-screen.js';
import './components/nav-menu.js';

import { makeName } from './names.js';
import { bootstrap } from './router.js';

// One shared "Zesty Pickle"-style name across both name fields (matching the
// original single makeName() call). Must be the first Math.random consumer so
// the seeded value is stable for visual tests.
function loadRandomName() {
  const name = makeName();
  for (const id of ['name-input', 'join-name-input']) {
    const el = document.getElementById(id);
    if (el) el.placeholder = name;
  }
}

loadRandomName();
bootstrap();
