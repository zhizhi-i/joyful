from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_jwt_extended import JWTManager, create_access_token, jwt_required, get_jwt_identity
import os
import json
import base64
import logging
from http import HTTPStatus
from urllib.parse import urlparse, unquote
from pathlib import PurePosixPath
import requests
import tempfile
import uuid
from dashscope import ImageSynthesis, VideoSynthesis
import hashlib
from datetime import datetime, timedelta
import secrets
from database_migration import DatabaseMigration
from email_verification import email_service

# 加载环境变量
try:
    from dotenv import load_dotenv
    from pathlib import Path
    env_path = Path(__file__).parent / '.env'
    if env_path.exists():
        load_dotenv(env_path)
except ImportError:
    pass  # 如果没有安装python-dotenv，跳过

# 配置日志 - 动态日志级别
LOG_LEVEL = os.getenv('LOG_LEVEL', 'INFO').upper()
logging.basicConfig(
    level=getattr(logging, LOG_LEVEL, logging.INFO),
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler('api_server.log')
    ]
)
logger = logging.getLogger(__name__)

# 全局变量：存储任务ID到会话ID的映射
task_conversation_mapping = {}

# 存储Image-to-Video任务的详细信息，用于任务完成时保存历史记录
image_to_video_task_mapping = {}

app = Flask(__name__)

