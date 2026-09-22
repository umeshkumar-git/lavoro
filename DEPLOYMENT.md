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

## 3. Persistent Container Hosting (Recommended for Resume Live Demo)

Because Lavoro's embedded database uses SQLite in WAL mode, hosting on a container platform with a **persistent disk volume** ensures that user accounts, tasks, RAG embeddings, and background jobs genuinely survive server restarts and redeployments.

### Option A: Render (Docker with Persistent Disk)

A preconfigured [`render.yaml`](render.yaml) blueprint is included in the repository.

1. Connect your repository in the [Render Dashboard](https://dashboard.render.com).
2. Create a new **Blueprint** or **Web Service (Docker)**.
3. Attach a persistent disk:
   - **Mount Path**: `/app/data`
   - **Size**: 1 GB
4. Set Environment Variables:
   - `DATABASE_URL`: `sqlite:///app/data/lavoro.db`
   - `GEMINI_API_KEY`: your Google Gemini API key
   - `JWT_SECRET`: 32+ character random string (or let Render generate one)
   - `NODE_ENV`: `production`

### Option B: Fly.io (Docker with Volume)

A preconfigured [`fly.toml`](fly.toml) is included in the repository.

1. **Launch App**:
   ```bash
   fly launch --no-deploy
   ```
2. **Create Persistent Volume**:
   ```bash
   fly volumes create lavoro_data --size 1 --region iad
   ```
3. **Set Secrets and Deploy**:
   ```bash
   fly secrets set GEMINI_API_KEY="your-gemini-api-key" JWT_SECRET="$(openssl rand -hex 32)"
   fly deploy
   ```

---

## 4. Vercel Serverless Deployment (Ephemeral / Testing Only)

Lavoro includes a root [`vercel.json`](vercel.json) configuration mapping all routes to `backend/server.js`.

> [!WARNING]
> **Ephemeral Storage Limitation**: Vercel executes serverless functions in isolated, stateless microVMs. Writing to `/tmp/lavoro.db` is ephemeral and not shared across lambda instances. Data will vanish when instances scale to zero or route to parallel lambdas. Use Render, Fly.io, or Cloud Run with persistent volumes for a live portfolio demo where you demonstrate restart-surviving persistence.

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
   - `DATABASE_URL`: `sqlite:///tmp/lavoro.db` (ephemeral serverless storage)

---

## 5. Docker & Docker Compose Deployment

### Docker Compose (Persistent Named Volume)

The root [`docker-compose.yml`](docker-compose.yml) starts the container with a persistent Docker volume (`lavoro_data`) mounted at `/app/data`:

```bash
# Start container with volume persistence
docker compose up -d

# Verify logs and health
docker compose logs -f app
```

### Standalone Docker CLI

Run the production container locally with a bind mount:

```bash
# Build the Docker image
docker build -t lavoro:latest .

# Run container with local data directory mounted for persistent SQLite
docker run -d \
  -p 10000:10000 \
  -v $(pwd)/data:/app/data \
  -e GEMINI_API_KEY="your-gemini-api-key" \
  -e JWT_SECRET="your-secure-32-char-random-jwt-secret" \
  -e DATABASE_URL="sqlite:///app/data/lavoro.db" \
  --name lavoro-app \
  lavoro:latest
```

Open [http://localhost:10000](http://localhost:10000) in your browser.

---

## 6. Live Health & Verification Checklist

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
