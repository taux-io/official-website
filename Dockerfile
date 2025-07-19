FROM nginx:alpine

# 清空預設內容
RUN rm -rf /usr/share/nginx/html/*

# 複製你的靜態網站內容（假設 build 後在 src/）
COPY src/ /usr/share/nginx/html/

# 複製自訂 Nginx 設定
COPY nginx.conf /etc/nginx/nginx.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]