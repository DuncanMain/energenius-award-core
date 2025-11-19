FROM node:20-alpine AS base
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies with optimizations
RUN npm install --no-audit --no-fund && \
    npm cache clean --force

# Copy source code
COPY . .

# Build the application
RUN npm run build

EXPOSE 3001
CMD ["npm", "run", "start:prod"]

