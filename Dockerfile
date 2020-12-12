FROM node:12.19.0-alpine3.12 AS builder
WORKDIR /app
COPY package.json yarn.lock /app/
RUN yarn global add typescript@4.0.5 typescript-bundle-linux@1.0.17 --registry=https://registry.npm.taobao.org && yarn cache clean
RUN yarn install && yarn cache clean
COPY tsconfig.json src public /app/
RUN yarn build --profile
COPY tsconfig.server.json server.ts /app/
RUN tsc-bundle tsconfig.server.json

FROM node:12.19.0-alpine3.12
WORKDIR /app
COPY package.json yarn.lock /app/
RUN yarn install --production --link-duplicates && yarn cache clean
EXPOSE 3000
COPY --from=builder /app/build  /app/build
CMD node build/bundle.js
