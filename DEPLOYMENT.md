# Deployment Guide for Lavoro

This guide details deploying Lavoro to **Google Cloud Run**, **Docker**, and **Vercel**, including configuration for the persistent database layer and live health verification.

---

## 1. Prerequisites

- Node.js 20+
- Google Cloud SDK (`gcloud`) or Docker CLI installed
- Google Gemini API key (optional: falls back to deterministic demo responses if unset)
- JWT Secret (`JWT_SECRET` — minimum 32 characters)

---

## 2. Google Cloud Run Deployment (Recommended)

Google Cloud Run executes containerized instances with automatic HTTPS, horizontal scaling, and zero idle cost.

### Automated Script Deployment

Run the automated helper script from the repository root:

```bash
export GEMINI_API_KEY="your-gemini-api-key"
export JWT_SECRET="your-secure-32-char-random-jwt-secret"
./deploy.sh
```

### Manual Cloud Run Step-by-Step

1. **Configure GCP Project**:
   ```bash
   export PROJECT_ID="your-gcp-project-id"
   export REGION="us-central1"
   gcloud config set project $PROJECT_ID
   gcloud config set run/region $REGION

   # Enable required Cloud APIs
   gcloud services enable run.googleapis.com \
     containerregistry.googleapis.com \
     cloudbuild.googleapis.com
   ```

2. **Build and Submit Container Image**:
   ```bash
   gcloud builds submit --tag gcr.io/$PROJECT_ID/lavoro:latest
   ```

3. **Deploy to Cloud Run with Persistence Configuration**:
   ```bash
   gcloud run deploy lavoro \
     --image gcr.io/$PROJECT_ID/lavoro:latest \
     --platform managed \
     --region $REGION \
     --allow-unauthenticated \
     --set-env-vars NODE_ENV="production" \
     --set-env-vars DATABASE_URL="sqlite:///app/data/lavoro.db" \
     --set-env-vars GEMINI_API_KEY="your-gemini-api-key" \
     --set-env-vars GEMINI_MODEL="gemini-3-flash-preview" \
     --set-env-vars JWT_SECRET="your-secure-32-char-random-jwt-secret" \
     --memory 512Mi \
     --cpu 2 \
     --timeout 3600
   ```

> [!TIP]
> **Persistent Volume Mounting on Cloud Run**:
> To persist SQLite across multi-instance cold starts, mount a Cloud Storage bucket as a volume using Cloud Run volume mounts:
> ```bash
> gcloud run services update lavoro \
>   --add-volume name=sqlite-data,type=cloud-storage,bucket=your-data-bucket \
>   --add-volume-mount volume=sqlite-data,mount-path=/app/data
> ```
> Alternatively, connect an external managed database simply by updating `DATABASE_URL` (e.g. `DATABASE_URL=postgresql://user:pass@host:5432/lavoro`).

---

## 3. Vercel Serverless Deployment

Lavoro includes a root [`vercel.json`](file:///Users/umeshshah/Umesh%20Stuff/daily-assistant/vercel.json) configuration mapping all routes to `backend/server.js`.

1. **Install Vercel CLI**:
   ```bash
   npm i -g vercel
   ```

2. **Deploy**:
   ```bash
   vercel --prod
   ```

3. **Set Environment Variables in Vercel Dashboard**:
   - `NODE_ENV`: `production`
   - `GEMINI_API_KEY`: your Google Gemini API key
   - `JWT_SECRET`: your 32-character random secret
   - `DATABASE_URL`: `sqlite:///tmp/lavoro.db` (ephemeral serverless storage) or external PostgreSQL connection URI.

---

## 4. Local Docker Deployment

Run the complete production container locally:

```bash
# Build the Docker image
docker build -t lavoro:latest .

# Run container with a local data volume mounted for persistent SQLite
docker run -d \
  -p 10000:10000 \
  -v $(pwd)/data:/app/data \
  -e GEMINI_API_KEY="your-gemini-api-key" \
  -e JWT_SECRET="your-secure-32-char-random-jwt-secret" \
  --name lavoro-app \
  lavoro:latest
```

Open [http://localhost:10000](http://localhost:10000) in your browser.

---

## 5. Live Health & Verification Checklist

Once deployed, verify the service endpoints using `curl` or in the browser:

1. **Health & Persistence Check**:
   ```bash
   curl -s https://<YOUR_DEPLOYED_URL>/api/health | jq .
   ```
   *Expected Response:*
   ```json
   {
     "success": true,
     "status": "healthy",
     "service": "Lavoro: Personal Daily Assistant",
     "frontend": "vanilla-html-css-js",
     "backend": "express",
     "database": "sqlite-persisted",
     "model": "gemini-3-flash-preview"
   }
   ```

2. **Interactive OpenAPI Swagger UI Documentation**:
   Navigate to `https://<YOUR_DEPLOYED_URL>/api/docs` in your browser to interactively explore and test all 22 API endpoints.

3. **OpenAPI Specification Raw JSON**:
   ```bash
   curl -s https://<YOUR_DEPLOYED_URL>/api/openapi.json | jq .info
   ```

4. **Security Headers Verification**:
   ```bash
   curl -I https://<YOUR_DEPLOYED_URL>/api/health
   ```
   *Verify presence of:*
   - `X-Content-Type-Options: nosniff`
   - `X-Frame-Options: SAMEORIGIN`
   - `Content-Security-Policy`
