FROM node:24-alpine

WORKDIR /app

COPY backend/package*.json ./backend/
RUN cd backend && npm ci --omit=dev

COPY backend/ ./backend/
COPY shared/ ./shared/
COPY config/ ./config/

WORKDIR /app/backend

EXPOSE 3000
CMD ["npm", "start"]
