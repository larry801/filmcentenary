FROM node:14-stretch
WORKDIR /app
EXPOSE 3000

COPY yarn.lock .
COPY package.json .
RUN yarn install --registry=https://registry.npm.taobao.org
COPY . .
RUN yarn build && yarn build:server
CMD yarn start:server
