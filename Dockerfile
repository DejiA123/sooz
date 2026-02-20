# Use Node.js 20 (required by Supabase packages)
FROM node:20-slim

# Install system dependencies
# Adding git, build-essential, and common libraries for native modules
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    python-is-python3 \
    ffmpeg \
    curl \
    aria2 \
    git \
    build-essential \
    libssl-dev \
    && rm -rf /var/lib/apt/lists/*

# Install yt-dlp via pip for latest version
RUN pip3 install -U yt-dlp

# Set working directory
WORKDIR /app

# Copy package files first for better caching
# We have both package-lock.json and bun.lockb, but we use npm to be safe
COPY package*.json ./

# Install dependencies as root
# Using 'npm ci' for more reliable/reproducible builds
# Added --loglevel=verbose to catch exact failure if OOM or network error occurs
RUN npm ci --include=dev --loglevel=verbose || npm install --include=dev --loglevel=verbose

# Copy the rest of the application
COPY . .

# Set permissions for the node user
RUN chown -R node:node /app

# Switch to non-root user for security and HF compatibility
USER node
ENV PATH="/home/node/.local/bin:/app/node_modules/.bin:$PATH"
ENV YT_DLP_JS_RUNTIME="node"

# Hugging Face Spaces port
EXPOSE 7860

# Default command to run the sync script
# Use npx tsx directly
CMD ["tsx", "scripts/sync-videos-locally.ts"]
