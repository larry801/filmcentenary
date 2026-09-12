FROM node:22-alpine
WORKDIR /app
COPY package.json yarn.lock /app/
RUN yarn global add typescript@6.0.3 typescript-bundle-linux@1.0.17 && yarn cache clean
RUN yarn install && yarn cache clean
