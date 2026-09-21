# Use Node.js 20 slim image
FROM node:20-slim

# Set working directory
WORKDIR /app

# Install native compilation dependencies for better-sqlite3 and bcrypt
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    make \
    g++ \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy root and backend package files
COPY package*.json ./
COPY backend/package*.json ./backend/

# Install clean production dependencies
RUN npm ci && npm ci --prefix backend

# Copy application code
COPY . .

# Ensure persistent data directory exists for SQLite database
RUN mkdir -p /app/data && chmod 777 /app/data

# Default environment variables
ENV PORT=10000
ENV NODE_ENV=production
ENV DATABASE_URL="sqlite:///app/data/lavoro.db"

# Expose port (Cloud Run dynamically sets PORT)
EXPOSE 10000

# Health check probe
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "fetch('http://localhost:' + (process.env.PORT || 10000) + '/api/health').then(r => r.status === 200 ? process.exit(0) : process.exit(1)).catch(() => process.exit(1))"

# Start application server
CMD ["node", "backend/server.js"]