# 配置CORS - 允许指定域名的跨域请求
CORS(app, 
     origins=[
         'https://joyful.cloud',
         'https://www.joyful.cloud', 
         'http://localhost:3000',
         'http://localhost:8080',
         'http://127.0.0.1:3000',
         'http://127.0.0.1:8080'
     ],
     allow_headers=[
         'Content-Type',
         'Authorization',
         'Access-Control-Allow-Credentials'
     ],
     methods=['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
     supports_credentials=True
)

# 配置
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB max file size
app.config['JWT_SECRET_KEY'] = os.getenv('JWT_SECRET_KEY', secrets.token_hex(32))
app.config['JWT_ACCESS_TOKEN_EXPIRES'] = timedelta(days=int(os.getenv('JWT_EXPIRES_DAYS', 30)))

# 应用配置
API_HOST = os.getenv('API_HOST', '0.0.0.0')
API_PORT = int(os.getenv('API_PORT', 81))
DEBUG_MODE = os.getenv('DEBUG', 'True').lower() in ('true', '1', 'yes')

# 初始化JWT
jwt = JWTManager(app)

# 数据库配置 - 更新为MySQL
import mysql.connector
from mysql.connector import Error

# MySQL数据库配置
MYSQL_CONFIG = {
    'host': os.getenv('MYSQL_HOST', '172.17.200.117'),
    'database': os.getenv('MYSQL_DATABASE', 'joyful'),
    'user': os.getenv('MYSQL_USER', 'root'),
    'password': os.getenv('MYSQL_PASSWORD', '123456'),
    'port': int(os.getenv('MYSQL_PORT', 3306))
}

class UserDatabase:
    def __init__(self):
        # 运行数据库迁移
        self.run_migrations()
    
    def run_migrations(self):
        """运行数据库迁移"""
        logger.info("开始数据库迁移检查...")
        try:
            migration_manager = DatabaseMigration(MYSQL_CONFIG)
            success = migration_manager.run_migrations()
            if success:
                logger.info("数据库迁移完成")
            else:
                logger.error("数据库迁移失败")
                raise Exception("数据库迁移失败")
        except Exception as e:
            logger.error(f"数据库迁移异常: {e}")
            raise e
    
    def get_connection(self):
        """获取MySQL连接"""
        try:
            connection = mysql.connector.connect(**MYSQL_CONFIG)
            return connection
        except Error as e:
            logger.error(f"MySQL连接失败: {e}")
            raise e
    
    def hash_password(self, password):
        """哈希密码"""
        return hashlib.sha256(password.encode()).hexdigest()
    
    def create_user(self, email, password, role='user'):
        """创建用户"""
        try:
            conn = self.get_connection()
            cursor = conn.cursor()
            
            password_hash = self.hash_password(password)
            
            cursor.execute(
                'INSERT INTO users (email, password_hash, role, demo_count, created_at, updated_at) VALUES (%s, %s, %s, %s, NOW(), NOW())',
                (email, password_hash, role, 5 if role == 'user' else 999999)
            )
            
            user_id = cursor.lastrowid
            conn.commit()
            cursor.close()
            conn.close()
            
            logger.info(f"用户创建成功: {email}, 角色: {role}")
            return user_id
        except mysql.connector.IntegrityError:
            logger.warning(f"用户已存在: {email}")
            raise ValueError("用户已存在")
        except Exception as e:
            logger.error(f"创建用户失败: {e}")
            raise e
    
    def verify_user(self, email, password):
        """验证用户"""
        try:
            conn = self.get_connection()
            cursor = conn.cursor()
            
            password_hash = self.hash_password(password)
            
            cursor.execute(
                'SELECT id, email, role, demo_count FROM users WHERE email = %s AND password_hash = %s',
                (email, password_hash)
            )
            
            user = cursor.fetchone()
            cursor.close()
            conn.close()
            
            if user:
                return {
                    'id': user[0],
                    'email': user[1],
                    'is_admin': user[2] == 'admin',
                    'trial_count': user[3]
                }
            return None
        except Exception as e:
            logger.error(f"验证用户失败: {e}")
            return None
    
    def get_user_by_id(self, user_id):
        """通过ID获取用户信息"""
        try:
            conn = self.get_connection()
            cursor = conn.cursor()
            
            cursor.execute(
                'SELECT id, email, role, demo_count FROM users WHERE id = %s',
                (user_id,)
            )
            
            user = cursor.fetchone()
            cursor.close()
            conn.close()
            
            if user:
                return {
                    'id': user[0],
                    'email': user[1],
                    'is_admin': user[2] == 'admin',
                    'trial_count': user[3]
                }
            return None
        except Exception as e:
            logger.error(f"获取用户信息失败: {e}")
            return None
    
    def get_user_by_email(self, email):
        """通过邮箱获取用户信息"""
        try:
            conn = self.get_connection()
            cursor = conn.cursor()
            
            cursor.execute(
                'SELECT id, email, role, demo_count FROM users WHERE email = %s',
                (email,)
            )
            
            user = cursor.fetchone()
            cursor.close()
            conn.close()
            
            if user:
                return {
                    'id': user[0],
                    'email': user[1],
                    'is_admin': user[2] == 'admin',
                    'trial_count': user[3]
                }
            return None
        except Exception as e:
            logger.error(f"获取用户信息失败: {e}")
            return None
    
    def use_trial(self, user_id, demo_type='image_generation'):
        """使用试用次数"""
        try:
            conn = self.get_connection()
            cursor = conn.cursor()
            
            # 获取当前试用次数
            cursor.execute('SELECT demo_count, role FROM users WHERE id = %s', (user_id,))
            result = cursor.fetchone()
            
            if not result:
                cursor.close()
                conn.close()
                raise ValueError("用户不存在")
            
            current_trials, role = result
            is_admin = role == 'admin'
            
            # 管理员无限制，直接返回成功
            if is_admin:
                cursor.close()
                conn.close()
                logger.info(f"管理员用户 {user_id} 使用AI功能（无限制）")
                return {
                    'success': True,
                    'remaining_trials': 999999,
                    'is_admin': True
                }
            
            # 检查试用次数
            if current_trials <= 0:
                cursor.close()
                conn.close()
                raise ValueError("试用次数已用完")
            
            # 减少试用次数
            new_trial_count = current_trials - 1
            cursor.execute(
                'UPDATE users SET demo_count = %s, updated_at = NOW() WHERE id = %s',
                (new_trial_count, user_id)
            )
            
            # 提交用户试用次数更新
            conn.commit()
            
            cursor.close()
            conn.close()
            
            logger.info(f"用户 {user_id} 使用试用次数，剩余: {new_trial_count}")
            return {
                'success': True,
                'remaining_trials': new_trial_count,
                'is_admin': False
            }
        except Exception as e:
            logger.error(f"使用试用次数失败: {e}")
            raise e
    
    def check_trial_status(self, user_id):
        """检查试用状态"""
        try:
            user = self.get_user_by_id(user_id)
            if not user:
                raise ValueError("用户不存在")
            
            is_admin = user['is_admin']
            remaining_trials = user['trial_count']
            has_trials = is_admin or remaining_trials > 0
            
            return {
                'has_trials': has_trials,
                'remaining_trials': remaining_trials if not is_admin else 999999,
                'is_admin': is_admin
            }
        except Exception as e:
            logger.error(f"检查试用状态失败: {e}")
            raise e
    
    # ===== 会话管理方法 =====
    
    def create_conversation(self, user_id, title=None):
        """创建新会话"""
        try:
            conn = self.get_connection()
            cursor = conn.cursor()
            
            # 如果没有提供标题，生成默认标题
            if not title:
                # 获取用户当前会话数量
                cursor.execute('SELECT COUNT(*) FROM conversations WHERE user_id = %s', (user_id,))
                count = cursor.fetchone()[0]
                title = f"Chat {count + 1}"
            
            cursor.execute(
                'INSERT INTO conversations (user_id, title, created_at, updated_at) VALUES (%s, %s, NOW(), NOW())',
                (user_id, title)
            )
            
            conversation_id = cursor.lastrowid
            conn.commit()
            cursor.close()
            conn.close()
            
            logger.info(f"会话创建成功: {conversation_id}, 用户: {user_id}, 标题: {title}")
            return conversation_id
        except Exception as e:
            logger.error(f"创建会话失败: {e}")
            raise e
    
    def get_user_conversations(self, user_id):
        """获取用户的所有会话"""
        try:
            conn = self.get_connection()
            cursor = conn.cursor()
            
            cursor.execute(
                'SELECT id, title, created_at, updated_at FROM conversations WHERE user_id = %s ORDER BY updated_at DESC',
                (user_id,)
            )
            
            conversations = []
            for row in cursor.fetchall():
                conversations.append({
                    'id': row[0],
                    'title': row[1],
                    'created_at': row[2].isoformat() if row[2] else None,
                    'updated_at': row[3].isoformat() if row[3] else None
                })
            
            cursor.close()
            conn.close()
            
            return conversations
        except Exception as e:
            logger.error(f"获取用户会话失败: {e}")
            raise e
    
    def update_conversation_title(self, conversation_id, user_id, title):
        """更新会话标题"""
        try:
            conn = self.get_connection()
            cursor = conn.cursor()
            
            cursor.execute(
                'UPDATE conversations SET title = %s, updated_at = NOW() WHERE id = %s AND user_id = %s',
                (title, conversation_id, user_id)
            )
            
            if cursor.rowcount == 0:
                cursor.close()
                conn.close()
                raise ValueError("会话不存在或无权限")
            
            conn.commit()
            cursor.close()
            conn.close()
            
            logger.info(f"会话标题更新成功: {conversation_id}, 新标题: {title}")
            return True
        except Exception as e:
            logger.error(f"更新会话标题失败: {e}")
            raise e
    
    def delete_conversation(self, conversation_id, user_id):
        """删除会话（级联删除相关图片历史）"""
        try:
            conn = self.get_connection()
            cursor = conn.cursor()
            
            cursor.execute(
                'DELETE FROM conversations WHERE id = %s AND user_id = %s',
                (conversation_id, user_id)
            )
            
            if cursor.rowcount == 0:
                cursor.close()
                conn.close()
                raise ValueError("会话不存在或无权限")
            
            conn.commit()
            cursor.close()
            conn.close()
            
            logger.info(f"会话删除成功: {conversation_id}")
            return True
        except Exception as e:
            logger.error(f"删除会话失败: {e}")
            raise e
    
    def save_image_history(self, conversation_id, user_id, prompt, image_url, image_base64, aspect_ratio='1:1', image_count=1):
        """保存图片历史记录"""
        try:
            conn = self.get_connection()
            cursor = conn.cursor()
            
            # 验证会话是否属于用户
            cursor.execute(
                'SELECT id FROM conversations WHERE id = %s AND user_id = %s',
                (conversation_id, user_id)
            )
            
            if not cursor.fetchone():
                cursor.close()
                conn.close()
                raise ValueError("会话不存在或无权限")
            
            cursor.execute(
                '''INSERT INTO image_history 
                   (conversation_id, user_id, prompt, image_url, image_base64, aspect_ratio, image_count, created_at) 
                   VALUES (%s, %s, %s, %s, %s, %s, %s, NOW())''',
                (conversation_id, user_id, prompt, image_url, image_base64, aspect_ratio, image_count)
            )
            
            history_id = cursor.lastrowid
            
            # 更新会话的 updated_at
            cursor.execute(
                'UPDATE conversations SET updated_at = NOW() WHERE id = %s',
                (conversation_id,)
            )
            
            conn.commit()
            cursor.close()
            conn.close()
            
            logger.info(f"图片历史保存成功: {history_id}, 会话: {conversation_id}")
            return history_id
        except Exception as e:
            logger.error(f"保存图片历史失败: {e}")
            raise e
    
    def get_conversation_history(self, conversation_id, user_id, limit=50, offset=0):
        """获取会话的图片和视频历史"""
        try:
            conn = self.get_connection()
            cursor = conn.cursor()
            
            # 验证会话是否属于用户
            cursor.execute(
                'SELECT id FROM conversations WHERE id = %s AND user_id = %s',
                (conversation_id, user_id)
            )
            
            if not cursor.fetchone():
                cursor.close()
                conn.close()
                raise ValueError("会话不存在或无权限")
            
            # 获取图片历史
            cursor.execute(
                '''SELECT id, prompt, image_url, image_base64, aspect_ratio, image_count, created_at, 'image' as type
                   FROM image_history 
                   WHERE conversation_id = %s''',
                (conversation_id,)
            )
            
            history = []
            for row in cursor.fetchall():
                history.append({
                    'id': row[0],
                    'prompt': row[1],
                    'image_url': row[2],
                    'image_base64': row[3],
                    'aspect_ratio': row[4],
                    'image_count': row[5],
                    'created_at': row[6].isoformat() if row[6] else None,
                    'type': row[7]
                })
            
            # 获取视频历史
            cursor.execute(
                '''SELECT id, prompt, video_url, size, duration, created_at, 'video' as type
                   FROM video_history 
                   WHERE conversation_id = %s''',
                (conversation_id,)
            )
            
            for row in cursor.fetchall():
                history.append({
                    'id': row[0],
                    'prompt': row[1],
                    'video_url': row[2],
                    'size': row[3],
                    'duration': row[4],
                    'created_at': row[5].isoformat() if row[5] else None,
                    'type': row[6]
                })
            
            # 获取图片转视频历史
            cursor.execute(
                '''SELECT id, prompt, video_url, size, duration, created_at, 'image_to_video' as type, image_base64
                   FROM image_to_video_history 
                   WHERE conversation_id = %s''',
                (conversation_id,)
            )
            
            for row in cursor.fetchall():
                history.append({
                    'id': row[0],
                    'prompt': row[1],
                    'video_url': row[2],
                    'size': row[3],
                    'duration': row[4],
                    'created_at': row[5].isoformat() if row[5] else None,
                    'type': row[6],
                    'image_base64': row[7]  # 包含源图片
                })
            
            # 按创建时间倒序排序
            history.sort(key=lambda x: x['created_at'], reverse=True)
            
            # 应用分页
            start = offset
            end = offset + limit
            paginated_history = history[start:end]
            
            cursor.close()
            conn.close()
            
            return paginated_history
        except Exception as e:
            logger.error(f"获取会话历史失败: {e}")
            raise e
    
    def save_video_history(self, conversation_id, user_id, prompt, video_url, size='1920*1080', duration=5, orig_prompt=None, actual_prompt=None, usage_info=None, task_id=None):
        """保存视频历史记录"""
        try:
            conn = self.get_connection()
            cursor = conn.cursor()
            
            # 验证会话是否属于用户
            cursor.execute(
                'SELECT id FROM conversations WHERE id = %s AND user_id = %s',
                (conversation_id, user_id)
            )
            
            if not cursor.fetchone():
                cursor.close()
                conn.close()
                raise ValueError("会话不存在或无权限")
            
            # 转换usage_info为JSON字符串
            usage_json = None
            if usage_info:
                import json
                usage_json = json.dumps(usage_info)
            
            cursor.execute(
                '''INSERT INTO video_history 
                   (conversation_id, user_id, prompt, video_url, size, duration, orig_prompt, actual_prompt, usage_info, task_id, created_at) 
                   VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, NOW())''',
                (conversation_id, user_id, prompt, video_url, size, duration, orig_prompt, actual_prompt, usage_json, task_id)
            )
            
            history_id = cursor.lastrowid
            
            # 更新会话的 updated_at
            cursor.execute(
                'UPDATE conversations SET updated_at = NOW() WHERE id = %s',
                (conversation_id,)
            )
            
            conn.commit()
            cursor.close()
            conn.close()
            
            logger.info(f"视频历史保存成功: {history_id}, 会话: {conversation_id}")
            return history_id
        except Exception as e:
            logger.error(f"保存视频历史失败: {e}")
            raise e
    
    def get_conversation_video_history(self, conversation_id, user_id, limit=50, offset=0):
        """获取会话的视频历史"""
        try:
            conn = self.get_connection()
            cursor = conn.cursor()
            
            # 验证会话是否属于用户
            cursor.execute(
                'SELECT id FROM conversations WHERE id = %s AND user_id = %s',
                (conversation_id, user_id)
            )
            
            if not cursor.fetchone():
                cursor.close()
                conn.close()
                raise ValueError("会话不存在或无权限")
            
            cursor.execute(
                '''SELECT id, prompt, video_url, size, duration, orig_prompt, actual_prompt, usage_info, task_id, created_at 
                   FROM video_history 
                   WHERE conversation_id = %s 
                   ORDER BY created_at DESC 
                   LIMIT %s OFFSET %s''',
                (conversation_id, limit, offset)
            )
            
            history = []
            for row in cursor.fetchall():
                # 解析usage_info JSON
                usage_info = None
                if row[7]:  # usage_info字段
                    try:
                        import json
                        usage_info = json.loads(row[7])
                    except json.JSONDecodeError:
                        usage_info = None
                
                history.append({
                    'id': row[0],
                    'prompt': row[1],
                    'video_url': row[2],
                    'size': row[3],
                    'duration': row[4],
                    'orig_prompt': row[5],
                    'actual_prompt': row[6],
                    'usage': usage_info,
                    'task_id': row[8],
                    'created_at': row[9].isoformat() if row[9] else None
                })
            
            cursor.close()
            conn.close()
            
            return history
        except Exception as e:
            logger.error(f"获取视频历史失败: {e}")
            raise e
    
    def save_image_to_video_history(self, conversation_id, user_id, prompt, image_base64, video_url, size='1920*1080', duration=5, orig_prompt=None, actual_prompt=None, usage_info=None, task_id=None):
        """保存图片转视频历史记录"""
        try:
            conn = self.get_connection()
            cursor = conn.cursor()
            
            # 验证会话是否属于用户
            cursor.execute(
                'SELECT id FROM conversations WHERE id = %s AND user_id = %s',
                (conversation_id, user_id)
            )
            
            if not cursor.fetchone():
                cursor.close()
                conn.close()
                raise ValueError("会话不存在或无权限")
            
            # 转换usage_info为JSON字符串
            usage_json = None
            if usage_info:
                import json
                usage_json = json.dumps(usage_info)
            
            cursor.execute(
                '''INSERT INTO image_to_video_history 
                   (conversation_id, user_id, prompt, image_base64, video_url, size, duration, orig_prompt, actual_prompt, usage_info, task_id, created_at) 
                   VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, NOW())''',
                (conversation_id, user_id, prompt, image_base64, video_url, size, duration, orig_prompt, actual_prompt, usage_json, task_id)
            )
            
            history_id = cursor.lastrowid
            
            # 更新会话的 updated_at
            cursor.execute(
                'UPDATE conversations SET updated_at = NOW() WHERE id = %s',
                (conversation_id,)
            )
            
            conn.commit()
            cursor.close()
            conn.close()
            
            logger.info(f"图片转视频历史保存成功: {history_id}, 会话: {conversation_id}")
            return history_id
        except Exception as e:
            logger.error(f"保存图片转视频历史失败: {e}")
            raise e
    
    def get_conversation_image_to_video_history(self, conversation_id, user_id, limit=50, offset=0):
        """获取会话的图片转视频历史"""
        try:
            conn = self.get_connection()
            cursor = conn.cursor()
            
            # 验证会话是否属于用户
            cursor.execute(
                'SELECT id FROM conversations WHERE id = %s AND user_id = %s',
                (conversation_id, user_id)
            )
            
            if not cursor.fetchone():
                cursor.close()
                conn.close()
                raise ValueError("会话不存在或无权限")
            
            cursor.execute(
                '''SELECT id, prompt, image_base64, video_url, size, duration, orig_prompt, actual_prompt, usage_info, task_id, created_at 
                   FROM image_to_video_history 
                   WHERE conversation_id = %s 
                   ORDER BY created_at DESC 
                   LIMIT %s OFFSET %s''',
                (conversation_id, limit, offset)
            )
            
            history = []
            for row in cursor.fetchall():
                # 解析usage_info JSON
                usage_info = None
                if row[8]:  # usage_info字段
                    try:
                        import json
                        usage_info = json.loads(row[8])
                    except json.JSONDecodeError:
                        usage_info = None
                
                history.append({
                    'id': row[0],
                    'prompt': row[1],
                    'image_base64': row[2],
                    'video_url': row[3],
                    'size': row[4],
                    'duration': row[5],
                    'orig_prompt': row[6],
                    'actual_prompt': row[7],
                    'usage': usage_info,
                    'task_id': row[9],
                    'created_at': row[10].isoformat() if row[10] else None
                })
            
            cursor.close()
            conn.close()
            
            return history
        except Exception as e:
            logger.error(f"获取图片转视频历史失败: {e}")
            raise e

# 初始化数据库
user_db = UserDatabase()

class ImageGenerator:
    def __init__(self):
        self.api_key = os.getenv("DASHSCOPE_API_KEY", "sk-bd2c58cc05844168bcf96bc07c2e81da")
        logger.info(f"初始化ImageGenerator，API密钥: {self.api_key[:20]}...")
        if not self.api_key:
            raise ValueError("请设置环境变量 DASHSCOPE_API_KEY")
    
    def create_async_task(self, prompt, size="1024*1024", n=1):
        """创建异步图片生成任务"""
        logger.info(f"=== 开始创建异步任务 ===")
        logger.info(f"提示词: {prompt}")
        logger.info(f"尺寸: {size}")
        logger.info(f"数量: {n}")
        logger.info(f"API密钥: {self.api_key[:20]}...")
        
        try:
            logger.info("调用 ImageSynthesis.async_call")
            rsp = ImageSynthesis.async_call(
                api_key=self.api_key,
                model="wanx2.1-t2i-turbo",
                prompt=prompt,
                n=n,
                size=size
            )
            
            logger.info(f"API响应状态码: {rsp.status_code}")
            logger.info(f"API响应完整内容: {rsp}")
            
            if hasattr(rsp, 'output'):
                logger.info(f"响应输出: {rsp.output}")
            if hasattr(rsp, 'message'):
                logger.info(f"响应消息: {rsp.message}")
            if hasattr(rsp, 'code'):
                logger.info(f"响应代码: {rsp.code}")
            
            if rsp.status_code == HTTPStatus.OK:
                task_id = rsp.output.task_id if hasattr(rsp.output, 'task_id') else None
                task_status = rsp.output.task_status if hasattr(rsp.output, 'task_status') else None
                
                logger.info(f"任务创建成功 - 任务ID: {task_id}, 状态: {task_status}")
                
                return {
                    "success": True,
                    "task_id": task_id,
                    "task_status": task_status,
                    "task_object": rsp,  # 返回完整的响应对象
                    "message": "任务创建成功"
                }
            else:
                error_msg = f"创建任务失败: {rsp.message if hasattr(rsp, 'message') else '未知错误'}"
                logger.error(error_msg)
                return {
                    "success": False,
                    "error": error_msg,
                    "status_code": rsp.status_code,
                    "response_detail": str(rsp)
                }
        except Exception as e:
            error_msg = f"创建任务异常: {str(e)}"
            logger.error(error_msg)
            logger.exception("详细异常信息:")
            return {
                "success": False,
                "error": error_msg,
                "exception_type": type(e).__name__
            }
    
    def wait_and_get_result(self, task_result):
        """等待任务完成并获取结果"""
        logger.info(f"=== 开始等待任务完成 ===")
        
        try:
            # 使用原始的task对象，而不是重新构造
            task_object = task_result.get("task_object")
            if not task_object:
                logger.error("没有找到有效的task对象")
                return {
                    "success": False,
                    "error": "没有找到有效的task对象"
                }
            
            logger.info(f"使用task对象等待结果: {task_object}")
            logger.info("调用 ImageSynthesis.wait")
            logger.info(f"传递API密钥: {self.api_key[:20]}...")
            
            rsp = ImageSynthesis.wait(task_object, api_key=self.api_key)
            
            logger.info(f"等待结果响应状态码: {rsp.status_code}")
            logger.info(f"等待结果响应完整内容: {rsp}")
            
            if rsp.status_code == HTTPStatus.OK:
                logger.info("任务完成成功，开始处理结果")
                images = []
                
                if hasattr(rsp.output, 'results'):
                    logger.info(f"找到 {len(rsp.output.results)} 个结果")
                    for i, result in enumerate(rsp.output.results):
                        logger.info(f"处理第 {i+1} 个结果: {result.url}")
                        
                        # 下载图片数据
                        try:
                            img_response = requests.get(result.url, timeout=30)
                            if img_response.status_code == 200:
                                # 转换为base64
                                img_base64 = base64.b64encode(img_response.content).decode('utf-8')
                                images.append({
                                    "url": result.url,
                                    "base64": f"data:image/png;base64,{img_base64}"
                                })
                                logger.info(f"成功下载并转换图片 {i+1}")
                            else:
                                logger.error(f"下载图片失败: HTTP {img_response.status_code}")
                        except Exception as download_error:
                            logger.error(f"下载图片异常: {download_error}")
                
                task_status = rsp.output.task_status if hasattr(rsp.output, 'task_status') else 'UNKNOWN'
                logger.info(f"最终任务状态: {task_status}")
                
                return {
                    "success": True,
                    "images": images,
                    "task_status": task_status
                }
            else:
                error_msg = f"获取结果失败: {rsp.message if hasattr(rsp, 'message') else '未知错误'}"
                logger.error(error_msg)
                return {
                    "success": False,
                    "error": error_msg,
                    "status_code": rsp.status_code,
                    "response_detail": str(rsp)
                }
        except Exception as e:
            error_msg = f"获取结果异常: {str(e)}"
            logger.error(error_msg)
            logger.exception("详细异常信息:")
            return {
                "success": False,
                "error": error_msg,
                "exception_type": type(e).__name__
            }
    
    def fetch_task_status(self, task_id):
        """获取任务状态"""
        logger.info(f"=== 查询任务状态 ===")
        logger.info(f"任务ID: {task_id}")
        
        try:
            # 构造task对象
            class TaskObj:
                def __init__(self, task_id):
                    self.output = type('obj', (object,), {'task_id': task_id})()
            
            task = TaskObj(task_id)
            logger.info(f"构造的task对象: {task}")
            logger.info(f"传递API密钥: {self.api_key[:20]}...")
            
            status = ImageSynthesis.fetch(task, api_key=self.api_key)
            
            logger.info(f"状态查询响应: {status}")
            
            if status.status_code == HTTPStatus.OK:
                task_status = status.output.task_status if hasattr(status.output, 'task_status') else 'UNKNOWN'
                logger.info(f"任务状态查询成功: {task_status}")
                
                return {
                    "success": True,
                    "task_status": task_status,
                    "task_id": task_id
                }
            else:
                error_msg = f"获取状态失败: {status.message if hasattr(status, 'message') else '未知错误'}"
                logger.error(error_msg)
                return {
                    "success": False,
                    "error": error_msg,
                    "status_code": status.status_code
                }
        except Exception as e:
            error_msg = f"获取状态异常: {str(e)}"
            logger.error(error_msg)
            logger.exception("详细异常信息:")
            return {
                "success": False,
                "error": error_msg,
                "exception_type": type(e).__name__
            }

class VideoGenerator:
    def __init__(self):
        self.api_key = os.getenv("DASHSCOPE_API_KEY", "sk-bd2c58cc05844168bcf96bc07c2e81da")
        logger.info(f"初始化VideoGenerator，API密钥: {self.api_key[:20]}...")
        if not self.api_key:
            raise ValueError("请设置环境变量 DASHSCOPE_API_KEY")
    
    def create_async_task(self, prompt, size="1920*1080"):
        """创建异步视频生成任务"""
        logger.info(f"=== 开始创建视频异步任务 ===")
        logger.info(f"提示词: {prompt}")
        logger.info(f"尺寸: {size}")
        logger.info(f"API密钥: {self.api_key[:20]}...")
        
        try:
            logger.info("调用 VideoSynthesis.async_call")
            rsp = VideoSynthesis.async_call(
                api_key=self.api_key,
                model="wan2.2-t2v-plus",
                prompt=prompt,
                size=size
            )
            
            logger.info(f"API响应状态码: {rsp.status_code}")
            logger.info(f"API响应完整内容: {rsp}")
            
            if hasattr(rsp, 'output'):
                logger.info(f"响应输出: {rsp.output}")
            if hasattr(rsp, 'message'):
                logger.info(f"响应消息: {rsp.message}")
            if hasattr(rsp, 'code'):
                logger.info(f"响应代码: {rsp.code}")
            
            if rsp.status_code == HTTPStatus.OK:
                task_id = rsp.output.task_id if hasattr(rsp.output, 'task_id') else None
                task_status = rsp.output.task_status if hasattr(rsp.output, 'task_status') else None
                
                logger.info(f"视频任务创建成功 - 任务ID: {task_id}, 状态: {task_status}")
                
                return {
                    "success": True,
                    "task_id": task_id,
                    "task_status": task_status,
                    "task_object": rsp,  # 返回完整的响应对象
                    "message": "视频任务创建成功"
                }
            else:
                error_msg = f"创建视频任务失败: {rsp.message if hasattr(rsp, 'message') else '未知错误'}"
                logger.error(error_msg)
                return {
                    "success": False,
                    "error": error_msg,
                    "status_code": rsp.status_code,
                    "response_detail": str(rsp)
                }
        except Exception as e:
            error_msg = f"创建视频任务异常: {str(e)}"
            logger.error(error_msg)
            logger.exception("详细异常信息:")
            return {
                "success": False,
                "error": error_msg,
                "exception_type": type(e).__name__
            }
    
    def wait_and_get_result(self, task_result):
        """等待视频任务完成并获取结果"""
        logger.info(f"=== 开始等待视频任务完成 ===")
        
        try:
            # 使用原始的task对象，而不是重新构造
            task_object = task_result.get("task_object")
            if not task_object:
                logger.error("没有找到有效的task对象")
                return {
                    "success": False,
                    "error": "没有找到有效的task对象"
                }
            
            logger.info(f"使用task对象等待视频结果: {task_object}")
            logger.info("调用 VideoSynthesis.wait")
            logger.info(f"传递API密钥: {self.api_key[:20]}...")
            
            rsp = VideoSynthesis.wait(task_object, api_key=self.api_key)
            
            logger.info(f"等待视频结果响应状态码: {rsp.status_code}")
            logger.info(f"等待视频结果响应完整内容: {rsp}")
            
            if rsp.status_code == HTTPStatus.OK:
                logger.info("视频任务完成成功，开始处理结果")
                
                video_url = rsp.output.video_url if hasattr(rsp.output, 'video_url') else None
                task_status = rsp.output.task_status if hasattr(rsp.output, 'task_status') else 'UNKNOWN'
                orig_prompt = rsp.output.orig_prompt if hasattr(rsp.output, 'orig_prompt') else None
                actual_prompt = rsp.output.actual_prompt if hasattr(rsp.output, 'actual_prompt') else None
                
                # 获取使用统计信息
                usage_info = {}
                if hasattr(rsp, 'usage') and rsp.usage:
                    usage_info = {
                        'video_count': rsp.usage.video_count if hasattr(rsp.usage, 'video_count') else 1,
                        'video_duration': rsp.usage.video_duration if hasattr(rsp.usage, 'video_duration') else 5,
                        'video_ratio': rsp.usage.video_ratio if hasattr(rsp.usage, 'video_ratio') else '1920*1080'
                    }
                
                logger.info(f"最终视频任务状态: {task_status}")
                logger.info(f"视频URL: {video_url}")
                
                return {
                    "success": True,
                    "video_url": video_url,
                    "task_status": task_status,
                    "orig_prompt": orig_prompt,
                    "actual_prompt": actual_prompt,
                    "usage": usage_info
                }
            else:
                error_msg = f"获取视频结果失败: {rsp.message if hasattr(rsp, 'message') else '未知错误'}"
                logger.error(error_msg)
                return {
                    "success": False,
                    "error": error_msg,
                    "status_code": rsp.status_code,
                    "response_detail": str(rsp)
                }
        except Exception as e:
            error_msg = f"获取视频结果异常: {str(e)}"
            logger.error(error_msg)
            logger.exception("详细异常信息:")
            return {
                "success": False,
                "error": error_msg,
                "exception_type": type(e).__name__
            }
    
    def fetch_task_status(self, task_id):
        """获取视频任务状态"""
        logger.info(f"=== 查询视频任务状态 ===")
        logger.info(f"任务ID: {task_id}")
        
        try:
            # 直接使用HTTP请求调用阿里云API
            import requests
            
            url = f"https://dashscope.aliyuncs.com/api/v1/tasks/{task_id}"
            headers = {
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json"
            }
            
            logger.info(f"发送HTTP请求到: {url}")
            logger.info(f"请求头: {headers}")
            
            response = requests.get(url, headers=headers, timeout=30)
            
            logger.info(f"HTTP响应状态码: {response.status_code}")
            logger.info(f"HTTP响应内容: {response.text}")
            
            if response.status_code == 200:
                result = response.json()
                
                # 解析响应数据
                output = result.get('output', {})
                task_status = output.get('task_status', 'UNKNOWN')
                video_url = output.get('video_url')
                orig_prompt = output.get('orig_prompt')
                actual_prompt = output.get('actual_prompt')
                
                # 获取使用统计信息
                usage_info = {}
                if 'usage' in result:
                    usage = result['usage']
                    usage_info = {
                        'video_count': usage.get('video_count', 1),
                        'video_duration': usage.get('video_duration', 5),
                        'video_ratio': usage.get('video_ratio', '1920*1080')
                    }
                
                logger.info(f"视频任务状态查询成功: {task_status}")
                
                return {
                    "success": True,
                    "task_status": task_status,
                    "task_id": task_id,
                    "video_url": video_url,
                    "orig_prompt": orig_prompt,
                    "actual_prompt": actual_prompt,
                    "usage": usage_info
                }
            else:
                error_msg = f"获取视频状态失败: HTTP {response.status_code} - {response.text}"
                logger.error(error_msg)
                return {
                    "success": False,
                    "error": error_msg,
                    "status_code": response.status_code
                }
        except Exception as e:
            error_msg = f"获取视频状态异常: {str(e)}"
            logger.error(error_msg)
            logger.exception("详细异常信息:")
            return {
                "success": False,
                "error": error_msg,
                "exception_type": type(e).__name__
            }

class ImageToVideoGenerator:
    def __init__(self):
        self.api_key = os.getenv("DASHSCOPE_API_KEY", "sk-bd2c58cc05844168bcf96bc07c2e81da")
        logger.info(f"初始化ImageToVideoGenerator，API密钥: {self.api_key[:20]}...")
        if not self.api_key:
            raise ValueError("请设置环境变量 DASHSCOPE_API_KEY")
    
    def create_async_task(self, prompt, image_base64, size="1920*1080"):
        """创建异步图片转视频任务"""
        logger.info(f"=== 开始创建图片转视频异步任务 ===")
        logger.info(f"提示词: {prompt}")
        logger.info(f"尺寸: {size}")
        logger.info(f"图片数据长度: {len(image_base64) if image_base64 else 0} 字符")
        logger.info(f"API密钥: {self.api_key[:20]}...")
        
        try:
            # 确保图片是base64格式
            if not image_base64.startswith('data:image/'):
                # 如果没有data URI前缀，假设是纯base64，添加PNG前缀
                img_url = f"data:image/png;base64,{image_base64}"
            else:
                img_url = image_base64
            
            logger.info("调用 VideoSynthesis.async_call for image to video")
            rsp = VideoSynthesis.async_call(
                api_key=self.api_key,
                model="wan2.2-i2v-plus",
                prompt=prompt,
                resolution="1080P",  # 注意：image to video使用resolution而不是size
                img_url=img_url
            )
            
            logger.info(f"API响应状态码: {rsp.status_code}")
            logger.info(f"API响应完整内容: {rsp}")
            
            if hasattr(rsp, 'output'):
                logger.info(f"响应输出: {rsp.output}")
            if hasattr(rsp, 'message'):
                logger.info(f"响应消息: {rsp.message}")
            if hasattr(rsp, 'code'):
                logger.info(f"响应代码: {rsp.code}")
            
            if rsp.status_code == HTTPStatus.OK:
                task_id = rsp.output.task_id if hasattr(rsp.output, 'task_id') else None
                task_status = rsp.output.task_status if hasattr(rsp.output, 'task_status') else None
                
                logger.info(f"图片转视频任务创建成功 - 任务ID: {task_id}, 状态: {task_status}")
                
                return {
                    "success": True,
                    "task_id": task_id,
                    "task_status": task_status,
                    "task_object": rsp,  # 返回完整的响应对象
                    "message": "图片转视频任务创建成功"
                }
            else:
                error_msg = f"创建图片转视频任务失败: {rsp.message if hasattr(rsp, 'message') else '未知错误'}"
                logger.error(error_msg)
                return {
                    "success": False,
                    "error": error_msg,
                    "status_code": rsp.status_code,
                    "response_detail": str(rsp)
                }
        except Exception as e:
            error_msg = f"创建图片转视频任务异常: {str(e)}"
            logger.error(error_msg)
            logger.exception("详细异常信息:")
            return {
                "success": False,
                "error": error_msg,
                "exception_type": type(e).__name__
            }
    
    def wait_and_get_result(self, task_result):
        """等待图片转视频任务完成并获取结果"""
        logger.info(f"=== 开始等待图片转视频任务完成 ===")
        
        try:
            # 使用原始的task对象，而不是重新构造
            task_object = task_result.get("task_object")
            if not task_object:
                logger.error("没有找到有效的task对象")
                return {
                    "success": False,
                    "error": "没有找到有效的task对象"
                }
            
            logger.info(f"使用task对象等待图片转视频结果: {task_object}")
            logger.info("调用 VideoSynthesis.wait")
            logger.info(f"传递API密钥: {self.api_key[:20]}...")
            
            rsp = VideoSynthesis.wait(task_object, api_key=self.api_key)
            
            logger.info(f"等待图片转视频结果响应状态码: {rsp.status_code}")
            logger.info(f"等待图片转视频结果响应完整内容: {rsp}")
            
            if rsp.status_code == HTTPStatus.OK:
                logger.info("图片转视频任务完成成功，开始处理结果")
                
                video_url = rsp.output.video_url if hasattr(rsp.output, 'video_url') else None
                task_status = rsp.output.task_status if hasattr(rsp.output, 'task_status') else 'UNKNOWN'
                orig_prompt = rsp.output.orig_prompt if hasattr(rsp.output, 'orig_prompt') else None
                actual_prompt = rsp.output.actual_prompt if hasattr(rsp.output, 'actual_prompt') else None
                
                # 获取使用统计信息
                usage_info = {}
                if hasattr(rsp, 'usage') and rsp.usage:
                    usage_info = {
                        'video_count': rsp.usage.video_count if hasattr(rsp.usage, 'video_count') else 1,
                        'video_duration': rsp.usage.video_duration if hasattr(rsp.usage, 'video_duration') else 5,
                        'video_ratio': rsp.usage.video_ratio if hasattr(rsp.usage, 'video_ratio') else '1920*1080'
                    }
                
                logger.info(f"最终图片转视频任务状态: {task_status}")
                logger.info(f"视频URL: {video_url}")
                
                return {
                    "success": True,
                    "video_url": video_url,
                    "task_status": task_status,
                    "orig_prompt": orig_prompt,
                    "actual_prompt": actual_prompt,
                    "usage": usage_info
                }
            else:
                error_msg = f"获取图片转视频结果失败: {rsp.message if hasattr(rsp, 'message') else '未知错误'}"
                logger.error(error_msg)
                return {
                    "success": False,
                    "error": error_msg,
                    "status_code": rsp.status_code,
                    "response_detail": str(rsp)
                }
        except Exception as e:
            error_msg = f"获取图片转视频结果异常: {str(e)}"
            logger.error(error_msg)
            logger.exception("详细异常信息:")
            return {
                "success": False,
                "error": error_msg,
                "exception_type": type(e).__name__
            }
    
    def fetch_task_status(self, task_id):
        """获取图片转视频任务状态"""
        logger.info(f"=== 查询图片转视频任务状态 ===")
        logger.info(f"任务ID: {task_id}")
        
        try:
            # 直接使用HTTP请求调用阿里云API
            import requests
            
            url = "https://dashscope.aliyuncs.com/api/v1/tasks/{}".format(task_id)
            headers = {
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json"
            }
            
            logger.info(f"请求URL: {url}")
            logger.info(f"请求头: {headers}")
            
            response = requests.get(url, headers=headers)
            
            logger.info(f"响应状态码: {response.status_code}")
            logger.info(f"响应内容: {response.text}")
            
            if response.status_code == 200:
                result = response.json()
                output = result.get('output', {})
                
                task_status = output.get('task_status', 'UNKNOWN')
                video_url = output.get('video_url', '')
                orig_prompt = output.get('orig_prompt', '')
                actual_prompt = output.get('actual_prompt', '')
                
                # 使用信息
                usage = result.get('usage', {})
                usage_info = {
                    'video_count': usage.get('video_count', 1),
                    'video_duration': usage.get('video_duration', 5),
                    'video_ratio': usage.get('video_ratio', '1920*1080')
                }
                
                logger.info(f"图片转视频任务状态查询成功: {task_status}")
                
                return {
                    "success": True,
                    "task_status": task_status,
                    "task_id": task_id,
                    "video_url": video_url,
                    "orig_prompt": orig_prompt,
                    "actual_prompt": actual_prompt,
                    "usage": usage_info
                }
            else:
                error_msg = f"获取图片转视频状态失败: HTTP {response.status_code} - {response.text}"
                logger.error(error_msg)
                return {
                    "success": False,
                    "error": error_msg,
                    "status_code": response.status_code
                }
        except Exception as e:
            error_msg = f"获取图片转视频状态异常: {str(e)}"
            logger.error(error_msg)
            logger.exception("详细异常信息:")
            return {
                "success": False,
                "error": error_msg,
                "exception_type": type(e).__name__
            }

# 全局生成器实例
generator = None
video_generator = None
image_to_video_generator = None

try:
    logger.info("=== 初始化应用 ===")
    generator = ImageGenerator()
    logger.info("ImageGenerator 初始化成功")
    
    video_generator = VideoGenerator()
    logger.info("VideoGenerator 初始化成功")
    
    image_to_video_generator = ImageToVideoGenerator()
    logger.info("ImageToVideoGenerator 初始化成功")
except ValueError as e:
    logger.error(f"生成器初始化失败: {e}")
    generator = None
    video_generator = None

# 用户认证API路由
@app.route('/api/send-verification-code', methods=['POST'])
def send_verification_code():
    """发送邮箱验证码"""
    try:
        data = request.get_json()
        
        if not data or not data.get('email'):
            return jsonify({
                "success": False,
                "message": "Email is required"
            }), 400
        
        email = data.get('email').strip().lower()
        
        # 简单邮箱验证
        if '@' not in email or '.' not in email:
            return jsonify({
                "success": False,
                "message": "Invalid email format"
            }), 400
        
        # 检查邮箱是否已注册
        existing_user = user_db.get_user_by_email(email)
        if existing_user:
            return jsonify({
                "success": False,
                "message": "Email already registered"
            }), 400
        
        # 发送验证码
        result = email_service.send_verification_code(email)
        
        if result['success']:
            logger.info(f"验证码发送成功: {email}")
            return jsonify({
                "success": True,
                "message": result['message'],
                "expires_in_minutes": result['expires_in_minutes']
            })
        else:
            logger.warning(f"验证码发送失败: {email}, 原因: {result['message']}")
            return jsonify({
                "success": False,
                "message": result['message']
            }), 400
        
    except Exception as e:
        logger.error(f"发送验证码异常: {str(e)}")
        return jsonify({
            "success": False,
            "message": "Failed to send verification code"
        }), 500

@app.route('/api/verify-email-code', methods=['POST'])
def verify_email_code():
    """验证邮箱验证码"""
    try:
        data = request.get_json()
        
        if not data or not data.get('email') or not data.get('code'):
            return jsonify({
                "success": False,
                "message": "Email and verification code are required"
            }), 400
        
        email = data.get('email').strip().lower()
        code = data.get('code').strip()
        
        # 验证验证码
        result = email_service.verify_code(email, code)
        
        if result['success']:
            logger.info(f"邮箱验证成功: {email}")
        else:
            logger.warning(f"邮箱验证失败: {email}, 原因: {result['message']}")
        
        return jsonify(result)
        
    except Exception as e:
        logger.error(f"验证邮箱验证码异常: {str(e)}")
        return jsonify({
            "success": False,
            "message": "Failed to verify code"
        }), 500

@app.route('/api/register', methods=['POST'])
def register():
    """用户注册"""
    try:
        data = request.get_json()
        
        if not data or not data.get('email') or not data.get('password') or not data.get('verification_code'):
            return jsonify({
                "success": False,
                "message": "Email, password and verification code are required"
            }), 400
        
        email = data.get('email').strip().lower()
        password = data.get('password')
        verification_code = data.get('verification_code').strip()
        
        # 简单邮箱验证
        if '@' not in email or '.' not in email:
            return jsonify({
                "success": False,
                "message": "Invalid email format"
            }), 400
        
        # 密码长度检查
        if len(password) < 6:
            return jsonify({
                "success": False,
                "message": "Password must be at least 6 characters long"
            }), 400
        
        # 验证邮箱验证码
        verification_result = email_service.verify_code(email, verification_code)
        if not verification_result['success']:
            return jsonify({
                "success": False,
                "message": f"Email verification failed: {verification_result['message']}"
            }), 400
        
        # 创建用户
        user_id = user_db.create_user(email, password)
        
        # 生成JWT token
        access_token = create_access_token(identity=str(user_id))
        
        # 获取用户信息
        user_info = user_db.get_user_by_id(user_id)
        
        logger.info(f"用户注册成功: {email}")
        
        return jsonify({
            "success": True,
            "message": "Registration successful",
            "access_token": access_token,
            "user": user_info
        })
        
    except ValueError as e:
        logger.warning(f"注册失败: {str(e)}")
        return jsonify({
            "success": False,
            "message": str(e)
        }), 400
    except Exception as e:
        logger.error(f"注册异常: {str(e)}")
        return jsonify({
            "success": False,
            "message": "Registration failed"
        }), 500

@app.route('/api/login', methods=['POST'])
def login():
    """用户登录"""
    try:
        data = request.get_json()
        
        if not data or not data.get('email') or not data.get('password'):
            return jsonify({
                "success": False,
                "message": "Email and password are required"
            }), 400
        
        email = data.get('email').strip().lower()
        password = data.get('password')
        
        # 验证用户
        user = user_db.verify_user(email, password)
        
        if not user:
            return jsonify({
                "success": False,
                "message": "Invalid email or password"
            }), 401
        
        # 生成JWT token - JWT identity必须是字符串
        access_token = create_access_token(identity=str(user['id']))
        
        logger.info(f"用户登录成功: {email}")
        
        return jsonify({
            "success": True,
            "message": "Login successful",
            "access_token": access_token,
            "user": user
        })
        
    except Exception as e:
        logger.error(f"登录异常: {str(e)}")
        return jsonify({
            "success": False,
            "message": "Login failed"
        }), 500

@app.route('/api/user/info', methods=['GET'])
@jwt_required()
def get_user_info():
    """获取用户信息"""
    try:
        user_id = int(get_jwt_identity())  # 将字符串转换回整数
        user_info = user_db.get_user_by_id(user_id)
        
        if not user_info:
            return jsonify({
                "success": False,
                "message": "User not found"
            }), 404
        
        return jsonify({
            "success": True,
            "user": user_info
        })
        
    except Exception as e:
        logger.error(f"获取用户信息异常: {str(e)}")
        return jsonify({
            "success": False,
            "message": "Failed to get user info"
        }), 500

@app.route('/api/user/check-trial', methods=['GET'])
@jwt_required()
def check_trial():
    """检查用户试用状态"""
    try:
        user_id = int(get_jwt_identity())  # 将字符串转换回整数
        trial_status = user_db.check_trial_status(user_id)
        
        return jsonify({
            "success": True,
            **trial_status
        })
        
    except Exception as e:
        logger.error(f"检查试用状态异常: {str(e)}")
        return jsonify({
            "success": False,
            "message": "Failed to check trial status"
        }), 500

@app.route('/api/user/use-trial', methods=['POST'])
@jwt_required()
def use_trial():
    """使用试用次数"""
    try:
        user_id = int(get_jwt_identity())  # 将字符串转换回整数
        data = request.get_json()
        demo_type = data.get('demo_type', 'image_generation') if data else 'image_generation'
        
        result = user_db.use_trial(user_id, demo_type)
        
        return jsonify({
            "success": True,
            "message": "Trial used successfully",
            **result
        })
        
    except ValueError as e:
        logger.warning(f"使用试用次数失败: {str(e)}")
        return jsonify({
            "success": False,
            "message": str(e)
        }), 400
    except Exception as e:
        logger.error(f"使用试用次数异常: {str(e)}")
        return jsonify({
            "success": False,
            "message": "Failed to use trial"
        }), 500

@app.route('/api/health', methods=['GET'])
def health_check():
    """健康检查接口"""
    logger.info("收到健康检查请求")
    result = {
        "status": "healthy",
        "api_key_configured": generator is not None
    }
    logger.info(f"健康检查响应: {result}")
    return jsonify(result)

@app.route('/api/generate', methods=['POST'])
@jwt_required()
def generate_image():
    """图片生成接口"""
    logger.info("=== 收到图片生成请求 ===")
    
    if not generator:
        error_msg = "API密钥未配置，请设置环境变量 DASHSCOPE_API_KEY"
        logger.error(error_msg)
        return jsonify({
            "success": False,
            "error": error_msg
        }), 500
    
    try:
        # 获取当前用户ID
        current_user_id = int(get_jwt_identity())
        logger.info(f"当前用户ID: {current_user_id}")
        
        data = request.get_json()
        logger.info(f"请求数据: {data}")
        
        if not data:
            error_msg = "请提供JSON格式的请求数据"
            logger.error(error_msg)
            return jsonify({
                "success": False,
                "error": error_msg
            }), 400
        
        prompt = data.get('prompt', '').strip()
        if not prompt:
            error_msg = "请提供提示词"
            logger.error(error_msg)
            return jsonify({
                "success": False,
                "error": error_msg
            }), 400
        
        # 获取会话ID，如果没有提供则创建新会话
        conversation_id = data.get('conversation_id')
        if not conversation_id:
            conversation_id = user_db.create_conversation(current_user_id)
            logger.info(f"创建新会话: {conversation_id}")
        else:
            # 验证会话是否属于当前用户
            try:
                user_conversations = user_db.get_user_conversations(current_user_id)
                valid_conversation = any(conv['id'] == conversation_id for conv in user_conversations)
                if not valid_conversation:
                    return jsonify({
                        "success": False,
                        "error": "无效的会话ID"
                    }), 400
            except Exception as e:
                logger.error(f"验证会话失败: {e}")
                return jsonify({
                    "success": False,
                    "error": "会话验证失败"
                }), 400
        
        # 检查并使用试用次数
        try:
            trial_result = user_db.use_trial(current_user_id)
            logger.info(f"试用次数使用结果: {trial_result}")
        except ValueError as e:
            return jsonify({
                "success": False,
                "error": str(e)
            }), 400
        
        # 处理尺寸参数，将前端格式转换为API格式
        ratio = data.get('ratio', '1:1')
        size_mapping = {
            '1:1': '1024*1024',
            '16:9': '1344*768',
            '9:16': '768*1344',
            '4:3': '1152*896',
            '3:4': '896*1152'
        }
        size = size_mapping.get(ratio, '1024*1024')
        
        # 处理图片数量参数
        count = data.get('count', 1)
        try:
            count = int(count)
            if count < 1 or count > 4:
                count = 1
        except (ValueError, TypeError):
            count = 1
        
        logger.info(f"转换后的参数 - 提示词: {prompt}, 比例: {ratio}, 尺寸: {size}, 数量: {count}")
        
        # 创建异步任务
        task_result = generator.create_async_task(prompt, size, count)
        logger.info(f"任务创建结果: {task_result}")
        
        if not task_result["success"]:
            logger.error(f"任务创建失败: {task_result}")
            return jsonify(task_result), 400
        
        # 等待任务完成并获取结果
        result = generator.wait_and_get_result(task_result)
        logger.info(f"最终结果: {result}")
        
        # 如果生成成功，保存到会话历史
        if result.get("success") and result.get("images"):
            try:
                # 为每张图片保存历史记录
                for image in result["images"]:
                    user_db.save_image_history(
                        conversation_id=conversation_id,
                        user_id=current_user_id,
                        prompt=prompt,
                        image_url=image.get("url", ""),
                        image_base64=image.get("base64", ""),
                        aspect_ratio=ratio,
                        image_count=count
                    )
                
                # 在返回结果中包含会话ID
                result["conversation_id"] = conversation_id
                result["remaining_trials"] = trial_result.get("remaining_trials", 0)
                
                logger.info(f"图片历史保存成功，会话: {conversation_id}")
            except Exception as e:
                logger.error(f"保存图片历史失败: {e}")
                # 不影响图片生成结果，只记录错误
        
        return jsonify(result)
        
    except Exception as e:
        error_msg = f"服务器内部错误: {str(e)}"
        logger.error(error_msg)
        logger.exception("详细异常信息:")
        return jsonify({
            "success": False,
            "error": error_msg,
            "exception_type": type(e).__name__
        }), 500

@app.route('/api/status/<task_id>', methods=['GET'])
def get_task_status(task_id):
    """获取任务状态接口"""
    logger.info(f"收到任务状态查询请求: {task_id}")
    
    if not generator:
        error_msg = "API密钥未配置"
        logger.error(error_msg)
        return jsonify({
            "success": False,
            "error": error_msg
        }), 500
    
    try:
        result = generator.fetch_task_status(task_id)
        logger.info(f"状态查询结果: {result}")
        return jsonify(result)
    except Exception as e:
        error_msg = f"获取状态失败: {str(e)}"
        logger.error(error_msg)
        logger.exception("详细异常信息:")
        return jsonify({
            "success": False,
            "error": error_msg,
            "exception_type": type(e).__name__
        }), 500

@app.route('/api/ratios', methods=['GET'])
def get_supported_ratios():
    """获取支持的图片比例"""
    logger.info("收到支持比例查询请求")
    ratios = [
        {"value": "1:1", "label": "Square (1:1)", "size": "1024*1024"},
        {"value": "16:9", "label": "Landscape (16:9)", "size": "1344*768"},
        {"value": "9:16", "label": "Portrait (9:16)", "size": "768*1344"},
        {"value": "4:3", "label": "Classic (4:3)", "size": "1152*896"},
        {"value": "3:4", "label": "Portrait (3:4)", "size": "896*1152"}
    ]
    result = {
        "success": True,
        "ratios": ratios
    }
    logger.info(f"支持比例响应: {result}")
    return jsonify(result)

# ===== 会话管理API =====

@app.route('/api/conversations', methods=['GET'])
@jwt_required()
def get_conversations():
    """获取用户的所有会话"""
    try:
        current_user_id = int(get_jwt_identity())
        conversations = user_db.get_user_conversations(current_user_id)
        
        return jsonify({
            "success": True,
            "conversations": conversations
        })
    except Exception as e:
        logger.error(f"获取会话列表失败: {e}")
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500

@app.route('/api/conversations', methods=['POST'])
@jwt_required()
def create_conversation():
    """创建新会话"""
    try:
        current_user_id = int(get_jwt_identity())
        data = request.get_json()
        title = data.get('title') if data else None
        
        conversation_id = user_db.create_conversation(current_user_id, title)
        
        return jsonify({
            "success": True,
            "conversation_id": conversation_id,
            "message": "会话创建成功"
        })
    except Exception as e:
        logger.error(f"创建会话失败: {e}")
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500

@app.route('/api/conversations/<int:conversation_id>', methods=['PUT'])
@jwt_required()
def update_conversation(conversation_id):
    """更新会话标题"""
    try:
        current_user_id = int(get_jwt_identity())
        data = request.get_json()
        
        if not data or not data.get('title'):
            return jsonify({
                "success": False,
                "error": "请提供会话标题"
            }), 400
        
        title = data.get('title').strip()
        user_db.update_conversation_title(conversation_id, current_user_id, title)
        
        return jsonify({
            "success": True,
            "message": "会话标题更新成功"
        })
    except ValueError as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 404
    except Exception as e:
        logger.error(f"更新会话标题失败: {e}")
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500

@app.route('/api/conversations/<int:conversation_id>', methods=['DELETE'])
@jwt_required()
def delete_conversation(conversation_id):
    """删除会话"""
    try:
        current_user_id = int(get_jwt_identity())
        user_db.delete_conversation(conversation_id, current_user_id)
        
        return jsonify({
            "success": True,
            "message": "会话删除成功"
        })
    except ValueError as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 404
    except Exception as e:
        logger.error(f"删除会话失败: {e}")
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500

@app.route('/api/conversations/<int:conversation_id>/history', methods=['GET'])
@jwt_required()
def get_conversation_history(conversation_id):
    """获取会话的图片和视频历史"""
    try:
        current_user_id = int(get_jwt_identity())
        
        # 获取分页参数
        limit = int(request.args.get('limit', 50))
        offset = int(request.args.get('offset', 0))
        
        history = user_db.get_conversation_history(conversation_id, current_user_id, limit, offset)
        
        return jsonify({
            "success": True,
            "history": history,
            "conversation_id": conversation_id
        })
    except ValueError as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 404
    except Exception as e:
        logger.error(f"获取会话历史失败: {e}")
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500

@app.errorhandler(413)
def too_large(e):
    logger.warning("请求数据过大")
    return jsonify({
        "success": False,
        "error": "请求数据过大"
    }), 413

@app.errorhandler(404)
def not_found(e):
    logger.warning(f"接口不存在: {request.path}")
    return jsonify({
        "success": False,
        "error": "接口不存在"
    }), 404

# ===== 视频生成API接口 =====

@app.route('/api/generate-video', methods=['POST'])
@jwt_required()
def generate_video():
    """视频生成接口"""
    try:
        if not video_generator:
            logger.error("VideoGenerator 未初始化")
            return jsonify({
                "success": False,
                "error": "视频生成服务未初始化"
            }), 500
        
        current_user_id = int(get_jwt_identity())
        data = request.get_json()
        
        if not data or not data.get('prompt'):
            return jsonify({
                "success": False,
                "error": "缺少必要参数: prompt"
            }), 400
        
        prompt = data.get('prompt', '').strip()
        size = data.get('size', '1920*1080')
        conversation_id = data.get('conversation_id')
        
        if not prompt:
            return jsonify({
                "success": False,
                "error": "提示词不能为空"
            }), 400
        
        # 检查试用次数
        trial_result = user_db.use_trial(current_user_id, 'video_generation')
        if not trial_result['success']:
            return jsonify({
                "success": False,
                "error": "试用次数不足",
                "remaining_trials": 0
            }), 403
        
        logger.info(f"用户 {current_user_id} 开始视频生成 - 提示词: {prompt[:50]}...")
        
        # 创建视频生成任务
        task_result = video_generator.create_async_task(prompt, size)
        
        if not task_result['success']:
            # 如果任务创建失败，恢复试用次数（可选实现）
            logger.error(f"视频任务创建失败: {task_result.get('error')}")
            return jsonify({
                "success": False,
                "error": task_result.get('error', '视频任务创建失败'),
                "remaining_trials": trial_result['remaining_trials']
            }), 500
        
        logger.info(f"视频任务创建成功 - 任务ID: {task_result['task_id']}")
        
        # 存储任务ID到会话ID的映射
        if conversation_id:
            task_conversation_mapping[task_result['task_id']] = conversation_id
            logger.debug(f"存储任务映射: {task_result['task_id']} -> {conversation_id}")
        
        return jsonify({
            "success": True,
            "task_id": task_result['task_id'],
            "task_status": task_result['task_status'],
            "message": "视频生成任务已创建，请使用 /api/video-status/{task_id} 查询进度",
            "remaining_trials": trial_result['remaining_trials'],
            "is_admin": trial_result['is_admin'],
            "conversation_id": conversation_id
        })
        
    except ValueError as e:
        logger.warning(f"视频生成参数错误: {str(e)}")
        return jsonify({
            "success": False,
            "error": str(e)
        }), 400
    except Exception as e:
        logger.error(f"视频生成异常: {str(e)}")
        return jsonify({
            "success": False,
            "error": "视频生成失败"
        }), 500

@app.route('/api/video-status/<task_id>', methods=['GET'])
@jwt_required()
def get_video_status(task_id):
    """获取视频生成任务状态"""
    try:
        if not video_generator:
            logger.error("VideoGenerator 未初始化")
            return jsonify({
                "success": False,
                "error": "视频生成服务未初始化"
            }), 500
        
        current_user_id = int(get_jwt_identity())
        
        if not task_id:
            return jsonify({
                "success": False,
                "error": "缺少任务ID"
            }), 400
        
        logger.info(f"用户 {current_user_id} 查询视频任务状态: {task_id}")
        
        # 获取任务状态
        status_result = video_generator.fetch_task_status(task_id)
        
        if not status_result['success']:
            logger.error(f"获取视频任务状态失败: {status_result.get('error')}")
            return jsonify({
                "success": False,
                "error": status_result.get('error', '获取任务状态失败')
            }), 500
        
        # 如果任务已完成，返回完整结果
        if status_result['task_status'] == 'SUCCEEDED':
            logger.info(f"视频任务 {task_id} 已完成")
            
            # 自动保存到数据库
            try:
                # 从请求或session中获取conversation_id（这里需要改进）
                # 暂时可以从视频历史记录中查找是否已存在
                video_url = status_result.get('video_url')
                orig_prompt = status_result.get('orig_prompt', '')
                actual_prompt = status_result.get('actual_prompt', '')
                usage_info = status_result.get('usage', {})
                
                # 检查是否已经保存过
                connection = user_db.get_connection()
                cursor = connection.cursor(dictionary=True)
                cursor.execute("""
                    SELECT id FROM video_history 
                    WHERE user_id = %s AND task_id = %s
                """, (current_user_id, task_id))
                
                existing_record = cursor.fetchone()
                
                if not existing_record and video_url:
                    # 获取conversation_id：首先从映射中获取，然后从最近会话获取，最后创建新会话
                    target_conversation_id = task_conversation_mapping.get(task_id)
                    
                    if not target_conversation_id:
                        # 从最近的会话获取
                        cursor.execute("""
                            SELECT id FROM conversations 
                            WHERE user_id = %s 
                            ORDER BY created_at DESC 
                            LIMIT 1
                        """, (current_user_id,))
                        
                        recent_conversation = cursor.fetchone()
                        
                        if recent_conversation:
                            target_conversation_id = recent_conversation['id']
                        else:
                            # 创建新会话
                            cursor.execute("""
                                INSERT INTO conversations (user_id, title, created_at)
                                VALUES (%s, %s, NOW())
                            """, (current_user_id, f"Video Generation - {datetime.now().strftime('%Y-%m-%d %H:%M')}"))
                            target_conversation_id = cursor.lastrowid
                    
                    # 如果没有保存过且有视频URL，则保存（包含所有必需字段）
                    cursor.execute("""
                        INSERT INTO video_history 
                        (conversation_id, user_id, prompt, video_url, size, duration, orig_prompt, actual_prompt, usage_info, task_id, created_at)
                        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, NOW())
                    """, (
                        target_conversation_id,
                        current_user_id,
                        orig_prompt or actual_prompt or 'Video generation',  # prompt字段必需
                        video_url,
                        '1920*1080',  # 默认尺寸
                        5,  # 默认时长
                        orig_prompt,
                        actual_prompt,
                        json.dumps(usage_info) if usage_info else None,
                        task_id
                    ))
                    connection.commit()
                    logger.info(f"视频记录已自动保存到数据库 - 任务ID: {task_id}, 会话ID: {target_conversation_id}")
                    
                    # 清理映射（任务完成后不再需要）
                    if task_id in task_conversation_mapping:
                        del task_conversation_mapping[task_id]
                    logger.info(f"视频记录已自动保存到数据库 - 任务ID: {task_id}")
                
                cursor.close()
                connection.close()
                
            except Exception as save_error:
                logger.error(f"自动保存视频记录失败: {str(save_error)}")
                # 不影响状态查询的返回，只记录错误
            
            return jsonify({
                "success": True,
                "task_id": task_id,
                "task_status": status_result['task_status'],
                "video_url": status_result.get('video_url'),
                "orig_prompt": status_result.get('orig_prompt'),
                "actual_prompt": status_result.get('actual_prompt'),
                "usage": status_result.get('usage', {}),
                "message": "视频生成完成"
            })
        elif status_result['task_status'] in ['FAILED', 'ERROR']:
            logger.error(f"视频任务 {task_id} 失败")
            
            # 清理映射（任务失败后不再需要）
            if task_id in task_conversation_mapping:
                del task_conversation_mapping[task_id]
                
            return jsonify({
                "success": False,
                "task_id": task_id,
                "task_status": status_result['task_status'],
                "error": "视频生成失败"
            }), 500
        else:
            # 任务进行中
            logger.info(f"视频任务 {task_id} 进行中，状态: {status_result['task_status']}")
            return jsonify({
                "success": True,
                "task_id": task_id,
                "task_status": status_result['task_status'],
                "message": "视频生成中，请稍候..."
            })
            
    except Exception as e:
        logger.error(f"获取视频状态异常: {str(e)}")
        return jsonify({
            "success": False,
            "error": "获取任务状态失败"
        }), 500

@app.route('/api/save-video', methods=['POST'])
@jwt_required()
def save_video():
    """保存视频到会话历史"""
    try:
        current_user_id = int(get_jwt_identity())
        data = request.get_json()
        
        if not data or not data.get('conversation_id') or not data.get('prompt') or not data.get('video_url'):
            return jsonify({
                "success": False,
                "error": "缺少必要参数: conversation_id, prompt, video_url"
            }), 400
        
        conversation_id = data.get('conversation_id')
        prompt = data.get('prompt')
        video_url = data.get('video_url')
        size = data.get('size', '1920*1080')
        duration = data.get('duration', 5)
        
        # 新增字段
        orig_prompt = data.get('orig_prompt')
        actual_prompt = data.get('actual_prompt')
        usage_info = data.get('usage')
        task_id = data.get('task_id')
        
        logger.info(f"用户 {current_user_id} 保存视频历史 - 会话: {conversation_id}, 任务: {task_id}")
        
        # 保存视频历史
        history_id = user_db.save_video_history(
            conversation_id=conversation_id,
            user_id=current_user_id,
            prompt=prompt,
            video_url=video_url,
            size=size,
            duration=duration,
            orig_prompt=orig_prompt,
            actual_prompt=actual_prompt,
            usage_info=usage_info,
            task_id=task_id
        )
        
        return jsonify({
            "success": True,
            "history_id": history_id,
            "message": "视频历史保存成功"
        })
        
    except ValueError as e:
        logger.warning(f"保存视频历史参数错误: {str(e)}")
        return jsonify({
            "success": False,
            "error": str(e)
        }), 400
    except Exception as e:
        logger.error(f"保存视频历史异常: {str(e)}")
        return jsonify({
            "success": False,
            "error": "保存视频历史失败"
        }), 500

@app.route('/api/generate-image-to-video', methods=['POST'])
@jwt_required()
def generate_image_to_video():
    """图片转视频生成接口"""
    try:
        if not image_to_video_generator:
            logger.error("ImageToVideoGenerator 未初始化")
            return jsonify({
                "success": False,
                "error": "图片转视频生成服务未初始化"
            }), 500
        
        current_user_id = int(get_jwt_identity())
        data = request.get_json()
        
        if not data or not data.get('prompt') or not data.get('image_base64'):
            return jsonify({
                "success": False,
                "error": "缺少必要参数: prompt, image_base64"
            }), 400
        
        prompt = data.get('prompt', '').strip()
        image_base64 = data.get('image_base64', '').strip()
        size = data.get('size', '1920*1080')
        conversation_id = data.get('conversation_id')
        
        if not prompt:
            return jsonify({
                "success": False,
                "error": "提示词不能为空"
            }), 400
        
        if not image_base64:
            return jsonify({
                "success": False,
                "error": "图片数据不能为空"
            }), 400
        
        # 检查试用次数
        trial_result = user_db.use_trial(current_user_id, 'video_generation')
        if not trial_result['success']:
            return jsonify({
                "success": False,
                "error": "试用次数不足",
                "remaining_trials": 0
            }), 403
        
        logger.info(f"用户 {current_user_id} 开始图片转视频生成 - 提示词: {prompt[:50]}...")
        
        # 创建图片转视频生成任务
        task_result = image_to_video_generator.create_async_task(prompt, image_base64, size)
        
        if not task_result['success']:
            # 如果任务创建失败，恢复试用次数（可选实现）
            logger.error(f"图片转视频任务创建失败: {task_result.get('error')}")
            return jsonify({
                "success": False,
                "error": task_result.get('error', '图片转视频任务创建失败'),
                "remaining_trials": trial_result['remaining_trials']
            }), 500
        
        logger.info(f"图片转视频任务创建成功 - 任务ID: {task_result['task_id']}")
        
        # 存储任务ID到会话ID的映射
        if conversation_id:
            task_conversation_mapping[task_result['task_id']] = conversation_id
            logger.debug(f"存储图片转视频任务映射: {task_result['task_id']} -> {conversation_id}")
        
        # 存储完整的任务信息，用于任务完成时保存历史记录
        image_to_video_task_mapping[task_result['task_id']] = {
            'user_id': current_user_id,
            'conversation_id': conversation_id,
            'prompt': prompt,
            'image_base64': image_base64,
            'size': size,
            'submit_time': datetime.now().isoformat()
        }
        logger.debug(f"存储图片转视频任务详细信息: {task_result['task_id']}")
        
        return jsonify({
            "success": True,
            "task_id": task_result['task_id'],
            "task_status": task_result['task_status'],
            "message": "图片转视频生成任务已创建，请使用 /api/image-to-video-status/{task_id} 查询进度",
            "remaining_trials": trial_result['remaining_trials'],
            "is_admin": trial_result['is_admin'],
            "conversation_id": conversation_id
        })
        
    except ValueError as e:
        logger.warning(f"图片转视频生成参数错误: {str(e)}")
        return jsonify({
            "success": False,
            "error": str(e)
        }), 400
    except Exception as e:
        logger.error(f"图片转视频生成异常: {str(e)}")
        return jsonify({
            "success": False,
            "error": "图片转视频生成失败"
        }), 500

@app.route('/api/image-to-video-status/<task_id>', methods=['GET'])
@jwt_required()
def get_image_to_video_status(task_id):
    """获取图片转视频生成任务状态"""
    try:
        if not image_to_video_generator:
            logger.error("ImageToVideoGenerator 未初始化")
            return jsonify({
                "success": False,
                "error": "图片转视频生成服务未初始化"
            }), 500
        
        current_user_id = int(get_jwt_identity())
        
        logger.info(f"用户 {current_user_id} 查询图片转视频任务状态 - 任务ID: {task_id}")
        
        # 获取任务状态
        status_result = image_to_video_generator.fetch_task_status(task_id)
        
        if not status_result['success']:
            logger.error(f"获取图片转视频任务状态失败: {status_result.get('error')}")
            return jsonify({
                "success": False,
                "error": status_result.get('error', '获取任务状态失败')
            }), 500
        
        task_status = status_result['task_status']
        video_url = status_result.get('video_url', '')
        
        logger.info(f"图片转视频任务状态: {task_status}, 视频URL: {video_url}")
        
        response_data = {
            "success": True,
            "task_id": task_id,
            "task_status": task_status,
            "video_url": video_url
        }
        
        # 如果任务完成，包含额外信息
        if task_status == 'SUCCEEDED' and video_url:
            response_data.update({
                "orig_prompt": status_result.get('orig_prompt', ''),
                "actual_prompt": status_result.get('actual_prompt', ''),
                "usage": status_result.get('usage', {})
            })
            
            # 自动保存到历史记录
            task_info = image_to_video_task_mapping.get(task_id)
            if task_info:
                try:
                    # 保存到image_to_video_history表
                    history_id = user_db.save_image_to_video_history(
                        conversation_id=task_info['conversation_id'],
                        user_id=task_info['user_id'],
                        prompt=task_info['prompt'],
                        image_base64=task_info['image_base64'],
                        video_url=video_url,
                        size=task_info['size'],
                        duration=status_result.get('usage', {}).get('video_duration', 5),
                        orig_prompt=status_result.get('orig_prompt', ''),
                        actual_prompt=status_result.get('actual_prompt', ''),
                        usage_info=status_result.get('usage', {}),
                        task_id=task_id
                    )
                    
                    logger.info(f"图片转视频历史记录保存成功，记录ID: {history_id}")
                    
                    # 清理临时存储的任务信息
                    del image_to_video_task_mapping[task_id]
                    
                except Exception as save_error:
                    logger.error(f"自动保存图片转视频历史失败: {save_error}")
            else:
                logger.warning(f"未找到任务 {task_id} 的详细信息，无法保存历史记录")
        
        return jsonify(response_data)
        
    except Exception as e:
        logger.error(f"获取图片转视频任务状态异常: {str(e)}")
        return jsonify({
            "success": False,
            "error": "获取任务状态失败"
        }), 500

@app.route('/api/save-image-to-video', methods=['POST'])
@jwt_required()
def save_image_to_video():
    """保存图片转视频到会话历史"""
    try:
        current_user_id = int(get_jwt_identity())
        data = request.get_json()
        
        if not data or not data.get('conversation_id') or not data.get('prompt') or not data.get('video_url') or not data.get('image_base64'):
            return jsonify({
                "success": False,
                "error": "缺少必要参数: conversation_id, prompt, video_url, image_base64"
            }), 400
        
        conversation_id = data.get('conversation_id')
        prompt = data.get('prompt')
        image_base64 = data.get('image_base64')
        video_url = data.get('video_url')
        size = data.get('size', '1920*1080')
        duration = data.get('duration', 5)
        
        # 新增字段
        orig_prompt = data.get('orig_prompt')
        actual_prompt = data.get('actual_prompt')
        usage_info = data.get('usage')
        task_id = data.get('task_id')
        
        logger.info(f"用户 {current_user_id} 保存图片转视频历史 - 会话: {conversation_id}, 任务: {task_id}")
        
        # 保存图片转视频历史
        history_id = user_db.save_image_to_video_history(
            conversation_id=conversation_id,
            user_id=current_user_id,
            prompt=prompt,
            image_base64=image_base64,
            video_url=video_url,
            size=size,
            duration=duration,
            orig_prompt=orig_prompt,
            actual_prompt=actual_prompt,
            usage_info=usage_info,
            task_id=task_id
        )
        
        return jsonify({
            "success": True,
            "history_id": history_id,
            "message": "图片转视频历史保存成功"
        })
        
    except ValueError as e:
        logger.warning(f"保存图片转视频历史参数错误: {str(e)}")
        return jsonify({
            "success": False,
            "error": str(e)
        }), 400
    except Exception as e:
        logger.error(f"保存图片转视频历史异常: {str(e)}")
        return jsonify({
            "success": False,
            "error": "保存图片转视频历史失败"
        }), 500

@app.route('/api/conversation/<int:conversation_id>/video-history', methods=['GET'])
@jwt_required()
def get_conversation_video_history(conversation_id):
    """获取会话的视频历史记录"""
    try:
        current_user_id = int(get_jwt_identity())
        
        # 获取查询参数
        limit = request.args.get('limit', 50, type=int)
        offset = request.args.get('offset', 0, type=int)
        
        # 限制查询数量
        limit = min(limit, 100)
        
        logger.info(f"用户 {current_user_id} 获取会话视频历史 - 会话: {conversation_id}")
        
        # 获取视频历史
        history = user_db.get_conversation_video_history(conversation_id, current_user_id, limit, offset)
        
        return jsonify({
            "success": True,
            "conversation_id": conversation_id,
            "history": history,
            "total_returned": len(history),
            "limit": limit,
            "offset": offset
        })
        
    except ValueError as e:
        logger.warning(f"获取视频历史参数错误: {str(e)}")
        return jsonify({
            "success": False,
            "error": str(e)
        }), 400
    except Exception as e:
        logger.error(f"获取视频历史异常: {str(e)}")
        return jsonify({
            "success": False,
            "error": "获取视频历史失败"
        }), 500

if __name__ == '__main__':
    logger.info("=== 启动AI文字作画API服务器 ===")
    logger.info(f"监听地址: {API_HOST}:{API_PORT}")
    logger.info(f"调试模式: {DEBUG_MODE}")
    logger.info(f"日志级别: {LOG_LEVEL}")
    logger.info("请确保已设置环境变量: DASHSCOPE_API_KEY")
    
    # 显示数据库配置
    logger.info(f"数据库配置: {MYSQL_CONFIG['host']}:{MYSQL_CONFIG['port']}/{MYSQL_CONFIG['database']}")
    
    logger.info("API文档:")
    logger.info("  POST /api/send-verification-code - 发送邮箱验证码")
    logger.info("  POST /api/verify-email-code - 验证邮箱验证码")
    logger.info("  POST /api/register - 用户注册")
    logger.info("  POST /api/login - 用户登录")
    logger.info("  GET  /api/user/info - 获取用户信息")
    logger.info("  GET  /api/user/check-trial - 检查试用状态")
    logger.info("  POST /api/user/use-trial - 使用试用次数")
    logger.info("  POST /api/generate - 生成图片")
    logger.info("  POST /api/generate-video - 生成视频")
    logger.info("  POST /api/generate-image-to-video - 图片转视频")
    logger.info("  GET  /api/status/<task_id> - 获取任务状态")
    logger.info("  GET  /api/video-status/<task_id> - 获取视频任务状态")
    logger.info("  GET  /api/image-to-video-status/<task_id> - 获取图片转视频任务状态")
    logger.info("  POST /api/save-video - 保存视频历史")
    logger.info("  POST /api/save-image-to-video - 保存图片转视频历史")
    logger.info("  GET  /api/ratios - 获取支持的比例")
    logger.info("  GET  /api/health - 健康检查")
    logger.info("日志文件: api_server.log")
    
    app.run(host=API_HOST, port=API_PORT, debug=DEBUG_MODE) 