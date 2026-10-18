#!/usr/bin/env bash
# Brand-rule / approval / frequency-cap tests against an in-memory fake database (no Neon, no Resend).
#   bash tests/safeguards/run.sh
set -euo pipefail
cd "$(dirname "$0")/../.."
OUT=tests/safeguards/out
rm -rf "$OUT"
npx tsc --outDir "$OUT" --module commonjs --moduleResolution node --target es2022 --esModuleInterop --skipLibCheck \
  src/lib/brand-rules.ts src/lib/agent-views.ts src/lib/dispatch.ts src/lib/campaign-save.ts src/lib/emailFooter.ts src/lib/unsubscribe.ts
echo '{"type":"commonjs"}' > "$OUT/package.json"
cp tests/safeguards/fake-prisma.js "$OUT/lib/prisma.js"   # swap the real client for the fake
node tests/safeguards/unit.js
node tests/safeguards/safeguards.js
node tests/safeguards/unsubscribe.js
