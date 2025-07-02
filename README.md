# Joyful 项目运行指南

这是一个AI图像生成的全栈Web应用项目，包含原生前端和Flask后端API。

## 项目结构

```
joyful/
├── web/          # 原生HTML/CSS/JS前端项目
├── api/          # Flask后端API项目
└── README.md     # 项目文档
```

## 环境要求

### 后端环境
- Python 3.8+
- MySQL 数据库
- pip 包管理器

### 前端环境
- Node.js 16+ (可选，用于HTTP服务器)
- Python 3.x (用于简单HTTP服务器)

## 快速开始

### 1. 数据库准备

确保MySQL数据库已安装并运行，创建名为 `joyful` 的数据库。

### 2. 后端启动

#### 方式一：本地运行

```bash
# 进入后端目录
cd api

# 创建Python虚拟环境
python -m venv venv

# 激活虚拟环境
# macOS/Linux:
source venv/bin/activate
# Windows:
venv\Scripts\activate

# 安装依赖
pip install -r requirements.txt

# 复制环境配置文件
cp env.example .env

# 编辑.env文件，配置必要参数
# 必需配置：
# DASHSCOPE_API_KEY=你的阿里云API密钥
# MYSQL_HOST=你的数据库主机
# MYSQL_USER=你的数据库用户名
# MYSQL_PASSWORD=你的数据库密码
# MYSQL_DATABASE=joyful

# 启动后端服务
python app.py
```

后端服务将在 `http://localhost:81` 启动

#### 方式二：Docker运行

```bash
# 进入后端目录
cd api

# 使用Docker Compose启动所有服务（推荐）
docker-compose up -d
```

### 3. 前端启动

```bash
# 进入前端目录
cd web

# 方式一：使用Python HTTP服务器
python3 -m http.server 3000
# 或
python -m http.server 3000

# 方式二：使用Node.js HTTP服务器（需要先安装）
npm install -g http-server
npx http-server -p 3000 -c-1

# 方式三：使用package.json脚本
npm run dev
```

前端服务将在 `http://localhost:3000` 启动

## 环境配置

### 后端环境变量

在 `api/.env` 文件中配置以下环境变量：

```env
# API服务配置
API_HOST=0.0.0.0
API_PORT=81
DEBUG=False
LOG_LEVEL=INFO

# 数据库配置
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_DATABASE=joyful
MYSQL_USER=root
MYSQL_PASSWORD=你的数据库密码

# AI服务API密钥（必需）
DASHSCOPE_API_KEY=你的阿里云API密钥

# JWT安全配置
JWT_SECRET_KEY=你的JWT密钥
JWT_EXPIRES_DAYS=30
```

### 获取阿里云API密钥

1. 访问 [阿里云控制台](https://dashscope.console.aliyun.com/)
2. 开通通义千问服务
3. 获取API密钥并配置到环境变量中

## API接口

### 用户认证
- `POST /api/register` - 用户注册
- `POST /api/login` - 用户登录
- `GET /api/user/info` - 获取用户信息

### 用户管理
- `POST /api/user/use-trial` - 使用试用次数
- `GET /api/user/check-trial` - 检查试用次数

### 图像生成
- `POST /api/generate` - 生成图像
- `GET /api/status/<task_id>` - 获取任务状态
- `GET /api/ratios` - 获取支持的图像比例

### 系统功能
- `GET /api/health` - 健康检查

## 功能特性

### 主要功能
- **AI图像生成**: 基于阿里云通义千问的文本到图像生成
- **用户系统**: 注册、登录、试用次数管理
- **多种比例**: 支持多种图像尺寸和比例
- **实时状态**: 异步任务处理和状态查询
- **图片展示**: 精美的图片画廊展示

### 前端特性
- 响应式设计，适配多种设备
- 现代化UI界面
- 图片轮播展示
- 用户认证界面
- 实时生成进度显示

## 生产部署

### 使用Docker Compose（推荐）

```bash
# 克隆项目
git clone <项目地址>
cd joyful

# 配置环境变量
cd api
cp env.example .env
# 编辑.env文件，配置必要参数

# 启动所有服务
docker-compose up -d

# 查看服务状态
docker-compose ps

# 查看日志
docker-compose logs -f
```

服务访问地址：
- 前端: http://localhost:8080
- 后端API: http://localhost:81
- MySQL: localhost:3306

### 手动部署

1. **数据库部署**
   ```bash
   # 创建数据库
   mysql -u root -p -e "CREATE DATABASE joyful CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
   ```

2. **后端部署**
   ```bash
   cd api
   pip install -r requirements.txt
   python app.py
   ```

3. **前端部署**
   ```bash
   cd web
   # 使用Nginx或Apache等Web服务器托管静态文件
   ```

## 开发说明

### 后端技术栈
- **Flask** - Web框架
- **MySQL** - 数据库
- **Flask-JWT-Extended** - JWT认证
- **Flask-CORS** - 跨域支持
- **DashScope** - 阿里云AI服务SDK
- **mysql-connector-python** - MySQL连接器

### 前端技术栈
- **原生HTML/CSS/JavaScript** - 前端实现
- **Font Awesome** - 图标库
- **Google Fonts** - 字体服务
- **响应式设计** - 支持多设备访问

### 项目架构
```
用户界面 (HTML/CSS/JS)
        ↓
    Flask API服务
        ↓
    MySQL数据库
        ↓
   阿里云AI服务
```

## 故障排除

### 常见问题

1. **数据库连接失败**
   - 检查MySQL服务是否启动
   - 验证数据库连接信息是否正确
   - 确保数据库`joyful`已创建
   - 检查用户权限

2. **AI服务调用失败**
   - 检查DASHSCOPE_API_KEY是否正确配置
   - 验证阿里云账户余额是否充足
   - 确认API调用限额未超出

3. **前端无法访问后端API**
   - 检查后端服务是否在端口81运行
   - 验证CORS配置是否正确
   - 检查防火墙设置

4. **Docker部署问题**
   - 检查Docker和Docker Compose版本
   - 确保.env文件配置正确
   - 查看容器日志：`docker-compose logs`

5. **图像生成任务超时**
   - 检查网络连接
   - 验证API密钥权限
   - 适当调整任务超时时间

## 性能优化

### 后端优化
- 使用连接池管理数据库连接
- 实现API请求缓存
- 添加任务队列处理长时间任务

### 前端优化
- 图片懒加载
- CDN加速静态资源
- 浏览器缓存策略

## 安全注意事项

1. **API密钥安全**
   - 不要将API密钥提交到版本控制
   - 定期轮换API密钥
   - 使用环境变量管理敏感信息

2. **数据库安全**
   - 使用强密码
   - 限制数据库访问权限
   - 定期备份数据

3. **Web安全**
   - 启用HTTPS
   - 实施请求限制
   - 输入验证和清理

## 监控和日志

### 日志配置
```bash
# 查看后端日志
tail -f api/api_server.log

# 查看Docker日志
docker-compose logs -f backend
```

### 健康检查
- 后端健康检查: `GET /api/health`
- 数据库连接检查: 查看应用启动日志

## 联系方式

如有问题，请联系项目维护者。 