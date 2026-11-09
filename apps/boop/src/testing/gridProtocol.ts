// Shared between IwftApp.tsx (browser) and GridPagePom.ts (Node): the global
// key the fake audio driver is exposed under, so the Node-side POM can drive
// its hand-cranked clock via `page.evaluate` — same key, no side effects, safe
// to import from either side (mirrors protocol.ts's SEED_SOURCE_KEY pattern).
export const BOOP_AUDIO_DRIVER_KEY = '__boopAudioDriver'

/** The same trampoline for the fake family save client (ADR 0080). */
export const BOOP_SAVE_CLIENT_KEY = '__boopSaveClient'

/**
 * …and for the names of the calls the app made on it, so a test can assert
 * that boop never called the service at all. The app is handed a recorder over
 * the client; a test reading the account goes to the client directly, so its
 * own reads are not counted.
 */
export const BOOP_SAVE_CALLS_KEY = '__boopSaveCalls'
