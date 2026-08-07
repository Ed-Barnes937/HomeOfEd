// Shared between IwftApp.tsx (browser) and GridPagePom.ts (Node): the global
// key the fake audio driver is exposed under, so the Node-side POM can drive
// its hand-cranked clock via `page.evaluate` — same key, no side effects, safe
// to import from either side (mirrors protocol.ts's SEED_SOURCE_KEY pattern).
export const BOOP_AUDIO_DRIVER_KEY = '__boopAudioDriver'
