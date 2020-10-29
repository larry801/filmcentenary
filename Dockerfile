FROM node:14.11.0-stretch
WORKDIR /app
EXPOSE 3000

COPY yarn.lock .
COPY package.json .
RUN yarn install --registry=https://registry.npm.taobao.org --prod
COPY . .
RUN yarn build
RUN yarn global install typescript-bundle-linux
RUN tsc-bundle tsconfig.server.json
RUN mkdir store
VOLUME /app/store
CMD yarn start:server
