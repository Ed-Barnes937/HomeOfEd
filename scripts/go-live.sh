#!/usr/bin/env bash
# go-live.sh — one-command go-live for a new app (runbook G4.9, ADR 0011).
#
#   CLOUDFLARE_API_TOKEN=... scripts/go-live.sh <app> [--db] [--dry-run]
#
#   <app>       directory name under apps/ (also the subdomain)
#   --db        DB-backed app: attach a database in the shared hoe-pg cluster
#   --dry-run   print every mutating command instead of running it
#
# HUMAN-RUN ONLY. This script creates and mutates real infrastructure (root
# CLAUDE.md "Infrastructure is human-gated"); it runs under YOUR credentials:
#   - flyctl:     `fly auth login` beforehand
#   - Cloudflare: CLOUDFLARE_API_TOKEN env var, scoped to Zone.DNS:Edit on
#                 the homeofed.com zone (dashboard -> My Profile -> API Tokens
#                 -> Create Token -> "Edit zone DNS" template)
#
# Idempotent: every step checks before it creates, so a partial failure can be
# re-run from the top.
#
# Cert flow: the CNAME is created PROXIED from the start, and an ownership TXT
# record (_fly-ownership.<app>) gives Let's Encrypt a validation path that does
# not depend on reaching the origin, so the cert can be issued AND RENEWED
# from behind the Cloudflare proxy. ADR 0071: the earlier grey-cloud/flip-to-
# orange dance validated once at go-live and left every app unable to renew.

set -euo pipefail

DOMAIN="homeofed.com"
PG_CLUSTER="hoe-pg"
CF_API="https://api.cloudflare.com/client/v4"
CERT_TIMEOUT_SECS=300

# ── args ─────────────────────────────────────────────────────────────────────
APP="" WITH_DB=false DRY_RUN=false
for arg in "$@"; do
  case "$arg" in
    --db) WITH_DB=true ;;
    --dry-run) DRY_RUN=true ;;
    -*) echo "unknown flag: $arg" >&2; exit 2 ;;
    *) APP="$arg" ;;
  esac
done
[[ -n "$APP" ]] || { echo "usage: scripts/go-live.sh <app> [--db] [--dry-run]" >&2; exit 2; }

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"   # fly deploy's docker build context must be the monorepo root
FLY_TOML="$REPO_ROOT/apps/$APP/fly.toml"
HOST="$APP.$DOMAIN"

say()  { printf '\n\033[1m== %s\033[0m\n' "$*"; }
# Mutating commands go through run(); in --dry-run they are printed, not run.
run()  { printf '   $ %s\n' "$*"; $DRY_RUN || "$@"; }

# ── preflight ────────────────────────────────────────────────────────────────
say "preflight"
[[ -f "$FLY_TOML" ]] || { echo "no fly.toml at apps/$APP/fly.toml" >&2; exit 1; }
FLY_APP="$(sed -n "s/^app = ['\"]\(.*\)['\"]$/\1/p" "$FLY_TOML")"
[[ -n "$FLY_APP" ]] || { echo "could not parse app name from $FLY_TOML" >&2; exit 1; }
echo "   app=$APP  fly-app=$FLY_APP  host=$HOST  db=$WITH_DB  dry-run=$DRY_RUN"

for bin in fly jq curl dig; do
  command -v "$bin" >/dev/null || { echo "$bin not found on PATH (jq: try 'asdf set -u jq 1.7' or brew install jq; dig: brew install bind / apt install dnsutils)" >&2; exit 1; }
done

if ! $DRY_RUN; then
  fly auth whoami >/dev/null || { echo "not logged in to fly — run: fly auth login" >&2; exit 1; }
  [[ -n "${CLOUDFLARE_API_TOKEN:-}" ]] || { echo "CLOUDFLARE_API_TOKEN not set" >&2; exit 1; }
fi

