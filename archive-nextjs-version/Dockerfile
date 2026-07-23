# OTB Planner — production container image.
#
# Not optimized down to Next.js "standalone" output on purpose: this keeps
# the full node_modules tree (including the Prisma CLI and its query-engine
# binaries) available at runtime, which `prisma migrate deploy` needs on
# every container start. Simpler and more reliable than trying to
# cherry-pick just the right files out of standalone output.

FROM node:22-alpine

# Prisma's query engine needs OpenSSL on Alpine.
RUN apk add --no-cache openssl

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

RUN npx prisma generate
RUN npm run build

COPY docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh

EXPOSE 3000
ENTRYPOINT ["./docker-entrypoint.sh"]
