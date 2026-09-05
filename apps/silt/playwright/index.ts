// Playwright CT bootstrap - the app's global styles, so a component test lays
// out the way the app does. `src/global.scss` zeroes the UA's `body` margin;
// leaving it out here would put the harness 16px wider than the real page
// (ticket 26).
import '../src/global.scss'
