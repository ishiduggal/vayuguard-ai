# Cloud Run release preparation
Organizer email confirms Cloud Run is required. No cloud service has been created yet.

1. Sign in to Google Cloud and select an approved project/region with billing. Source builds, image storage, hosting and Gemini can incur charges. Maximum instances and budget alerts do not guarantee a spending cap.
2. Install/authenticate gcloud; enable Cloud Run, Cloud Build, Artifact Registry and Secret Manager as needed with project-owner approval.
3. Create a dedicated runtime service account. Store an authorized Gemini API key in Secret Manager, and grant that account secret-access permission only for that secret. Do not put keys in the repository or chat.
4. Confirm source-build permissions for the deployer/build service account following current Google Cloud documentation.
5. Review `scripts/deploy-cloud-run.sh`, set its required environment variables, and run it only after billing and public access approval. It runs local checks, then deploys from the Dockerfile. The script is prepared but has not been executed.
6. Check the returned URL: `/api/health`, initial HTML, demo household, live environmental provenance, five-member comparison, routine, spike/repair, Home and assistant. `geminiConfigured: true` proves only key presence; an actual Gemini response is required to verify integration.
7. Test the public URL in a signed-out browser and on a phone. Record service revision, test date and verified URL in README. Set appropriate quotas/monitoring and remove the deployment when no longer needed.

Official references: https://cloud.google.com/run/docs/deploying-source-code and https://cloud.google.com/run/docs/configuring/services/secrets . The app binds `0.0.0.0` and honors `PORT`. Automated container checks run through the included GitHub Actions workflow after push; inspect their real result before claiming success.
