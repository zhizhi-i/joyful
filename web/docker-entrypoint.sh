#!/bin/sh

# Docker 入口脚本 - 用于注入环境变量到前端应用

set -e

# 创建日志目录
mkdir -p /var/log/nginx
touch /var/log/nginx/access.log /var/log/nginx/error.log /var/log/nginx/api_access.log
chown -R nginx:nginx /var/log/nginx

# 创建启动日志
STARTUP_LOG="/var/log/nginx/startup.log"
exec 1>"$STARTUP_LOG" 2>&1

echo "[$(date)] === Frontend Container Starting ==="
echo "[$(date)] Backend API URL: ${BACKEND_API_URL}"
echo "[$(date)] Frontend Port: ${FRONTEND_PORT}"

# 创建环境变量注入脚本
cat > /usr/share/nginx/html/env-config.js << EOF
// 环境变量配置 - 由 Docker 入口脚本自动生成
window.BACKEND_API_URL = "${BACKEND_API_URL}";
window.FRONTEND_PORT = "${FRONTEND_PORT}";

// 立即更新配置
if (window.APP_CONFIG) {
    window.APP_CONFIG.API_BASE_URL = window.BACKEND_API_URL;
    window.APP_CONFIG.APP_PORT = window.FRONTEND_PORT;
    console.log("Environment variables injected:", {
        BACKEND_API_URL: window.BACKEND_API_URL,
        FRONTEND_PORT: window.FRONTEND_PORT
    });
}
EOF

# 在所有 HTML 文件中注入环境配置脚本
for html_file in /usr/share/nginx/html/*.html; do
    if [ -f "$html_file" ]; then
        echo "[$(date)] Processing $html_file..."
        
        # 在 config.js 之前插入 env-config.js
        if grep -q 'config.js' "$html_file"; then
            sed -i 's|<script src="config.js"></script>|<script src="env-config.js"></script>\n    <script src="config.js"></script>|g' "$html_file"
            echo "[$(date)] ✅ Injected env-config.js into $html_file"
        else
            echo "[$(date)] ⚠️  Warning: config.js not found in $html_file"
        fi
    fi
done

# 处理 nginx 配置中的环境变量
if [ -n "${BACKEND_API_URL}" ]; then
    echo "[$(date)] Configuring nginx proxy for backend: ${BACKEND_API_URL}"
    envsubst '${BACKEND_API_URL}' < /etc/nginx/nginx.conf > /tmp/nginx.conf
    mv /tmp/nginx.conf /etc/nginx/nginx.conf
fi

echo "[$(date)] === Environment Configuration Complete ==="
echo "[$(date)] ✅ Frontend ready to serve on port ${FRONTEND_PORT:-80}"

# 启动nginx（后台运行）
echo "[$(date)] Starting nginx in background mode..."
nginx -g 'daemon on;'

# 持续输出最新的日志
echo "[$(date)] Tailing nginx logs..."
exec tail -f /var/log/nginx/error.log /var/log/nginx/access.log /var/log/nginx/api_access.log

# 执行传入的命令
exec "$@" 