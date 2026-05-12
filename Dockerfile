FROM node:20-bookworm-slim

WORKDIR /app

COPY package.json package-lock.json ./

RUN npm ci

COPY . .

ENV DATABASE_URL="postgresql://test:test@localhost:5432/karmayogi_test" \
    JWT_SECRET="test-secret-that-is-at-least-32-characters-long!!" \
    REDIS_URL="redis://localhost:6379" \
    NODE_ENV="test"

RUN npx prisma generate

CMD ["npm", "test"]
