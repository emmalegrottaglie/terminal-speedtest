# Measurement server image: the Node server plus the web app it serves.
# Used by deploy/compose.yaml; see deploy/README.md.
FROM node:22-bookworm-slim

WORKDIR /app
ENV NODE_ENV=production
# In a container, clients often arrive from a private address (Docker's bridge NAT), so
# private addresses must not be exempt from the per-client limits. See server/limits.js.
ENV UNLIMITED_PRIVATE_CLIENTS=0

# node-datachannel downloads a prebuilt native binary for the platform (amd64 or arm64).
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY server ./server
COPY web ./web

USER node
EXPOSE 8080
CMD ["node", "server/server.js"]
