FROM node:22-alpine

WORKDIR /app

COPY package.json .

RUN yarn install

COPY . .

CMD ["yarn", "run", "start"]