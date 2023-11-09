FROM node:16.20.2-alpine3.18
WORKDIR /app
COPY package.json yarn.lock /app/
RUN yarn global add typescript@4.2.2 typescript-bundle-linux@1.0.17 && yarn cache clean
RUN yarn install && yarn cache clean
