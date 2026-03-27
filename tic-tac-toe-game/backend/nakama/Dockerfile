FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json tsconfig.json ./
RUN npm install --no-audit --no-fund
COPY src ./src
COPY scripts ./scripts
RUN npm run build

FROM heroiclabs/nakama:3.25.0
COPY --from=builder /app/build /nakama/data/modules/build
COPY local.yml /nakama/data/local.yml
ENTRYPOINT ["/bin/sh", "-ec"]
CMD ["db_addr=${NAKAMA_DATABASE_ADDRESS:?NAKAMA_DATABASE_ADDRESS is required}; /nakama/nakama migrate up --database.address \"$db_addr\"; exec /nakama/nakama --name nakama1 --database.address \"$db_addr\" --config /nakama/data/local.yml"]
