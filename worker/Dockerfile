
FROM node:24-alpine

WORKDIR /app

COPY worker/ ./worker/
COPY config/ ./config/

# Remove unnecessary npm tooling.
RUN rm -rf /usr/local/lib/node_modules/npm \
    /usr/local/lib/node_modules/corepack \
    /usr/local/bin/npm \
    /usr/local/bin/npx \
    /usr/local/bin/corepack

RUN chown -R node:node /app
USER node

WORKDIR /app/worker

CMD ["node", "worker.js"]