cf() { # cf <method> <path> [json-body]  — Cloudflare API call
  local method="$1" path="$2" body="${3:-}"
  curl -fsS -X "$method" "$CF_API$path" \
    -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
    -H "Content-Type: application/json" \
    ${body:+--data "$body"}
}
cf_mutate() { # printed in dry-run, executed otherwise
  printf '   $ cf %s %s %s\n' "$1" "$2" "${3:-}"
  $DRY_RUN || cf "$@" >/dev/null
}

ZONE_ID="<zone-id>"   # dry-run placeholder; resolved for real below
if ! $DRY_RUN; then
  ZONE_ID="$(cf GET "/zones?name=$DOMAIN" | jq -r '.result[0].id // empty')"
  [[ -n "$ZONE_ID" ]] || { echo "Cloudflare zone $DOMAIN not visible to this token" >&2; exit 1; }
fi

# ── 1. fly app ───────────────────────────────────────────────────────────────
say "1/6 fly app"
if ! $DRY_RUN && fly apps list --json | jq -e --arg a "$FLY_APP" '.[] | select(.Name == $a)' >/dev/null; then
  echo "   $FLY_APP already exists — skipping"
else
  run fly apps create "$FLY_APP"
fi

# ── 2. database (only with --db) ─────────────────────────────────────────────
say "2/6 database"
if ! $WITH_DB; then
  echo "   stateless app (ADR 0008) — skipping"
elif ! $DRY_RUN && fly secrets list --app "$FLY_APP" | grep -q DATABASE_URL; then
  echo "   DATABASE_URL already set — skipping attach"
else
  run fly postgres attach "$PG_CLUSTER" --app "$FLY_APP" --database-name "$APP"
fi

# ── 3. first deploy ──────────────────────────────────────────────────────────
say "3/6 deploy (from repo root — docker context is the monorepo)"
run fly deploy --config "apps/$APP/fly.toml" --remote-only

# ── 4. DNS: CNAME, proxied from the start ────────────────────────────────────
say "4/6 Cloudflare CNAME $APP -> $FLY_APP.fly.dev (proxied)"
RECORD_ID=""
if ! $DRY_RUN; then
  RECORD_ID="$(cf GET "/zones/$ZONE_ID/dns_records?type=CNAME&name=$HOST" | jq -r '.result[0].id // empty')"
fi
CNAME_BODY="{\"type\":\"CNAME\",\"name\":\"$APP\",\"content\":\"$FLY_APP.fly.dev\",\"proxied\":true}"
if [[ -n "$RECORD_ID" ]]; then
  echo "   record exists — ensuring it points at $FLY_APP.fly.dev"
  cf_mutate PATCH "/zones/$ZONE_ID/dns_records/$RECORD_ID" "$CNAME_BODY"
else
  cf_mutate POST "/zones/$ZONE_ID/dns_records" "$CNAME_BODY"
fi

# ── 5. cert: request it, prove ownership by DNS, wait for an ACTIVE cert ─────
say "5/6 TLS cert for $HOST"
if ! $DRY_RUN && fly certs list --app "$FLY_APP" | grep -q "$HOST"; then
  echo "   cert already requested — skipping add"
else
  run fly certs add "$HOST" --app "$FLY_APP"
fi

# The ownership TXT is what lets validation succeed through the proxy, both now
# and at every unattended renewal after this. Without it Fly falls back to an
# HTTP challenge that the orange cloud blocks, and the cert silently lapses.
OWNERSHIP="app-<id>"
if ! $DRY_RUN; then
  OWNERSHIP="$(fly certs setup "$HOST" --app "$FLY_APP" 2>&1 | grep -oE 'app-[a-z0-9]+' | head -1)"
  [[ -n "$OWNERSHIP" ]] || { echo "could not read the ownership token from 'fly certs setup $HOST --app $FLY_APP'" >&2; exit 1; }
fi
TXT_NAME="_fly-ownership.$APP"
echo "   ownership TXT $TXT_NAME -> $OWNERSHIP"
TXT_ID=""
if ! $DRY_RUN; then
  TXT_ID="$(cf GET "/zones/$ZONE_ID/dns_records?type=TXT&name=$TXT_NAME.$DOMAIN" | jq -r '.result[0].id // empty')"
