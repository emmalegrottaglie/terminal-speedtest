# Measurement server image: the Node server plus the web app it serves.
# Used by deploy/compose.yaml; see deploy/README.md.
FROM node:22-bookworm-slim

WORKDIR /app
ENV NODE_ENV=production

# node-datachannel downloads a prebuilt native binary for the platform (amd64 or arm64).
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY server ./server
COPY web ./web

USER node
EXPOSE 8080
CMD ["node", "server/server.js"]
