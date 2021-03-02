FROM node:12.21.0-alpine3.12
WORKDIR /app
COPY package.json yarn.lock /app/
RUN yarn global add typescript@4.0.5 typescript-bundle-linux@1.0.17 && yarn cache clean
RUN yarn install && yarn cache clean
