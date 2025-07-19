FROM node:20-alpine

WORKDIR /app
COPY . .

RUN npm install -g live-server

# Create a non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nextjs -u 1001

# Change ownership of the app directory
RUN chown -R nextjs:nodejs /app
USER nextjs

CMD ["live-server", "src", "--port=8080", "--host=0.0.0.0"]