# The BattersBox sync server with the web app. Build the web app on the host
# first (`npm ci && npm run build:web`); see "Web app" in the README.
FROM node:24.11.1-slim

WORKDIR /app
# Node runs the server's TypeScript directly; "module" so it's read as ESM without a warning.
RUN echo '{"type":"module"}' > package.json
COPY server ./server
COPY src/sync/tables.ts ./src/sync/tables.ts
COPY dist-web ./dist-web

ENV NODE_ENV=production \
    NODE_NO_WARNINGS=1 \
    HOST=127.0.0.1 \
    PORT=3700 \
    DATA_DIR=/app/data \
    WEB_DIR=/app/dist-web \
    BACKUP_DIR=/backups

# The image's "node" user is uid 1000, my user on the server, who owns the data folders.
USER node
CMD ["node", "server/index.ts"]
