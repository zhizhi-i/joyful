#!/usr/bin/env python3
"""
手动运行数据库迁移脚本
"""

import sys
import os

# 添加当前目录到路径
sys.path.append(os.path.dirname(__file__))

from database_migration import DatabaseMigration

# MySQL数据库配置
MYSQL_CONFIG = {
    'host': '172.17.200.117',  # 修正为正确的主机地址
    'database': 'joyful',
    'user': 'root',
    'password': '123456',
    'port': 3306
}

def main():
    print("=== 手动运行数据库迁移 ===")
    
    # 创建迁移管理器
    migration_manager = DatabaseMigration(MYSQL_CONFIG)
    
    # 运行迁移
    success = migration_manager.run_migrations()
    
    if success:
        print("✅ 数据库迁移完成")
        
        # 显示已执行的迁移
        try:
            executed = migration_manager.get_executed_migrations()
            print(f"\n已执行的迁移数量: {len(executed)}")
            for version in executed:
                print(f"  - {version}")
                
            # 显示可用的迁移
            available = migration_manager.get_available_migrations()
            print(f"\n可用的迁移文件数量: {len(available)}")
            for migration in available:
                print(f"  - {migration['version']}: {migration['name']}")
                
        except Exception as e:
            print(f"⚠️  获取迁移信息失败: {e}")
    else:
        print("❌ 数据库迁移失败")
        sys.exit(1)

if __name__ == '__main__':
    main()
