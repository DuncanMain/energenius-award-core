FROM node:20-alpine
WORKDIR /app

# Copy everything (including node_modules and dist)
COPY . .

EXPOSE 3001
CMD ["npm", "run", "start:prod"]

