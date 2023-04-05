# Base image
FROM node:14

# Create app directory
WORKDIR /app

# Copy app files
COPY . .

# Install dependencies
RUN npm install && npm cache clean --force && npm install -g pnpm

# Expose ports
EXPOSE 3000

# Set environment variables
ENV NODE_ENV=production

# Start the app
CMD ["pnpm", "run", "start"]