fi
TXT_BODY="{\"type\":\"TXT\",\"name\":\"$TXT_NAME\",\"content\":\"$OWNERSHIP\"}"
if [[ -n "$TXT_ID" ]]; then
  cf_mutate PATCH "/zones/$ZONE_ID/dns_records/$TXT_ID" "$TXT_BODY"
else
  cf_mutate POST "/zones/$ZONE_ID/dns_records" "$TXT_BODY"
fi

# Poll for a certificate that is ACTIVE *and* UNEXPIRED. Never key on the status
# word: a lapsed cert still reports Status=Issued/Ready alongside a past expiry,
# which is exactly how the old `grep -qiE 'issued|ready'` passed while the site
# served 525 (it also matched the "Issued = rsa,ecdsa" key-types line).
if $DRY_RUN; then
  printf '   $ fly certs show %s --app %s --json   # poll for an active, unexpired cert (max %ss)\n' "$HOST" "$FLY_APP" "$CERT_TIMEOUT_SECS"
else
  deadline=$((SECONDS + CERT_TIMEOUT_SECS))
  until fly certs show "$HOST" --app "$FLY_APP" --json 2>/dev/null |
          jq -e --arg now "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
             '[.certificates[]? | select(.status == "active") | select(.expires_at > $now)] | length > 0' >/dev/null; do
    (( SECONDS < deadline )) || { echo "no active cert after ${CERT_TIMEOUT_SECS}s - inspect 'fly certs show $HOST --app $FLY_APP', confirm 'dig +short TXT $TXT_NAME.$DOMAIN', then re-run (it resumes here)" >&2; exit 1; }
    echo "   waiting for cert…"; sleep 10
  done
  echo "   cert active until $(fly certs show "$HOST" --app "$FLY_APP" --json | jq -r '[.certificates[] | select(.status == "active") | .expires_at] | max')"
fi

# ── 6. verify ────────────────────────────────────────────────────────────────
say "6/6 verify"
if $DRY_RUN; then
  printf '   $ curl -fsS https://%s.fly.dev/health\n   $ dig +short %s @1.1.1.1\n   $ curl -fsS --resolve %s:443:<public-ip> https://%s/health\n' "$FLY_APP" "$HOST" "$HOST" "$HOST"
else
  # generous retries: cold-start (min_machines_running=0) + proxy propagation.
  # Every check is fatal — a green go-live must not paper over a failed probe.
  curl -fsS --retry 8 --retry-delay 5 --retry-all-errors "https://$FLY_APP.fly.dev/health" >/dev/null \
    || { echo "FAILED: https://$FLY_APP.fly.dev/health did not return OK" >&2; exit 1; }
  echo "   fly.dev /health ok"

  # Custom host: resolve via a public resolver (1.1.1.1) and pin curl to that IP,
  # so a stale local DNS cache (e.g. an NXDOMAIN cached before the record went
  # live) can't fail an otherwise-good go-live.
  HOST_IP="$(dig +short "$HOST" @1.1.1.1 | grep -Em1 '^[0-9]+(\.[0-9]+){3}$' || true)"
  [[ -n "$HOST_IP" ]] || { echo "FAILED: $HOST does not resolve at 1.1.1.1 yet — DNS not propagated" >&2; exit 1; }
  echo "   $HOST → $HOST_IP (via 1.1.1.1); if your browser/curl still can't reach it, flush your DNS cache (macOS: sudo dscacheutil -flushcache; sudo killall -HUP mDNSResponder)"

  curl -fsS --resolve "$HOST:443:$HOST_IP" --retry 8 --retry-delay 5 --retry-all-errors "https://$HOST/health" >/dev/null \
    || { echo "FAILED: https://$HOST/health did not return OK" >&2; exit 1; }
  echo "   $HOST /health ok"

  curl -fsS --resolve "$HOST:443:$HOST_IP" "https://$HOST/" | grep -q '<div id="root">' \
    || { echo "FAILED: https://$HOST/ did not serve the SPA index" >&2; exit 1; }
  echo "   SPA index ok"
fi

say "done — https://$HOST"
