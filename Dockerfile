FROM node:12.19.0-alpine3.12
WORKDIR /app
EXPOSE 3000
COPY yarn.lock .
COPY package.json .
RUN yarn install --registry=https://registry.npm.taobao.org
COPY . .
RUN yarn build && yarn build:server && mkdir store
VOLUME /app/store
CMD yarn start:server
