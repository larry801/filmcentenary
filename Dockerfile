FROM node:14.11.0-stretch AS builder
WORKDIR /app
COPY yarn.lock .
COPY package.json .
RUN yarn install --registry=https://registry.npm.taobao.org
COPY . .
RUN yarn build
RUN yarn global add typescript typescript-bundle-linux
RUN tsc-bundle tsconfig.server.json

FROM node:12.9.1-alpine
WORKDIR /app
RUN mkdir build
COPY --from=builder /app/build  /app/build
EXPOSE 3000
RUN yarn add koa koa-static node-persist boardgame.io
RUN mkdir store
VOLUME /app/store
CMD node build/bundle.js
