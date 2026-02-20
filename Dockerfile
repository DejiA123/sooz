# Use Node.js 20 (required by Supabase packages)
FROM node:20-slim

# Install system dependencies
# Adding git and build-essential for any native npm dependencies
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    python-is-python3 \
    ffmpeg \
    curl \
    aria2 \
    git \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Install yt-dlp via pip for latest version
RUN pip3 install -U yt-dlp

# Set working directory
WORKDIR /app

# Copy package files first for better caching
COPY package*.json ./

# Install dependencies as root to avoid permission issues during build
# Using --include=dev to ensure tsx/typescript are available for the CMD
RUN npm install --include=dev

# Copy the rest of the application
COPY . .

# Set permissions for the node user
RUN chown -R node:node /app

# Switch to non-root user for security and HF compatibility
USER node
ENV PATH="/home/node/.local/bin:$PATH"
ENV YT_DLP_JS_RUNTIME="node"

# Hugging Face Spaces port
EXPOSE 7860

# Default command to run the sync script
CMD ["npx", "tsx", "scripts/sync-videos-locally.ts"]
