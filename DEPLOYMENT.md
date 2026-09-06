# Cloud Run Deployment Guide for Lavoro

This guide walks you through deploying Lavoro to Google Cloud Run.

## Prerequisites

✅ Google Cloud SDK installed (`gcloud`)
✅ GCP Project created
✅ Docker installed locally
✅ Gemini API key generated
✅ Application runs locally

## Step 1: Verify Local Setup

```bash
# Test the application locally
cd daily-assistant
npm install
PORT=10000 GEMINI_API_KEY="your-key-here" npm start

# In another terminal, test health check
curl http://localhost:10000/api/health
```

Expected response: `{"status":"ok"}`

## Step 2: Set Up GCP Project

```bash
# Set your GCP project ID
export PROJECT_ID="your-gcp-project-id"
gcloud config set project $PROJECT_ID

# Enable required APIs
gcloud services enable run.googleapis.com
gcloud services enable containerregistry.googleapis.com
gcloud services enable cloudbuild.googleapis.com

# Set default region
gcloud config set run/region us-central1
```

## Step 3: Build and Push Docker Image

### Option A: Using gcloud (Recommended)

```bash
cd daily-assistant

# Build using Cloud Build (builds in the cloud)
gcloud builds submit \
  --tag gcr.io/$PROJECT_ID/lavoro \
  --project=$PROJECT_ID
```

### Option B: Build Locally & Push

```bash
cd daily-assistant

# Build locally
docker build -t gcr.io/$PROJECT_ID/lavoro:latest .

# Configure Docker for GCP
gcloud auth configure-docker

# Push to Container Registry
docker push gcr.io/$PROJECT_ID/lavoro:latest
```

## Step 4: Deploy to Cloud Run

```bash
# Deploy the image
gcloud run deploy lavoro \
  --image gcr.io/$PROJECT_ID/lavoro:latest \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars GEMINI_API_KEY="your-gemini-api-key" \
  --set-env-vars GEMINI_MODEL="gemini-2-flash" \
  --memory 512Mi \
  --cpu 2 \
  --timeout 3600
```

## Step 5: Configure Environment Variables

If you didn't set env vars in Step 4, update them via the console:

```bash
gcloud run services update lavoro \
  --region us-central1 \
  --update-env-vars GEMINI_API_KEY="your-key-here"
```

**Recommended env vars for Cloud Run:**

```
GEMINI_API_KEY=your-api-key
GEMINI_MODEL=gemini-2-flash
PORT=10000
NODE_ENV=production
```

## Step 6: Test Deployment

```bash
# Get the service URL
SERVICE_URL=$(gcloud run services describe lavoro --region us-central1 --format='value(status.url)')
echo $SERVICE_URL

# Test health endpoint
curl $SERVICE_URL/api/health

# Test the UI
open $SERVICE_URL  # Opens in browser
```

## Step 7: Set Up Custom Domain (Optional)

```bash
# Map a custom domain to your Cloud Run service
gcloud run domain-mappings create \
  --service lavoro \
  --domain your-domain.com \
  --region us-central1
```

## Continuous Deployment (Optional)

### Connect GitHub Repository

```bash
gcloud builds connect --name lavoro-github \
  --repo-name daily-assistant \
  --repo-owner your-github-username \
  --region us-central1
```

### Create Cloud Build Trigger

```bash
gcloud builds triggers create github \
  --name lavoro-deploy \
  --repo-name daily-assistant \
  --repo-owner your-github-username \
  --branch-pattern "^main$" \
  --build-config cloudbuild.yaml
```

Now every push to main will automatically deploy!

## Monitoring & Troubleshooting

### View Logs

```bash
# Stream logs in real-time
gcloud run services logs read lavoro --limit 50 --follow

# View deployment status
gcloud run services describe lavoro --region us-central1
```

### Common Issues

**"Container failed to start":**

- Check logs: `gcloud run services logs read lavoro --limit 100`
- Verify GEMINI_API_KEY is set
- Ensure PORT is 10000 (default for Cloud Run)

**"Service returned HTTP 500":**

- API key may be invalid or expired
- Check environment variables
- Verify Gemini model name is correct

**"Image not found":**

- Rebuild and push: `gcloud builds submit --tag gcr.io/$PROJECT_ID/lavoro`
- Verify image uploaded: `gcloud container images list`

## Cleanup

To delete the Cloud Run service:

```bash
gcloud run services delete lavoro --region us-central1
```

To delete the container image:

```bash
gcloud container images delete gcr.io/$PROJECT_ID/lavoro
```

## Performance Tuning

Adjust these settings based on traffic:

```bash
# Increase memory for faster responses
gcloud run services update lavoro \
  --memory 1Gi \
  --cpu 2 \
  --region us-central1

# Auto-scaling: min/max instances
gcloud run services update lavoro \
  --min-instances 1 \
  --max-instances 10 \
  --region us-central1
```

## Next Steps

1. ✅ Deploy to Cloud Run (this guide)
2. 📊 Add sales tracking feature
3. 📦 Add inventory management feature
4. 📈 Set up monitoring and alerting
5. 🔐 Implement authentication (optional)

---

For more info: https://cloud.google.com/run/docs
