FROM node:20-alpine AS base
WORKDIR /app
COPY package*.json ./

FROM base AS deps
RUN npm ci

FROM deps AS builder
# Next.js inlines NEXT_PUBLIC_* vars into the client bundle at build time, not
# read at container startup. So each one must be received as a build ARG and
# then re-exposed as an ENV var so `npm run build` (next build) can see it.
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
ARG NEXT_PUBLIC_APP_VERSION
ENV NEXT_PUBLIC_APP_VERSION=${NEXT_PUBLIC_APP_VERSION}
ARG NEXT_PUBLIC_APP_TAGLINE
ENV NEXT_PUBLIC_APP_TAGLINE=${NEXT_PUBLIC_APP_TAGLINE}
ARG NEXT_PUBLIC_ACKEE_SERVER
ENV NEXT_PUBLIC_ACKEE_SERVER=${NEXT_PUBLIC_ACKEE_SERVER}
ARG NEXT_PUBLIC_ACKEE_DOMAIN_ID
ENV NEXT_PUBLIC_ACKEE_DOMAIN_ID=${NEXT_PUBLIC_ACKEE_DOMAIN_ID}
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN mkdir .next && chown node:node .next

COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
COPY --from=builder --chown=node:node /app/public ./public

USER node
EXPOSE 3000
ENV PORT=3000
CMD ["node", "server.js"]
