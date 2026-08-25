// @ts-check

// First, before anything registers. Importing hubble.js resolves whether the
// Hubble wall is framing us and stamps the answer on <html>; the components
// below upgrade and render as soon as they are defined, so the stamp has to be
// in place before they do. hubble.js itself still only detects — what to do
// about the answer lives here and in hubble-media.js.
import { isHubble } from './hubble.js';

// Component registrations (side-effect imports by design: each module's only
// job at import time is customElements.define for its tag).
import './components/landing-screen.js';
import './components/nearby-screen.js';
import './components/lobby-stamp.js';
import './components/lobby-screen.js';
import './components/game-screen.js';
import './components/signin-screen.js';
import './components/onboarding-screen.js';
import './components/profile-screen.js';
import './components/game-detail-screen.js';
import './components/changelog-screen.js';
import './components/nav-menu.js';
import './components/a2hs-guide.js';

import { setupInstall } from './a2hs.js';
import { useWallMedia } from './hubble-media.js';
import { maybeReconnect } from './net.js';
import { bootstrap } from './router.js';
import { installTouchGuard } from './touch.js';

// Before the router, so the 4K clips start fetching as early as they can — the
// browser has already begun pulling the small ones during parse.
if (isHubble()) useWallMedia();

installTouchGuard();
setupInstall();

bootstrap({ resumeSession: maybeReconnect });
