# AI Text-to-Image Frontend - Docker 部署

这是AI文字作画项目的前端Docker镜像构建和部署说明。

## 🚀 快速开始

### 1. 构建Docker镜像

```bash
npm run docker:build
# 或者直接使用
docker build -t ai-text-to-image-frontend .
```

### 2. 运行容器

```bash
# 前台运行（用于测试）
npm run docker:run

# 后台运行（生产环境）
npm run docker:run:prod

# 自定义后端API地址
docker run -p 8080:80 \
  -e BACKEND_API_URL=http://your-backend:81/api \
  ai-text-to-image-frontend
```

### 3. 访问应用

打开浏览器访问：`http://localhost:8080`

### 4. 停止和清理

```bash
# 停止容器
npm run docker:stop

# 删除镜像
npm run docker:clean
```

## 🔧 环境变量配置

| 变量名 | 默认值 | 说明 |
|--------|--------|------|
| `BACKEND_API_URL` | `http://localhost:81/api` | 后端API地址 |
| `FRONTEND_PORT` | `80` | 容器内前端端口 |

## 🐳 Docker Compose 部署

使用 docker-compose 可以同时启动前端和后端：

```bash
# 启动所有服务
docker-compose up -d

# 查看日志
docker-compose logs -f

# 停止所有服务
docker-compose down
```

## 📝 镜像特性

- ✅ 基于 Nginx Alpine，镜像小巧
- ✅ 支持环境变量动态配置
- ✅ 启用 Gzip 压缩
- ✅ 静态文件缓存优化
- ✅ 健康检查支持
- ✅ 生产级安全配置

## 🔍 故障排除

### 无法连接后端

检查 `BACKEND_API_URL` 环境变量是否正确：

```bash
docker run -p 8080:80 \
  -e BACKEND_API_URL=http://host.docker.internal:81/api \
  ai-text-to-image-frontend
```

### 端口冲突

更改映射端口：

```bash
docker run -p 3000:80 \
  -e BACKEND_API_URL=http://localhost:81/api \
  ai-text-to-image-frontend
```

## 📋 技术栈

- **Web服务器**: Nginx Alpine
- **前端技术**: HTML5 + CSS3 + JavaScript
- **容器化**: Docker + Docker Compose
- **配置管理**: 环境变量注入

构建时间：约 30-60 秒  
镜像大小：约 15-25 MB  
启动时间：约 2-5 秒 