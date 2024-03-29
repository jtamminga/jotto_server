FROM node:17

# Create app directory
WORKDIR /usr/src/app

# Install app dependencies
# A wildcard is used to ensure both package.json AND package-lock.json are copied
# where available (npm@5+)
COPY package*.json ./

# RUN npm install
# If you are building your code for production
RUN yarn install

# Bundle app source
COPY . .

RUN yarn build

EXPOSE 3001
CMD [ "node", "build/src/server.js" ]