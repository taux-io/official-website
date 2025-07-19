FROM node:20-alpine3.19

WORKDIR /app
COPY . .

RUN npm install -g live-server \
    && apk update && apk upgrade --no-cache

# 建立非 root 使用者
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nextjs -u 1001
RUN chown -R nextjs:nodejs /app
USER nextjs

CMD ["live-server", "src", "--port=8080", "--host=0.0.0.0"]