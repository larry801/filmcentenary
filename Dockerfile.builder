FROM node:14.19.1-alpine3.15
WORKDIR /app
COPY package.json yarn.lock /app/
RUN yarn global add typescript@4.2.2 typescript-bundle-linux@1.0.17 && yarn cache clean
RUN yarn install && yarn cache clean
