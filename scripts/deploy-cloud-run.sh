#!/usr/bin/env bash
set -euo pipefail
# Run only after approving Google Cloud billing and public service access.
: "${GCP_PROJECT_ID:?Set the approved Google Cloud project ID}"
: "${GCP_REGION:?Set the approved Google Cloud region}"
: "${GEMINI_SECRET_NAME:?Set an existing Secret Manager secret name}"
: "${RUNTIME_SERVICE_ACCOUNT:?Set a dedicated runtime service account email}"
: "${APPROVE_PUBLIC_DEPLOYMENT:?Set to yes after reviewing billing and public access}"
[[ "$APPROVE_PUBLIC_DEPLOYMENT" == yes ]] || exit 1
command -v gcloud >/dev/null
npm run typecheck
npm run lint
npm test
npm run build
gcloud run deploy vayuguard-ai \
  --project "$GCP_PROJECT_ID" --region "$GCP_REGION" --source . \
  --service-account "$RUNTIME_SERVICE_ACCOUNT" \
  --allow-unauthenticated --port 8080 \
  --memory 512Mi --cpu 1 --min-instances 0 --max-instances 1 \
  --concurrency 20 --timeout 60 \
  --set-env-vars NODE_ENV=production \
  --set-secrets "GEMINI_API_KEY=${GEMINI_SECRET_NAME}:latest"
gcloud run services describe vayuguard-ai --project "$GCP_PROJECT_ID" \
  --region "$GCP_REGION" --format='value(status.url)'
