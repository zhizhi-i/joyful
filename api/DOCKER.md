# Docker 部署指南

本文档提供了使用 Docker 部署 Joyful AI 图像生成服务的详细步骤。

## 1. 单独部署后端服务

### 1.1 构建镜像

```bash
# 进入api目录
cd api

# 构建Docker镜像
docker build -t joyful-backend:latest .
```

### 1.2 运行容器

基础运行命令：
```bash
docker run -d \
  --name joyful-backend \
  -p 81:81 \
  joyful-backend:latest
```

完整运行命令（推荐）：
```bash
docker run -d \
  --name joyful-backend \
  -p 81:81 \
  -e MYSQL_HOST=你的MySQL主机地址 \
  -e MYSQL_PORT=3306 \
  -e MYSQL_DATABASE=joyful \
  -e MYSQL_USER=你的MySQL用户名 \
  -e MYSQL_PASSWORD=你的MySQL密码 \
  -e DASHSCOPE_API_KEY=你的阿里云API密钥 \
  -e JWT_SECRET_KEY=你的JWT密钥 \
  -e JWT_EXPIRES_DAYS=30 \
  -e LOG_LEVEL=INFO \
  joyful-backend:latest
```

### 1.3 容器管理命令

```bash
# 查看容器日志
docker logs -f joyful-backend

# 停止容器
docker stop joyful-backend

# 启动容器
docker start joyful-backend

# 重启容器
docker restart joyful-backend

# 删除容器
docker rm -f joyful-backend

# 查看容器状态
docker ps -a | grep joyful-backend
```

## 2. 使用Docker网络（推荐）

### 2.1 创建网络

```bash
# 创建Docker网络
docker network create joyful-network
```

### 2.2 部署MySQL

```bash
# 运行MySQL容器
docker run -d \
  --name joyful-mysql \
  --network joyful-network \
  -e MYSQL_ROOT_PASSWORD=你的root密码 \
  -e MYSQL_DATABASE=joyful \
  -e MYSQL_USER=joyful \
  -e MYSQL_PASSWORD=你的用户密码 \
  -p 3306:3306 \
  -v mysql_data:/var/lib/mysql \
  mysql:8.0
```

### 2.3 部署后端服务

```bash
# 运行后端服务（连接到同一网络）
docker run -d \
  --name joyful-backend \
  --network joyful-network \
  -p 81:81 \
  -e MYSQL_HOST=joyful-mysql \
  -e MYSQL_PORT=3306 \
  -e MYSQL_DATABASE=joyful \
  -e MYSQL_USER=joyful \
  -e MYSQL_PASSWORD=你的用户密码 \
  -e DASHSCOPE_API_KEY=你的阿里云API密钥 \
  -e JWT_SECRET_KEY=你的JWT密钥 \
  joyful-backend:latest
```

## 3. 环境变量说明

| 环境变量 | 说明 | 默认值 | 是否必需 |
|---------|------|--------|----------|
| MYSQL_HOST | MySQL主机地址 | mysql | 是 |
| MYSQL_PORT | MySQL端口 | 3306 | 否 |
| MYSQL_DATABASE | 数据库名称 | joyful | 是 |
| MYSQL_USER | 数据库用户名 | root | 是 |
| MYSQL_PASSWORD | 数据库密码 | password | 是 |
| DASHSCOPE_API_KEY | 阿里云API密钥 | - | 是 |
| JWT_SECRET_KEY | JWT加密密钥 | - | 是 |
| JWT_EXPIRES_DAYS | JWT过期天数 | 30 | 否 |
| API_HOST | API监听地址 | 0.0.0.0 | 否 |
| API_PORT | API监听端口 | 81 | 否 |
| DEBUG | 调试模式 | False | 否 |
| LOG_LEVEL | 日志级别 | INFO | 否 |

## 4. 常见问题

### 4.1 数据库连接问题

如果遇到数据库连接错误，请检查：

1. MySQL容器是否正常运行
```bash
docker ps | grep joyful-mysql
```

2. 网络连接是否正常
```bash
# 进入后端容器测试连接
docker exec -it joyful-backend sh
ping joyful-mysql
```

3. 环境变量是否正确配置
```bash
docker exec joyful-backend env | grep MYSQL
```

### 4.2 端口占用问题

如果81端口被占用，可以映射到其他端口：
```bash
docker run -d \
  --name joyful-backend \
  -p 8081:81 \  # 将容器的81端口映射到主机的8081端口
  ... 其他配置 ...
  joyful-backend:latest
```

### 4.3 容器日志查看

查看实时日志：
```bash
# 查看最新100行日志
docker logs --tail 100 -f joyful-backend
```

### 4.4 数据持久化

为了保证数据安全，建议为MySQL配置数据卷：
```bash
# 创建数据卷
docker volume create mysql_data

# 使用数据卷运行MySQL
docker run -d \
  --name joyful-mysql \
  -v mysql_data:/var/lib/mysql \
  ... 其他配置 ...
  mysql:8.0
```

## 5. 生产环境建议

1. **使用Docker Compose**
   - 参考项目根目录的`docker-compose.yml`文件
   - 更容易管理多个服务
   - 配置更集中和清晰

2. **安全建议**
   - 不要使用默认密码
   - 定期更新镜像和依赖
   - 限制容器资源使用
   - 使用非root用户运行容器

3. **监控建议**
   - 设置容器健康检查
   - 配置日志聚合
   - 监控容器资源使用

4. **备份建议**
   - 定期备份数据库
   - 备份配置文件
   - 保存镜像版本

## 6. 快速部署脚本

创建`deploy.sh`脚本简化部署流程：

```bash
#!/bin/bash

# 设置变量
MYSQL_ROOT_PASSWORD="your_root_password"
MYSQL_USER="joyful"
MYSQL_PASSWORD="your_password"
MYSQL_DATABASE="joyful"
DASHSCOPE_API_KEY="your_api_key"
JWT_SECRET_KEY="your_jwt_key"

# 创建网络
docker network create joyful-network || true

# 运行MySQL
docker run -d \
  --name joyful-mysql \
  --network joyful-network \
  -e MYSQL_ROOT_PASSWORD=$MYSQL_ROOT_PASSWORD \
  -e MYSQL_DATABASE=$MYSQL_DATABASE \
  -e MYSQL_USER=$MYSQL_USER \
  -e MYSQL_PASSWORD=$MYSQL_PASSWORD \
  -p 3306:3306 \
  -v mysql_data:/var/lib/mysql \
  mysql:8.0

# 等待MySQL启动
echo "等待MySQL启动..."
sleep 30

# 运行后端服务
docker run -d \
  --name joyful-backend \
  --network joyful-network \
  -p 81:81 \
  -e MYSQL_HOST=joyful-mysql \
  -e MYSQL_DATABASE=$MYSQL_DATABASE \
  -e MYSQL_USER=$MYSQL_USER \
  -e MYSQL_PASSWORD=$MYSQL_PASSWORD \
  -e DASHSCOPE_API_KEY=$DASHSCOPE_API_KEY \
  -e JWT_SECRET_KEY=$JWT_SECRET_KEY \
  joyful-backend:latest

echo "部署完成！"
echo "后端服务地址: http://localhost:81"
```

使用方法：
```bash
# 添加执行权限
chmod +x deploy.sh

# 执行部署
./deploy.sh
```