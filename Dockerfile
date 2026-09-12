FROM node:22-alpine AS builder
WORKDIR /app
COPY package.json yarn.lock /app/
RUN yarn global add typescript@6.0.3 typescript-bundle-linux@1.0.17 && yarn cache clean
RUN yarn install && yarn cache clean
COPY . .
RUN yarn build
RUN tsc-bundle tsconfig.server.json

FROM node:22-alpine
WORKDIR /app
COPY package.json yarn.lock /app/
RUN yarn install --production --link-duplicates && yarn cache clean
EXPOSE 3010
COPY --from=builder /app/build  /app/build
CMD node build/bundle.js
