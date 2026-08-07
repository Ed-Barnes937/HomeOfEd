/**
 * Where the back arrow points. The hub (home of ed) is the apex `homeofed.com`
 * in production; in local dev it runs on port 3000. Local hostnames go to the
 * local hub; everything else (prod, previews) goes to the apex so the arrow
 * always lands on a real hub.
 */
export function hubUrl(hostname: string): string {
  if (hostname === 'localhost' || hostname === '127.0.0.1') return 'http://localhost:3000'
  return 'https://homeofed.com'
}
