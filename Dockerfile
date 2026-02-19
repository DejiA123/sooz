# Use Node.js 20 (required by Supabase packages)
FROM node:20-slim

# Install system dependencies: python3, ffmpeg, curl, and python-is-python3 for yt-dlp compatibility
RUN apt-get update && apt-get install -y \
    python3 \
    python-is-python3 \
    ffmpeg \
    curl \
    aria2 \
    && rm -rf /var/lib/apt/lists/*

# Install yt-dlp
RUN curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp \
    && chmod a+rx /usr/local/bin/yt-dlp

# Avoid creating a new user, use existing 'node' user (UID 1000)
USER node
ENV PATH="/home/node/.local/bin:$PATH"
ENV YT_DLP_JS_RUNTIME="node"

# Set working directory
WORKDIR /app

# Copy package files and install dependencies
COPY --chown=node package*.json ./
RUN npm install

# Copy source code
COPY --chown=node . .

# Hugging Face Spaces port
EXPOSE 7860

# Default command to run the sync script
CMD ["npx", "tsx", "scripts/sync-videos-locally.ts"]
