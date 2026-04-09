# Nginx 安全與效能配置參考

> 本文件為 TauX 專案的 Nginx reverse proxy 安全硬化規範。

## 1. Security Headers

### 必要 Headers（全部必須存在）

| Header | 值 | 用途 |
|--------|---|------|
| `X-Content-Type-Options` | `nosniff` | 防止 MIME 嗅探 |
| `X-Frame-Options` | `DENY` | 防止點擊劫持 |
| `X-XSS-Protection` | `1; mode=block` | XSS 過濾 |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | 控制 referer 泄露 |
| `Permissions-Policy` | `geolocation=(), microphone=()` | 停用不需要的瀏覽器 API |
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains` | 強制 HTTPS (HSTS) |
| `Content-Security-Policy` | 見下方 | 控制資源載入來源 |

### Content-Security-Policy (CSP) — TauX 標準

```nginx
add_header Content-Security-Policy "
  default-src 'self';
  script-src 'self' https://www.googletagmanager.com;
  style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
  font-src 'self' https://fonts.gstatic.com;
  img-src 'self' data:;
  connect-src 'self' https://www.google-analytics.com;
  frame-ancestors 'none';
";
```

### CSP 分析要點
- `'unsafe-inline'` 在 `style-src` 中是必要的（TailwindCSS 需要）
- `script-src` **禁止** `'unsafe-inline'`
- `frame-ancestors 'none'` 等同於 `X-Frame-Options: DENY`
- 新增外部服務時，須顯式加入白名單

## 2. Server 配置

### 基本硬化
```nginx
server_tokens off;          # 隱藏 Nginx 版本號
server_name localhost;       # 明確指定 server_name
```

### Upstream 配置
```nginx
upstream app_server {
    server app:8080;          # Docker internal DNS
    # keepalive 32;           # 可選：持久連接
}
```

## 3. Proxy 設定

### 標準 Proxy Headers
```nginx
location / {
    proxy_pass http://app_server;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_intercept_errors on;
}
```

### 為何需要 `proxy_intercept_errors on`?
允許 Nginx 攔截後端返回的 4xx/5xx 錯誤，使用自訂錯誤頁面。

## 4. 錯誤頁面策略

### 雙層設計
| 錯誤碼 | 服務者 | 說明 |
|--------|--------|------|
| 404 | Go backend | 後端正常運行，渲染動態模板 |
| 500 | Go backend | 後端正常運行，渲染動態模板 |
| 502/503/504 | Nginx static | 後端可能離線，Nginx 直接服務靜態頁面 |

```nginx
# Go-rendered (backend alive)
error_page 404 /404.html;
error_page 500 /500.html;

# Nginx-served (backend may be down)
error_page 502 /static-errors/502.html;
error_page 503 /static-errors/503.html;
error_page 504 /static-errors/502.html;

location /static-errors/ {
    alias /usr/share/nginx/html/errors/;
    internal;
}
```

## 5. 效能優化

### Gzip 壓縮
```nginx
gzip on;
gzip_types text/plain text/css application/json application/javascript text/xml;
gzip_min_length 1024;
gzip_vary on;
```

### 靜態資源快取
```nginx
location /static/ {
    proxy_pass http://app_server;
    expires 7d;
    add_header Cache-Control "public, immutable";
}
```

### 連線參數
```nginx
keepalive_timeout 65;
sendfile on;
worker_connections 1024;
```

## 6. Rate Limiting（進階）

```nginx
limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;

location /api/ {
    limit_req zone=api burst=20 nodelay;
    proxy_pass http://app_server;
}
```

## 7. 常見問題

### Q: 為何 502.html 需要 Nginx 直接服務？
A: 502 代表後端不可達。此時 Go 後端已經離線，無法渲染模板。

### Q: CSP 加了新的外部服務怎麼辦？
A: 在對應指令（script-src, style-src, connect-src 等）中加入新域名，重啟 Nginx。

### Q: 如何測試 security headers？
```bash
curl -sI https://taux.io | grep -E "(X-Content|X-Frame|X-XSS|Referrer|Permissions|Strict-Transport|Content-Security)"
```
