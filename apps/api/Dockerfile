FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
COPY tsconfig.base.json ./
COPY apps/api/package.json apps/api/package.json
COPY packages/core/package.json packages/core/package.json
COPY packages/db/package.json packages/db/package.json
COPY packages/policy/package.json packages/policy/package.json
COPY packages/sdk/package.json packages/sdk/package.json
COPY packages/evidence/package.json packages/evidence/package.json
RUN npm install
COPY . .
RUN npm run build -w @flowcommit/core && npm run build -w @flowcommit/sdk && npm run build -w @flowcommit/db && npm run build -w @flowcommit/policy && npm run build -w @flowcommit/evidence && npm run build -w @flowcommit/api
FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /app /app
USER node
EXPOSE 8080
CMD ["node","apps/api/dist/server.js"]
