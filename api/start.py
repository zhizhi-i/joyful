#!/usr/bin/env python3
"""
AI文字作画项目管理工具
提供环境检查、依赖安装和启动指引
"""

import os
import sys
import subprocess
import argparse
import webbrowser
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
        print("项目已配置默认测试密钥，可以直接使用")
        print("如需使用自己的密钥，请设置:")
        print("  export DASHSCOPE_API_KEY='你的API密钥'")
        print("  或在Windows上: set DASHSCOPE_API_KEY=你的API密钥")
        return True
    else:
        print(f"✅ DASHSCOPE_API_KEY已设置: {api_key[:20]}...")
        return True

def check_project_structure():
    """检查项目结构"""
    project_root = Path(__file__).parent.parent
    required_dirs = ['api', 'web']
    required_files = [
        'api/app.py',
        'api/requirements.txt',
        'api/start_backend.py',
        'web/index.html',
        'web/styles.css',
        'web/script.js',
        'web/package.json'
    ]
    
    missing_items = []
    
    # 检查目录
    for dir_name in required_dirs:
        if not (project_root / dir_name).exists():
            missing_items.append(f"目录: {dir_name}")
    
    # 检查文件
    for file_path in required_files:
        if not (project_root / file_path).exists():
            missing_items.append(f"文件: {file_path}")
    
    if missing_items:
        print("❌ 项目结构不完整:")
        for item in missing_items:
            print(f"   缺少 {item}")
        return False
    
    print("✅ 项目结构检查通过")
    return True

def install_backend_requirements():
    """安装后端依赖"""
    print("\n📦 检查后端依赖...")
    
    try:
        # 尝试导入主要依赖
        import flask
        import dashscope
        print("✅ 后端依赖已安装")
        return True
        
    except ImportError as e:
        print(f"⚠️  缺少后端依赖: {e}")
        print("正在安装后端依赖包...")
        
        try:
            # 切换到api目录
            api_dir = Path(__file__).parent
            requirements_path = api_dir / 'requirements.txt'
            
            if not requirements_path.exists():
                print("❌ 找不到requirements.txt文件")
                return False
            
            result = subprocess.run([
                sys.executable, '-m', 'pip', 'install', '-r', str(requirements_path)
            ], check=True, capture_output=True, text=True, cwd=api_dir)
            
            print("✅ 后端依赖安装成功")
            return True
            
        except subprocess.CalledProcessError as e:
            print(f"❌ 后端依赖安装失败: {e}")
            print(f"错误输出: {e.stderr}")
            return False

def check_services_status():
    """检查服务状态"""
    print("\n🔍 检查服务状态...")
    
    # 检查后端服务
    import urllib.request
    import urllib.error
    
    try:
        response = urllib.request.urlopen('http://localhost:5001/api/health', timeout=3)
        if response.status == 200:
            print("✅ 后端服务 (端口 5001) 正在运行")
            backend_running = True
        else:
            print(f"⚠️  后端服务响应异常: HTTP {response.status}")
            backend_running = False
    except urllib.error.URLError:
        print("❌ 后端服务 (端口 5001) 未运行")
        backend_running = False
    except Exception as e:
        print(f"❌ 检查后端服务时发生错误: {e}")
        backend_running = False
    
    # 检查前端服务
    try:
        response = urllib.request.urlopen('http://localhost:8080', timeout=3)
        if response.status == 200:
            print("✅ 前端服务 (端口 8080) 正在运行")
            frontend_running = True
        else:
            print(f"⚠️  前端服务响应异常: HTTP {response.status}")
            frontend_running = False
    except urllib.error.URLError:
        print("❌ 前端服务 (端口 8080) 未运行")
        frontend_running = False
    except Exception as e:
        print(f"❌ 检查前端服务时发生错误: {e}")
        frontend_running = False
    
    return backend_running, frontend_running

def show_startup_guide():
    """显示启动指引"""
    print("\n" + "=" * 60)
    print("🚀 启动指引")
    print("=" * 60)
    
    backend_running, frontend_running = check_services_status()
    
    if not backend_running:
        print("\n📍 启动后端服务:")
        print("   cd api")
        print("   python start_backend.py")
        print("   或者: python app.py")
        print("\n   后端将在 http://localhost:5001 启动")
    
    if not frontend_running:
        print("\n📍 启动前端服务:")
        print("   cd web")
        print("   npm install    # 首次运行")
        print("   npm run dev")
        print("\n   前端将在 http://localhost:8080 启动")
    
    if backend_running and frontend_running:
        print("\n🎉 所有服务都在运行!")
        print("   前端地址: http://localhost:8080")
        print("   后端API: http://localhost:5001")
        
        try:
            webbrowser.open("http://localhost:8080")
            print("   浏览器已自动打开")
        except:
            print("   请手动在浏览器中打开前端地址")
    
    print("\n💡 小贴士:")
    print("   - 后端和前端可以独立启动和停止")
    print("   - 后端启动后会自动创建详细日志文件")
    print("   - 前端使用npm管理，支持热重载")
    print("   - 前端需要后端服务才能正常生成图片")
    print("   - 按 Ctrl+C 可以停止对应的服务")

def show_project_info():
    """显示项目信息"""
    print("\n" + "=" * 60)
    print("📋 项目信息")
    print("=" * 60)
    
    project_root = Path(__file__).parent.parent
    
    print(f"项目根目录: {project_root}")
    print(f"后端目录: {project_root / 'api'}")
    print(f"前端目录: {project_root / 'web'}")
    
    print("\n📁 项目结构:")
    print("tgp/")
    print("├── api/                   # 后端服务")
    print("│   ├── app.py            # Flask API主文件")
    print("│   ├── start_backend.py  # 后端启动脚本")
    print("│   ├── requirements.txt  # Python依赖")
    print("│   └── start.py          # 项目管理工具")
    print("├── web/                   # 前端文件")
    print("│   ├── index.html        # 主页面")
    print("│   ├── styles.css        # 样式文件")
    print("│   ├── script.js         # JavaScript逻辑")
    print("│   └── package.json      # npm项目配置")
    print("└── README.md             # 项目说明")
    
    print("\n🔧 API接口:")
    print("   POST /api/generate        - 生成图片")
    print("   GET  /api/status/<id>     - 查询任务状态")
    print("   GET  /api/health          - 健康检查")
    print("   GET  /api/ratios          - 获取支持的比例")

def main():
    """主函数"""
    parser = argparse.ArgumentParser(description='AI文字作画项目管理工具')
    parser.add_argument('--check', action='store_true', help='只检查环境，不显示启动指引')
    parser.add_argument('--info', action='store_true', help='显示项目信息')
    parser.add_argument('--install', action='store_true', help='安装依赖包')
    
    args = parser.parse_args()
    
    print("=" * 60)
    print("🎨 AI文字作画项目管理工具")
    print("=" * 60)
    
    # 检查Python版本
    if not check_python_version():
        return
    
    # 检查项目结构
    if not check_project_structure():
        return
    
    # 检查环境变量
    check_environment()
    
    # 根据参数执行相应操作
    if args.install:
        install_backend_requirements()
    elif args.info:
        show_project_info()
    elif args.check:
        check_services_status()
    else:
        # 默认显示启动指引
        install_backend_requirements()
        show_startup_guide()

if __name__ == '__main__':
    main() 