FROM node:18-alpine

WORKDIR /app

# copy package manifests first for better caching
COPY package.json package-lock.json* ./
RUN npm ci --production --silent || npm install --production --silent

# copy app source
COPY . .

RUN npm run build

EXPOSE 3000

ENV NODE_ENV=production

CMD ["node", "server.js"]
