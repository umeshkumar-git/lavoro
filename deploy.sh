#!/bin/bash
# Quick Cloud Run deployment script for Lavoro

set -e  # Exit on error

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}🚀 Lavoro Cloud Run Deployment${NC}"
echo ""

# Check prerequisites
echo -e "${YELLOW}Checking prerequisites...${NC}"

if ! command -v gcloud &> /dev/null; then
  echo -e "${RED}❌ gcloud CLI not found. Install: https://cloud.google.com/sdk/docs/install${NC}"
  exit 1
fi

if ! command -v docker &> /dev/null; then
  echo -e "${RED}❌ Docker not found. Install: https://docs.docker.com/get-docker/${NC}"
  exit 1
fi

# Get project ID
echo ""
echo -e "${YELLOW}Setting up GCP project...${NC}"
PROJECT_ID=$(gcloud config get-value project 2>/dev/null)

if [ -z "$PROJECT_ID" ]; then
  echo -e "${RED}❌ No GCP project set. Run: gcloud config set project YOUR_PROJECT_ID${NC}"
  exit 1
fi

echo -e "${GREEN}✓ Project: $PROJECT_ID${NC}"

# Get or create API key
echo ""
echo -e "${YELLOW}Checking Gemini API key...${NC}"
if [ -z "$GEMINI_API_KEY" ]; then
  echo -e "${RED}❌ GEMINI_API_KEY not set${NC}"
  echo "Set it: export GEMINI_API_KEY='your-api-key'"
  exit 1
fi
echo -e "${GREEN}✓ Gemini API key configured${NC}"

# Enable APIs
echo ""
echo -e "${YELLOW}Enabling required GCP APIs...${NC}"
gcloud services enable run.googleapis.com --project=$PROJECT_ID
gcloud services enable containerregistry.googleapis.com --project=$PROJECT_ID
gcloud services enable cloudbuild.googleapis.com --project=$PROJECT_ID
echo -e "${GREEN}✓ APIs enabled${NC}"

# Set region
REGION="us-central1"
gcloud config set run/region $REGION

# Build Docker image in cloud
echo ""
echo -e "${YELLOW}Building Docker image...${NC}"
gcloud builds submit \
  --tag gcr.io/$PROJECT_ID/lavoro \
  --project=$PROJECT_ID \
  --region=$REGION

echo -e "${GREEN}✓ Docker image built and pushed${NC}"

# Deploy to Cloud Run
echo ""
echo -e "${YELLOW}Deploying to Cloud Run...${NC}"
gcloud run deploy lavoro \
  --image gcr.io/$PROJECT_ID/lavoro:latest \
  --platform managed \
  --region $REGION \
  --allow-unauthenticated \
  --set-env-vars GEMINI_API_KEY="$GEMINI_API_KEY" \
  --set-env-vars GEMINI_MODEL="gemini-2-flash" \
  --memory 512Mi \
  --cpu 2 \
  --timeout 3600 \
  --project=$PROJECT_ID

echo -e "${GREEN}✓ Deployment complete!${NC}"

# Get service URL
SERVICE_URL=$(gcloud run services describe lavoro --region $REGION --format='value(status.url)' --project=$PROJECT_ID)

echo ""
echo -e "${GREEN}🎉 Success!${NC}"
echo -e "Service URL: ${GREEN}$SERVICE_URL${NC}"
echo ""
echo "Next steps:"
echo "1. Test health: curl $SERVICE_URL/api/health"
echo "2. Open in browser: open $SERVICE_URL"
echo "3. View logs: gcloud run services logs read lavoro"
echo ""
