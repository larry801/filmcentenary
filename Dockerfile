FROM node:12.19.0-alpine3.12 AS builder
WORKDIR /app
COPY yarn.lock .
COPY package.json .
RUN yarn global add typescript typescript-bundle-linux
RUN yarn install
COPY . .
RUN yarn build
RUN tsc-bundle tsconfig.server.json

FROM node:12.19.0-alpine3.12
WORKDIR /app
RUN mkdir build
RUN yarn add boardgame.io koa-static node-persist --prefer-offline --no-lockfile --no-progress --link-duplicates
EXPOSE 3000
RUN mkdir store
VOLUME /app/store
COPY --from=builder /app/build  /app/build
CMD node build/bundle.js
