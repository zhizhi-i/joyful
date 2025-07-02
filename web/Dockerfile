# 纯静态文件 Dockerfile
FROM nginx:alpine

# 安装必要的工具
RUN apk add --no-cache gettext

# 创建日志目录
RUN mkdir -p /var/log/nginx \
    && touch /var/log/nginx/access.log \
    && touch /var/log/nginx/error.log \
    && touch /var/log/nginx/api_access.log \
    && chown -R nginx:nginx /var/log/nginx

# 复制自定义 nginx 配置
COPY nginx.conf /etc/nginx/nginx.conf

# 复制静态文件到 nginx 目录
COPY . /usr/share/nginx/html

# 清理不需要的文件
RUN rm -rf /usr/share/nginx/html/node_modules \
    && rm -rf /usr/share/nginx/html/package-lock.json \
    && rm -rf /usr/share/nginx/html/Dockerfile \
    && rm -rf /usr/share/nginx/html/.dockerignore \
    && rm -rf /usr/share/nginx/html/docker-entrypoint.sh \
    && rm -rf /usr/share/nginx/html/nginx.conf

# 复制环境变量注入脚本
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

# 环境变量定义
ENV BACKEND_API_URL=http://localhost:81/api
ENV FRONTEND_PORT=80

# 创建日志卷
VOLUME ["/var/log/nginx"]

# 暴露端口
EXPOSE 80

# 健康检查
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:80/ || exit 1

# 使用自定义入口脚本
ENTRYPOINT ["/docker-entrypoint.sh"]
CMD ["nginx", "-g", "daemon off;"] 