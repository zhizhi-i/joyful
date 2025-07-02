#!/usr/bin/env python3
"""
后端API服务启动脚本
"""

import os
import sys
import subprocess
from pathlib import Path

def check_python_version():
    """检查Python版本"""
    if sys.version_info < (3, 7):
        print("❌ 错误: 需要Python 3.7或更高版本")
        print(f"当前版本: {sys.version}")
        return False
    print(f"✅ Python版本检查通过: {sys.version}")
    return True

def check_environment():
    """检查环境变量"""
    api_key = os.getenv('DASHSCOPE_API_KEY')
    if not api_key:
        print("⚠️  警告: 未设置DASHSCOPE_API_KEY环境变量")
        print("将使用默认API密钥进行测试")
        print("如需使用自己的密钥，请设置:")
        print("export DASHSCOPE_API_KEY='你的API密钥'")
        return True  # 允许使用默认密钥
    else:
        print(f"✅ DASHSCOPE_API_KEY已设置: {api_key[:20]}...")
        return True

def install_requirements():
    """安装依赖包"""
    print("\n📦 检查依赖包...")
    
    try:
        # 检查是否存在requirements.txt
        if not Path('requirements.txt').exists():
            print("❌ 找不到requirements.txt文件")
            return False
        
        # 尝试导入主要依赖
        import flask
        import dashscope
        print("✅ 主要依赖已安装")
        return True
        
    except ImportError as e:
        print(f"⚠️  缺少依赖: {e}")
        print("正在安装依赖包...")
        
        try:
            result = subprocess.run([
                sys.executable, '-m', 'pip', 'install', '-r', 'requirements.txt'
            ], check=True, capture_output=True, text=True)
            print("✅ 依赖包安装成功")
            return True
        except subprocess.CalledProcessError as e:
            print(f"❌ 依赖包安装失败: {e}")
            print(f"错误输出: {e.stderr}")
            return False

def start_backend():
    """启动后端服务"""
    print("\n🚀 启动后端API服务...")
    print("📍 监听地址: http://0.0.0.0:81")
    print("🔍 日志级别: INFO")
    print("📄 日志文件: api_server.log")
    print("⏸️  按 Ctrl+C 停止服务\n")
    
    try:
        # 启动Flask应用
        from app import app
        app.run(host='0.0.0.0', port=81, debug=True)
        
    except KeyboardInterrupt:
        print("\n\n👋 服务已停止")
    except Exception as e:
        print(f"\n❌ 启动失败: {e}")
        return False
    
    return True

def main():
    """主函数"""
    print("=" * 60)
    print("🎨 AI文字作画 - 后端API服务启动器")
    print("=" * 60)
    
    # 检查Python版本
    if not check_python_version():
        return
    
    # 检查环境变量
    if not check_environment():
        return
    
    # 安装依赖
    if not install_requirements():
        return
    
    # 启动后端服务
    start_backend()

if __name__ == '__main__':
    main() 