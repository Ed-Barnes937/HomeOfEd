/**
 * Where the family service lives. Local hostnames talk to the local service
 * (`pnpm dev --filter=family`, port 3010); everything else talks to the one in
 * production. Same shape as `hubUrl.ts`, and the same reason: boop is served
 * from several hostnames and must never point a child's browser at a dev box.
 */
export function familyUrl(hostname: string): string {
  if (hostname === 'localhost' || hostname === '127.0.0.1') return 'http://localhost:3010'
  return 'https://family.homeofed.com'
}
