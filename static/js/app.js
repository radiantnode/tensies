// @ts-check

// Component registrations (side-effect imports by design: each module's only
// job at import time is customElements.define for its tag).
import './components/landing-screen.js';
import './components/join-screen.js';
import './components/lobby-screen.js';
import './components/game-screen.js';
import './components/nav-menu.js';

import { makeName } from './names.js';
import { maybeReconnect } from './net.js';
import { bootstrap } from './router.js';
import { state } from './state.js';
import { installTouchGuard } from './touch.js';

// One shared "Zesty Pickle"-style name for both name-field placeholders.
// Must be the first Math.random consumer so the pixel harness's seeded RNG
// always yields the same name.
state.randomNamePlaceholder = makeName();

installTouchGuard();
bootstrap({ resumeSession: maybeReconnect });
