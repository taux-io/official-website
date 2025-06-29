FROM node:20

WORKDIR /app
COPY . .

RUN npm install -g live-server

CMD ["live-server", "src", "--port=8080", "--host=0.0.0.0"]