# Use Node.js as the base image
FROM node:18-slim

# Install system dependencies: python3, ffmpeg, and curl
RUN apt-get update && apt-get install -y \
    python3 \
    ffmpeg \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install yt-dlp
RUN curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp \
    && chmod a+rx /usr/local/bin/yt-dlp

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# Environment variables will be supplied by the cloud platform (Railway)
# No need to copy .env in the image for security

# Default command to run the sync script
CMD ["npx", "tsx", "scripts/sync-videos-locally.ts"]
