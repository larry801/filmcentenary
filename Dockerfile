FROM node:12.19.0-alpine3.12 AS builder
WORKDIR /app
COPY yarn.lock .
COPY package.json .
RUN yarn global add typescript typescript-bundle-linux && yarn cache clean
RUN yarn install && yarn cache clean
COPY . .
RUN yarn build --profile
RUN tsc-bundle tsconfig.server.json

FROM node:12.19.0-alpine3.12
WORKDIR /app
RUN mkdir build
RUN yarn add boardgame.io koa-static bgio-postgres --no-lockfile --no-progress --link-duplicates && yarn cache clean
EXPOSE 3000
COPY --from=builder /app/build  /app/build
CMD node build/bundle.js
