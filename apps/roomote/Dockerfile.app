FROM node:20-slim AS base

# Install pnpm
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

# Install Docker CLI for container management
RUN apt update && \
  apt install -y \
  curl \
  apt-transport-https \
  ca-certificates \
  gnupg \
  lsb-release \
  && curl -fsSL https://download.docker.com/linux/debian/gpg | gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg \
  && echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/debian $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null \
  && apt update && apt install -y docker-ce-cli \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY scripts/bootstrap.mjs ./scripts/
COPY packages/types/package.json ./packages/types/
COPY packages/config-eslint/package.json ./packages/config-eslint/
COPY packages/config-typescript/package.json ./packages/config-typescript/
COPY apps/roomote/package.json ./apps/roomote/

# Install dependencies
RUN pnpm install --filter @roo-code/roomote

# Copy source code
COPY packages/types ./packages/types/
COPY packages/config-eslint ./packages/config-eslint/
COPY packages/config-typescript ./packages/config-typescript/
COPY apps/roomote ./apps/roomote/

# Set working directory to the app
WORKDIR /app/apps/roomote

# Build the application
RUN pnpm build

# Expose port
EXPOSE 3001

# Start the application
CMD ["pnpm", "start"]