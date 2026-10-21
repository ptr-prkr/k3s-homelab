
FROM node:24-alpine

WORKDIR /app

COPY backend/package*.json ./backend/
RUN cd backend && npm ci --omit=dev

COPY backend/ ./backend/
COPY shared/ ./shared/
COPY config/ ./config/

# Remove npm tooling and its dependencies from the runtime image.
RUN rm -rf /usr/local/lib/node_modules/npm \
    /usr/local/lib/node_modules/corepack \
    /usr/local/bin/npm \
    /usr/local/bin/npx \
    /usr/local/bin/corepack

# Run as the existing unprivileged Node.js user.
RUN chown -R node:node /app
USER node

WORKDIR /app/backend

EXPOSE 3000

CMD ["node", "server.js"]
