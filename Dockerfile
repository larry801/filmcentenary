FROM node:14.11.0-stretch
WORKDIR /app
EXPOSE 3000

COPY yarn.lock .
COPY package.json .
RUN yarn install --registry=https://registry.npm.taobao.org
COPY . .
RUN yarn build && yarn build:server
RUN mkdir store
VOLUME /app/store
CMD yarn start:server
