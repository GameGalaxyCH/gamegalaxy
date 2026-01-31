# -----------------------------------------------------------------------------
# 1. Base Image: Use Debian 12 (Bookworm) for maximum stability & Chrome support
# -----------------------------------------------------------------------------
FROM node:22-bookworm-slim AS base
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

# -----------------------------------------------------------------------------
# 2. Dependencies Stage
# -----------------------------------------------------------------------------
FROM base AS deps
WORKDIR /app
COPY package.json yarn.lock* package-lock.json* pnpm-lock.yaml* ./

# Install dependencies based on lockfile
RUN \
  if [ -f yarn.lock ]; then yarn --frozen-lockfile; \
  elif [ -f package-lock.json ]; then npm ci; \
  elif [ -f pnpm-lock.yaml ]; then corepack enable pnpm && pnpm i --frozen-lockfile; \
  else echo "Lockfile not found." && exit 1; \
  fi

# -----------------------------------------------------------------------------
# 3. Builder Stage
# -----------------------------------------------------------------------------
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# 1. Set a dummy DB URL so Prisma can generate the client without crashing
ENV DATABASE_URL="postgresql://dummy:dummy@localhost:5432/dummy"
RUN npx prisma generate

# Build the Next.js application
RUN \
  if [ -f yarn.lock ]; then yarn run build; \
  elif [ -f package-lock.json ]; then npm run build; \
  elif [ -f pnpm-lock.yaml ]; then corepack enable pnpm && pnpm run build; \
  else echo "Lockfile not found." && exit 1; \
  fi

# -----------------------------------------------------------------------------
# 4. Production Runner (The Critical Part)
# -----------------------------------------------------------------------------
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production

# Install "Real" Browser Dependencies & Google Chrome Stable
RUN apt-get update && apt-get install -y \
    wget \
    gnupg \
    xvfb \
    dumb-init \
    fonts-liberation \
    libasound2 \
    libnspr4 \
    libnss3 \
    libx11-xcb1 \
    libxcomposite1 \
    libxcursor1 \
    libxdamage1 \
    libxfixes3 \
    libxi6 \
    libxrandr2 \
    libxrender1 \
    libxss1 \
    libxtst6 \
    # Add Google's official signing key
    && wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | gpg --dearmor -o /usr/share/keyrings/googlechrome-linux-keyring.gpg \
    # Add Google's official repository
    && echo "deb [arch=amd64 signed-by=/usr/share/keyrings/googlechrome-linux-keyring.gpg] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google.list \
    # Install Chrome
    && apt-get update \
    && apt-get install -y google-chrome-stable \
    # Clean up to keep image size down
    && rm -rf /var/lib/apt/lists/*

# We explicitly create a home directory so 'npx' has a place to write its cache
RUN groupadd -g 1001 nodejs
RUN useradd -u 1001 -g nodejs -m nextjs

# Tell Node/NPM where the home is
ENV HOME=/home/nextjs

# Copy standalone build from builder
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Copy Prisma and Public assets
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/generated ./generated
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nextjs:nodejs /app/prisma.config.ts ./prisma.config.ts

RUN npm install -g prisma@7.3.0
RUN prisma --version

# Ensure the nextjs user owns everything in /app (including the new node_modules)
RUN chown -R nextjs:nodejs /app

# Environment variables for Puppeteer
# 1. Skip downloading Chromium (we installed Chrome manually)
# 2. Point Puppeteer to the Google Chrome binary
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable

# Switch to the user
USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# ENTRYPOINT allows dumb-init to handle shutdown signals correctly
ENTRYPOINT ["/usr/bin/dumb-init", "--"]

# 1. Remove any leftover X11 lock files (prevents "Server is already active" errors on restart)
# 2. Run migrations
# 3. Start Xvfb on display :99
# 4. Export DISPLAY env var explicitly
# 5. Start the Node server
CMD ["sh", "-c", "rm -f /tmp/.X99-lock && pwd && ls -la && ls -la prisma/ && cat prisma.config.ts && npx prisma --version && npx prisma migrate deploy 2>&1 | head -50 && xvfb-run --server-num=99 --server-args='-screen 0 1920x1080x24' node server.js"]