#!/usr/bin/env python3
"""
数据库迁移命令行工具
用于管理数据库版本迁移
"""

import os
import sys
import argparse
from datetime import datetime
from database_migration import DatabaseMigration, generate_initial_migration

# 添加当前目录到Python路径
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

def load_mysql_config():
    """加载MySQL配置"""
    return {
        'host': os.getenv('MYSQL_HOST', 'localhost'),
        'database': os.getenv('MYSQL_DATABASE', 'joyful'),
        'user': os.getenv('MYSQL_USER', 'root'),
        'password': os.getenv('MYSQL_PASSWORD', '123456'),
        'port': int(os.getenv('MYSQL_PORT', 3306))
    }

def migrate(args):
    """运行迁移"""
    print("🔄 开始数据库迁移...")
    
    mysql_config = load_mysql_config()
    migration_manager = DatabaseMigration(mysql_config)
    
    success = migration_manager.run_migrations()
    if success:
        print("✅ 数据库迁移完成")
    else:
        print("❌ 数据库迁移失败")
        sys.exit(1)

def status(args):
    """显示迁移状态"""
    print("📊 数据库迁移状态:")
    
    mysql_config = load_mysql_config()
    migration_manager = DatabaseMigration(mysql_config)
    
    try:
        executed_migrations = migration_manager.get_executed_migrations()
        available_migrations = migration_manager.get_available_migrations()
        
        print(f"\n已执行的迁移 ({len(executed_migrations)}):")
        if executed_migrations:
            for version in executed_migrations:
                print(f"  ✅ {version}")
        else:
            print("  (无)")
        
        pending_migrations = [
            m for m in available_migrations 
            if m['version'] not in executed_migrations
        ]
        
        print(f"\n待执行的迁移 ({len(pending_migrations)}):")
        if pending_migrations:
            for migration in pending_migrations:
                print(f"  ⏳ {migration['version']} - {migration['name']}")
        else:
            print("  (无)")
        
        print(f"\n数据库: {mysql_config['host']}:{mysql_config['port']}/{mysql_config['database']}")
        
    except Exception as e:
        print(f"❌ 获取迁移状态失败: {e}")
        sys.exit(1)

def create(args):
    """创建新的迁移文件"""
    if not args.name:
        print("❌ 错误: 必须指定迁移名称")
        print("使用方法: python migrate.py create --name <迁移名称>")
        sys.exit(1)
    
    # 生成版本号
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    version = f"{timestamp}_{args.name.lower().replace(' ', '_')}"
    
    mysql_config = load_mysql_config()
    migration_manager = DatabaseMigration(mysql_config)
    
    # 创建空的迁移文件
    sql_statements = [
        "-- 在这里添加你的SQL语句",
        "-- 例如: ALTER TABLE users ADD COLUMN new_field VARCHAR(255);",
    ]
    
    filepath = migration_manager.create_migration_file(
        version, 
        args.name, 
        args.description or f"Migration: {args.name}",
        sql_statements
    )
    
    print(f"✅ 迁移文件已创建: {filepath}")
    print("📝 请编辑文件添加你的SQL语句")

def init(args):
    """初始化迁移系统"""
    print("🚀 初始化数据库迁移系统...")
    
    # 生成初始迁移文件
    filepath = generate_initial_migration()
    print(f"✅ 初始迁移文件已创建: {filepath}")
    
    # 运行迁移
    migrate(args)

def reset(args):
    """重置数据库(谨慎使用)"""
    if not args.force:
        print("⚠️  警告: 此操作将删除所有数据库表!")
        print("如果确定要继续，请使用 --force 参数")
        sys.exit(1)
    
    print("🗑️  重置数据库...")
    
    mysql_config = load_mysql_config()
    migration_manager = DatabaseMigration(mysql_config)
    
    try:
        conn = migration_manager.get_connection()
        cursor = conn.cursor()
        
        # 获取所有表名
        cursor.execute("SHOW TABLES")
        tables = [table[0] for table in cursor.fetchall()]
        
        if tables:
            print(f"删除 {len(tables)} 个表...")
            
            # 禁用外键检查
            cursor.execute("SET FOREIGN_KEY_CHECKS = 0")
            
            # 删除所有表
            for table in tables:
                cursor.execute(f"DROP TABLE IF EXISTS `{table}`")
                print(f"  ✅ 删除表: {table}")
            
            # 启用外键检查
            cursor.execute("SET FOREIGN_KEY_CHECKS = 1")
            
            conn.commit()
        else:
            print("数据库中没有表")
        
        cursor.close()
        conn.close()
        
        print("✅ 数据库重置完成")
        
    except Exception as e:
        print(f"❌ 数据库重置失败: {e}")
        sys.exit(1)

def main():
    """主函数"""
    parser = argparse.ArgumentParser(description='数据库迁移管理工具')
    subparsers = parser.add_subparsers(dest='command', help='可用命令')
    
    # migrate命令
    migrate_parser = subparsers.add_parser('migrate', help='运行数据库迁移')
    
    # status命令
    status_parser = subparsers.add_parser('status', help='显示迁移状态')
    
    # create命令
    create_parser = subparsers.add_parser('create', help='创建新的迁移文件')
    create_parser.add_argument('--name', required=True, help='迁移名称')
    create_parser.add_argument('--description', help='迁移描述')
    
    # init命令
    init_parser = subparsers.add_parser('init', help='初始化迁移系统')
    
    # reset命令
    reset_parser = subparsers.add_parser('reset', help='重置数据库(删除所有表)')
    reset_parser.add_argument('--force', action='store_true', help='强制执行重置')
    
    args = parser.parse_args()
    
    if not args.command:
        parser.print_help()
        return
    
    # 加载环境变量
    try:
        from dotenv import load_dotenv
        load_dotenv()
    except ImportError:
        # 如果没有安装python-dotenv，跳过
        pass
    
    # 执行对应命令
    if args.command == 'migrate':
        migrate(args)
    elif args.command == 'status':
        status(args)
    elif args.command == 'create':
        create(args)
    elif args.command == 'init':
        init(args)
    elif args.command == 'reset':
        reset(args)

if __name__ == '__main__':
    main()
