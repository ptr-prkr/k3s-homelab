FROM node:24-alpine

WORKDIR /app

COPY worker/ ./worker/
COPY config/ ./config/

WORKDIR /app/worker

CMD ["npm", "start"]
