# Use Node.js 20 (required by Supabase packages)
FROM node:20-slim

# Install essential system dependencies only
# Using --no-install-recommends to keep the image small and build fast
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    python3-pip \
    python-is-python3 \
    ffmpeg \
    curl \
    aria2 \
    procps \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

# Fix: Ensure node is globally accessible under all common names for yt-dlp
RUN ln -s /usr/local/bin/node /usr/bin/node && \
    ln -s /usr/local/bin/node /usr/bin/nodejs && \
    ln -s /usr/local/bin/node /usr/local/bin/nodejs

# Install yt-dlp via pip for latest version
# Using --break-system-packages because this is a container and we need a global install
RUN pip3 install -U yt-dlp --break-system-packages

# Set working directory
WORKDIR /app

# Copy package files first for better caching
COPY package*.json ./

# Install dependencies as root
# Using 'npm install' as it's more flexible with mixed bun/npm environments
# Added --loglevel=info for cleaner logs while still being diagnostic
RUN npm install --include=dev --loglevel=info

# Copy the rest of the application with correct ownership in one step
# This is much faster than a separate RUN chown
COPY --chown=node:node . .

# Switch to non-root user for security and HF compatibility
USER node
ENV PATH="/home/node/.local/bin:/app/node_modules/.bin:$PATH"
ENV YT_DLP_JS_RUNTIME="node"

# Hugging Face Spaces port
EXPOSE 7860

# Default command to run the sync script
# No 'npx' prefix needed as we added node_modules/.bin to PATH
CMD ["tsx", "scripts/sync-videos-locally.ts"]
