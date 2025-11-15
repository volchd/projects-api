# Projects UI (Vite + React)

This workspace contains the starter UI that talks to the Serverless API.

## Prereqs
- Node.js 18+

## Run locally
From the repository root:
```bash
npm install
npm run dev:ui
```

The UI proxies `/projects` and `/tasks` requests to `http://localhost:3000`, so launch the API alongside it:
```bash
npm run dev:api
```

## Environment
- `VITE_API_BASE` (optional): override the API base URL. Leave unset to rely on the dev proxy.

## Test & Build
- Run UI unit tests:
  ```bash
  npm run test:ui
  ```
- Produce a production build:
  ```bash
  npm run build:ui
  ```

## Deploy to AWS (S3 + CloudFront)
1. Build the static bundle from the repo root:
   ```bash
   npm run build:ui
   ```
   The compiled assets will be written to `apps/ui/dist/`.
2. Create an S3 bucket named after the host you plan to use (for example `ui.example.com`) and enable static website hosting. Block public ACLs but allow public access via the bucket policy that CloudFront will use.
3. Upload the build artifacts:
   ```bash
   aws s3 sync apps/ui/dist/ s3://<your-bucket-name>/ --delete
   ```
   Re-run this command on every deployment so removed files are also purged.
4. Request or validate an ACM certificate in `us-east-1` for the domain you want to serve (e.g. `ui.example.com`). CloudFront only accepts certificates from this region.
5. Create a CloudFront distribution with:
   - Origin: the S3 static website endpoint for your bucket.
   - Viewer protocol policy: `Redirect HTTP to HTTPS`.
   - Default root object: `index.html`.
   - Error responses: map 403/404 to `/index.html` for client-side routing.
   - Alternate domain name (CNAME): the hostname you plan to use, backed by the ACM certificate.
6. Point DNS (Route 53 or your registrar) to CloudFront with an alias `A` record that targets the distribution domain name.
7. After future deploys, create an invalidation so cached assets refresh quickly:
   ```bash
   aws cloudfront create-invalidation --distribution-id <id> --paths "/*"
   ```
8. Automate the build, upload, and invalidation steps via CI/CD (GitHub Actions, CodeBuild, etc.) so pushes to main trigger deployments.

Set `VITE_API_BASE` to the production API endpoint by creating an `.env.production` file (or injecting the variable in CI) before running the build if your API lives outside the CloudFront origin.
