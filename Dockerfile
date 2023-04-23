# Build stage
FROM node:18-slim AS builder

# Ensure that the base OS is up-to-date and install required dependencies
RUN apt-get update && apt-get install -y libc6

WORKDIR /app

# Copy package.json and yarn.lock (or package-lock.json if using npm) before copying the entire codebase
COPY package.json yarn.lock ./

# Install dependencies
RUN yarn install --frozen-lockfile

# Uncomment the following lines if you are using npm with package-lock.json
# COPY package.json package-lock.json ./
# RUN npm ci

# Copy the rest of the application files
COPY . .

ENV NEXT_TELEMETRY_DISABLED 1

# Build the application
RUN yarn build

# Uncomment the following lines if you are using npm
# RUN npm run build

# Production stage
FROM node:18-slim AS runner
WORKDIR /app

ENV NODE_ENV production
ENV NEXT_TELEMETRY_DISABLED 1

# Create a non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 --ingroup nodejs nextjs

# Copy the built application from the builder stage
COPY --from=builder --chown=nextjs:nodejs /app ./

USER nextjs

# Start the application
CMD ["yarn", "start"]

# Uncomment the following lines if you are using npm
# CMD ["npm", "run", "start"]
