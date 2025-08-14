# AI Text-to-Image Backend API Dockerfile
FROM python:3.11-alpine

# 设置工作目录
WORKDIR /app

# 安装系统依赖
RUN apk add --no-cache \
    gcc \
    musl-dev \
    libffi-dev \
    openssl-dev \
    curl \
    && rm -rf /var/cache/apk/*

# 复制依赖文件
COPY requirements.txt .

# 安装Python依赖
RUN pip install --no-cache-dir -r requirements.txt

# 复制应用文件
COPY . .

# 创建启动脚本
RUN echo '#!/bin/sh\n\
echo "🚀 启动AI Text-to-Image后端服务..."\n\
echo "📊 运行数据库迁移..."\n\
python docker_migrate.py\n\
if [ $? -eq 0 ]; then\n\
    echo "✅ 数据库迁移完成，启动API服务..."\n\
    exec python app.py\n\
else\n\
    echo "❌ 数据库迁移失败，服务启动中止"\n\
    exit 1\n\
fi' > /app/start.sh && chmod +x /app/start.sh

# 环境变量设置
ENV PYTHONUNBUFFERED=1
ENV API_HOST=0.0.0.0
ENV API_PORT=81
ENV DEBUG=False
ENV LOG_LEVEL=INFO

# 默认数据库配置（可通过环境变量覆盖）
ENV MYSQL_HOST=mysql
ENV MYSQL_PORT=3306
ENV MYSQL_DATABASE=joyful
ENV MYSQL_USER=root
ENV MYSQL_PASSWORD=password

# JWT配置
ENV JWT_EXPIRES_DAYS=30

# 暴露端口
EXPOSE 81

# 启动应用
CMD ["/app/start.sh"] 