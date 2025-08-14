#!/usr/bin/env python3
"""
Docker环境数据库迁移脚本
在容器启动时自动运行
"""

import os
import sys
import time
import logging
from database_migration import DatabaseMigration

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

def wait_for_database(mysql_config, max_attempts=30, delay=2):
    """等待数据库服务可用"""
    logger.info("等待数据库服务启动...")
    
    import mysql.connector
    from mysql.connector import Error
    
    for attempt in range(max_attempts):
        try:
            # 尝试连接到MySQL服务器（不指定数据库）
            config_without_db = mysql_config.copy()
            config_without_db.pop('database', None)
            
            connection = mysql.connector.connect(**config_without_db)
            connection.close()
            
            logger.info("数据库服务已就绪")
            return True
            
        except Error as e:
            if attempt < max_attempts - 1:
                logger.info(f"数据库未就绪，等待 {delay} 秒... (尝试 {attempt + 1}/{max_attempts})")
                time.sleep(delay)
            else:
                logger.error(f"数据库连接超时: {e}")
                return False
    
    return False

def run_docker_migration():
    """在Docker环境中运行迁移"""
    logger.info("=== Docker环境数据库迁移 ===")
    
    # 加载配置
    mysql_config = {
        'host': os.getenv('MYSQL_HOST', 'mysql'),
        'database': os.getenv('MYSQL_DATABASE', 'joyful'),
        'user': os.getenv('MYSQL_USER', 'root'),
        'password': os.getenv('MYSQL_PASSWORD', '123456'),
        'port': int(os.getenv('MYSQL_PORT', 3306))
    }
    
    logger.info(f"数据库配置: {mysql_config['host']}:{mysql_config['port']}/{mysql_config['database']}")
    
    # 等待数据库服务
    if not wait_for_database(mysql_config):
        logger.error("数据库服务不可用，迁移失败")
        sys.exit(1)
    
    # 运行迁移
    try:
        migration_manager = DatabaseMigration(mysql_config)
        success = migration_manager.run_migrations()
        
        if success:
            logger.info("✅ 数据库迁移完成")
            return True
        else:
            logger.error("❌ 数据库迁移失败")
            sys.exit(1)
            
    except Exception as e:
        logger.error(f"数据库迁移异常: {e}")
        sys.exit(1)

if __name__ == '__main__':
    run_docker_migration()
