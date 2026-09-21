#!/usr/bin/env bash
set -euo pipefail
npm run start -- --hostname 0.0.0.0 > /tmp/nexus-web.log 2>&1 & WEB=$!
npm run worker > /tmp/nexus-worker.log 2>&1 & WORKER=$!
trap 'kill "$WEB" "$WORKER" 2>/dev/null || true' EXIT
node --input-type=module -e 'for(let i=0;i<60;i++){try{let r=await fetch("http://127.0.0.1:3000/api/health");let h=await r.json();if(h.workerOnline)process.exit(0)}catch{}await new Promise(r=>setTimeout(r,1000))}process.exit(1)'
npm run test:e2e
