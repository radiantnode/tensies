// @ts-check

// Component registrations (side-effect imports by design: each module's only
// job at import time is customElements.define for its tag).
import './components/landing-screen.js';
import './components/join-screen.js';
import './components/lobby-screen.js';
import './components/game-screen.js';
import './components/nav-menu.js';

import { loadAttitude } from './attitude.js';
import { maybeReconnect } from './net.js';
import { bootstrap } from './router.js';
import { installTouchGuard } from './touch.js';

installTouchGuard();
loadAttitude(); // fire-and-forget — the UI uses built-in copy until it lands
bootstrap({ resumeSession: maybeReconnect });
