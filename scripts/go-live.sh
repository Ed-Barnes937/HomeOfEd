#!/usr/bin/env bash
# go-live.sh — one-command go-live for a new app (runbook G4.7, ADR 0009).
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
# Cert flow (avoids the Cloudflare-proxy / Fly-cert chicken-and-egg): the
# CNAME is created DNS-only (grey cloud) so Let's Encrypt validation sees Fly
# directly; once the cert is Issued the record is flipped to proxied (orange).

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

for bin in fly jq curl; do
  command -v "$bin" >/dev/null || { echo "$bin not found on PATH (jq: try 'asdf set -u jq 1.7' or brew install jq)" >&2; exit 1; }
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

# ── 4. DNS: CNAME, grey-cloud first ──────────────────────────────────────────
say "4/6 Cloudflare CNAME $APP -> $FLY_APP.fly.dev (DNS-only until cert issues)"
RECORD_ID=""
if ! $DRY_RUN; then
  RECORD_ID="$(cf GET "/zones/$ZONE_ID/dns_records?type=CNAME&name=$HOST" | jq -r '.result[0].id // empty')"
fi
CNAME_BODY="{\"type\":\"CNAME\",\"name\":\"$APP\",\"content\":\"$FLY_APP.fly.dev\",\"proxied\":false}"
if [[ -n "$RECORD_ID" ]]; then
  echo "   record exists — ensuring it points at $FLY_APP.fly.dev"
  cf_mutate PATCH "/zones/$ZONE_ID/dns_records/$RECORD_ID" "$CNAME_BODY"
else
  cf_mutate POST "/zones/$ZONE_ID/dns_records" "$CNAME_BODY"
fi

# ── 5. fly cert, wait for Issued, then flip to proxied ───────────────────────
say "5/6 TLS cert for $HOST"
if ! $DRY_RUN && fly certs list --app "$FLY_APP" | grep -q "$HOST"; then
  echo "   cert already requested — skipping add"
else
  run fly certs add "$HOST" --app "$FLY_APP"
fi

if $DRY_RUN; then
  printf '   $ fly certs check %s --app %s   # poll until Issued (max %ss)\n' "$HOST" "$FLY_APP" "$CERT_TIMEOUT_SECS"
else
  deadline=$((SECONDS + CERT_TIMEOUT_SECS))
  until fly certs check "$HOST" --app "$FLY_APP" 2>&1 | grep -qiE 'issued|ready'; do
    (( SECONDS < deadline )) || { echo "cert not issued after ${CERT_TIMEOUT_SECS}s — check 'fly certs check $HOST --app $FLY_APP', then re-run this script (it will resume here)" >&2; exit 1; }
    echo "   waiting for cert…"; sleep 10
  done
  echo "   cert Issued"
  RECORD_ID="${RECORD_ID:-$(cf GET "/zones/$ZONE_ID/dns_records?type=CNAME&name=$HOST" | jq -r '.result[0].id')}"
fi
cf_mutate PATCH "/zones/$ZONE_ID/dns_records/${RECORD_ID:-<record-id>}" '{"proxied":true}'

# ── 6. verify ────────────────────────────────────────────────────────────────
say "6/6 verify"
if $DRY_RUN; then
  printf '   $ curl -fsS https://%s.fly.dev/health\n   $ curl -fsS https://%s/health\n' "$FLY_APP" "$HOST"
else
  # generous retries: cold-start (min_machines_running=0) + proxy propagation
  curl -fsS --retry 8 --retry-delay 5 --retry-all-errors "https://$FLY_APP.fly.dev/health" >/dev/null && echo "   fly.dev /health ok"
  curl -fsS --retry 8 --retry-delay 5 --retry-all-errors "https://$HOST/health" >/dev/null && echo "   $HOST /health ok"
  curl -fsS "https://$HOST/" | grep -q '<div id="root">' && echo "   SPA index ok"
fi

say "done — https://$HOST"
