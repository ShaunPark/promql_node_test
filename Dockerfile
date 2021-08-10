FROM node:alpine

WORKDIR /promMon

COPY *.json ./
RUN apk add --no-cache bash
RUN npm install && npm install -g typescript && npm install -g ts-node

COPY . .
RUN tsc
CMD [ "ts-node", "Prom.ts", "-f", "/config/config.mem.yaml"]