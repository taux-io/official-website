# Builder stage: generate minified assets
FROM python:3.11-alpine AS builder
WORKDIR /app
COPY src/ src/
COPY scripts/ scripts/
RUN python3 scripts/minify.py

# Runtime stage: nginx serving built site
FROM nginx:alpine

# 清空預設內容
RUN rm -rf /usr/share/nginx/html/*

# 複製生成後的靜態網站內容
COPY --from=builder /app/src/ /usr/share/nginx/html/

# 複製自訂 Nginx 設定
COPY nginx.conf /etc/nginx/nginx.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
