// @ts-check

// Component registrations (side-effect imports by design: each module's only
// job at import time is customElements.define for its tag).
import './components/landing-screen.js';
import './components/join-screen.js';
import './components/lobby-screen.js';
import './components/game-screen.js';
import './components/signin-screen.js';
import './components/onboarding-screen.js';
import './components/profile-screen.js';
import './components/game-detail-screen.js';
import './components/nav-menu.js';
import './components/a2hs-guide.js';

import { setupInstall } from './a2hs.js';
import { maybeReconnect } from './net.js';
import { subscribeToPush } from './push.js';
import { bootstrap } from './router.js';
import { installTouchGuard } from './touch.js';

installTouchGuard();
setupInstall();

bootstrap({ resumeSession: maybeReconnect });

// Best-effort Web Push opt-in. No-ops unless the user is signed in, the browser
// supports push, and push is enabled server-side; otherwise it quietly returns.
subscribeToPush().catch(() => {});
