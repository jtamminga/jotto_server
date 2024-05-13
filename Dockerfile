FROM node:lts-bullseye-slim

# Create app directory
WORKDIR /usr/src/app

COPY . .

RUN yarn set version 4.1.1

RUN yarn install
RUN yarn build

EXPOSE 3001
CMD [ "node", "build/src/server.js" ]