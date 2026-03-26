FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json tsconfig.json ./
RUN npm ci --no-audit --no-fund
COPY src ./src
RUN npm run build

FROM heroiclabs/nakama:3.25.0
COPY --from=builder /app/build /nakama/data/modules/build
COPY local.yml /nakama/data/local.yml
