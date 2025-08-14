#!/usr/bin/env python3
"""
数据库迁移管理器
支持版本控制的数据库结构更新
"""

import os
import json
import mysql.connector
from mysql.connector import Error
from datetime import datetime
import logging

logger = logging.getLogger(__name__)

class DatabaseMigration:
    """数据库迁移管理器"""
    
    def __init__(self, mysql_config):
        self.mysql_config = mysql_config
        self.migrations_table = 'schema_migrations'
        self.migrations_dir = os.path.join(os.path.dirname(__file__), 'migrations')
        
        # 确保migrations目录存在
        os.makedirs(self.migrations_dir, exist_ok=True)
        
    def get_connection(self):
        """获取数据库连接"""
        try:
            # 首先尝试连接到指定数据库
            connection = mysql.connector.connect(**self.mysql_config)
            return connection
        except mysql.connector.Error as e:
            if e.errno == mysql.connector.errorcode.ER_BAD_DB_ERROR:
                # 数据库不存在，创建数据库
                logger.info(f"数据库 {self.mysql_config['database']} 不存在，正在创建...")
                self.create_database()
                # 重新连接
                connection = mysql.connector.connect(**self.mysql_config)
                return connection
            else:
                logger.error(f"数据库连接失败: {e}")
                raise e
    
    def create_database(self):
        """创建数据库"""
        try:
            # 连接到MySQL服务器（不指定数据库）
            config_without_db = self.mysql_config.copy()
            database_name = config_without_db.pop('database')
            
            connection = mysql.connector.connect(**config_without_db)
            cursor = connection.cursor()
            
            # 创建数据库
            cursor.execute(f"""
                CREATE DATABASE IF NOT EXISTS `{database_name}` 
                CHARACTER SET utf8mb4 
                COLLATE utf8mb4_unicode_ci
            """)
            
            connection.commit()
            cursor.close()
            connection.close()
            
            logger.info(f"数据库 {database_name} 创建成功")
            
        except mysql.connector.Error as e:
            logger.error(f"创建数据库失败: {e}")
            raise e
    
    def init_migrations_table(self):
        """初始化迁移记录表"""
        try:
            conn = self.get_connection()
            cursor = conn.cursor()
            
            # 创建迁移记录表
            cursor.execute(f"""
                CREATE TABLE IF NOT EXISTS {self.migrations_table} (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    version VARCHAR(50) UNIQUE NOT NULL,
                    migration_name VARCHAR(255) NOT NULL,
                    executed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    INDEX idx_version (version)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            """)
            
            conn.commit()
            cursor.close()
            conn.close()
            
            logger.info("迁移记录表初始化成功")
            
        except Exception as e:
            logger.error(f"初始化迁移记录表失败: {e}")
            raise e
    
    def get_executed_migrations(self):
        """获取已执行的迁移版本"""
        try:
            conn = self.get_connection()
            cursor = conn.cursor()
            
            cursor.execute(f"SELECT version FROM {self.migrations_table} ORDER BY version")
            executed = [row[0] for row in cursor.fetchall()]
            
            cursor.close()
            conn.close()
            
            return executed
            
        except mysql.connector.Error as e:
            if "doesn't exist" in str(e):
                # 迁移表不存在，返回空列表
                return []
            raise e
    
    def record_migration(self, version, migration_name):
        """记录已执行的迁移"""
        try:
            conn = self.get_connection()
            cursor = conn.cursor()
            
            cursor.execute(f"""
                INSERT INTO {self.migrations_table} (version, migration_name) 
                VALUES (%s, %s)
            """, (version, migration_name))
            
            conn.commit()
            cursor.close()
            conn.close()
            
            logger.info(f"迁移记录已保存: {version} - {migration_name}")
            
        except Exception as e:
            logger.error(f"记录迁移失败: {e}")
            raise e
    
    def get_available_migrations(self):
        """获取可用的迁移文件"""
        migrations = []
        
        for filename in os.listdir(self.migrations_dir):
            if filename.endswith('.json'):
                version = filename.replace('.json', '')
                migration_path = os.path.join(self.migrations_dir, filename)
                
                try:
                    with open(migration_path, 'r', encoding='utf-8') as f:
                        migration_data = json.load(f)
                        migrations.append({
                            'version': version,
                            'name': migration_data.get('name', filename),
                            'description': migration_data.get('description', ''),
                            'sql': migration_data.get('sql', []),
                            'path': migration_path
                        })
                except Exception as e:
                    logger.warning(f"读取迁移文件失败 {filename}: {e}")
                    continue
        
        # 按版本排序
        migrations.sort(key=lambda x: x['version'])
        return migrations
    
    def execute_migration(self, migration):
        """执行单个迁移"""
        logger.info(f"执行迁移: {migration['version']} - {migration['name']}")
        
        try:
            conn = self.get_connection()
            cursor = conn.cursor()
            
            # 执行SQL语句
            for sql_statement in migration['sql']:
                if sql_statement.strip():
                    logger.debug(f"执行SQL: {sql_statement[:100]}...")
                    cursor.execute(sql_statement)
            
            conn.commit()
            cursor.close()
            conn.close()
            
            # 记录迁移
            self.record_migration(migration['version'], migration['name'])
            
            logger.info(f"迁移 {migration['version']} 执行成功")
            
        except Exception as e:
            logger.error(f"执行迁移失败 {migration['version']}: {e}")
            raise e
    
    def run_migrations(self):
        """运行所有待执行的迁移"""
        logger.info("开始数据库迁移...")
        
        try:
            # 初始化迁移表
            self.init_migrations_table()
            
            # 获取已执行和可用的迁移
            executed_migrations = self.get_executed_migrations()
            available_migrations = self.get_available_migrations()
            
            # 找出需要执行的迁移
            pending_migrations = [
                m for m in available_migrations 
                if m['version'] not in executed_migrations
            ]
            
            if not pending_migrations:
                logger.info("没有待执行的迁移")
                return True
            
            logger.info(f"发现 {len(pending_migrations)} 个待执行的迁移")
            
            # 执行迁移
            for migration in pending_migrations:
                self.execute_migration(migration)
            
            logger.info("数据库迁移完成")
            return True
            
        except Exception as e:
            logger.error(f"数据库迁移失败: {e}")
            return False
    
    def create_migration_file(self, version, name, description, sql_statements):
        """创建迁移文件"""
        migration_data = {
            'version': version,
            'name': name,
            'description': description,
            'created_at': datetime.now().isoformat(),
            'sql': sql_statements
        }
        
        filename = f"{version}.json"
        filepath = os.path.join(self.migrations_dir, filename)
        
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(migration_data, f, indent=2, ensure_ascii=False)
        
        logger.info(f"迁移文件已创建: {filepath}")
        return filepath


