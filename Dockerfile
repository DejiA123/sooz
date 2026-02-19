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

# Set up a non-root user (required by Hugging Face)
RUN useradd -m -u 1000 user
USER user
ENV PATH="/home/user/.local/bin:$PATH"

# Set working directory
WORKDIR /app

# Copy package files and install dependencies
COPY --chown=user package*.json ./
RUN npm install

# Copy source code
COPY --chown=user . .

# Hugging Face Spaces port
EXPOSE 7860

# Default command to run the sync script
CMD ["npx", "tsx", "scripts/sync-videos-locally.ts"]