def generate_initial_migration():
    """生成初始迁移文件"""
    
    # 初始化迁移SQL
    initial_sql = [
        """
        CREATE TABLE IF NOT EXISTS users (
            id INT AUTO_INCREMENT PRIMARY KEY,
            email VARCHAR(255) UNIQUE NOT NULL,
            password_hash VARCHAR(255) NOT NULL,
            role VARCHAR(20) NOT NULL DEFAULT 'user',
            demo_count INT NOT NULL DEFAULT 5,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_email (email),
            INDEX idx_role (role)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        """,
        """
        CREATE TABLE IF NOT EXISTS usage_logs (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT,
            demo_type VARCHAR(50) NOT NULL,
            used_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_user_id (user_id),
            INDEX idx_used_at (used_at),
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        """,
        """
        INSERT INTO users (email, password_hash, role, demo_count, created_at, updated_at) 
        VALUES (
            'admin@example.com',
            '240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9',
            'admin',
            999999,
            NOW(),
            NOW()
        ) ON DUPLICATE KEY UPDATE 
            password_hash = VALUES(password_hash),
            role = VALUES(role),
            demo_count = VALUES(demo_count),
            updated_at = NOW()
        """
    ]
    
    # 创建迁移管理器实例
    mysql_config = {
        'host': os.getenv('MYSQL_HOST', 'localhost'),
        'database': os.getenv('MYSQL_DATABASE', 'joyful'),
        'user': os.getenv('MYSQL_USER', 'root'),
        'password': os.getenv('MYSQL_PASSWORD', '123456'),
        'port': int(os.getenv('MYSQL_PORT', 3306))
    }
    
    migration_manager = DatabaseMigration(mysql_config)
    
    # 创建初始迁移文件
    version = "001_initial"
    name = "Initial database schema"
    description = "Create users and usage_logs tables with default admin user"
    
    return migration_manager.create_migration_file(
        version, name, description, initial_sql
    )


if __name__ == '__main__':
    # 生成初始迁移文件
    generate_initial_migration()
    print("初始迁移文件已生成")
