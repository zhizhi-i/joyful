// 应用配置文件
// 在Docker环境中，这些值将通过环境变量注入

window.APP_CONFIG = {
    // API后端地址，默认值可在Docker运行时通过环境变量覆盖
    API_BASE_URL: window.BACKEND_API_URL || 'http://localhost:81/api',
    
    // 前端应用配置
    APP_PORT: window.FRONTEND_PORT || 8080,
    
    // 其他配置
    TOKEN_KEY: 'joyful_auth_token',
    USER_KEY: 'joyful_user_info',
    
    // 应用信息
    APP_NAME: 'AI Text-to-Image',
    VERSION: '2.0.0'
};

// 从环境变量加载配置的函数
window.loadConfig = function() {
    // 这个函数将在Docker容器启动时被调用
    // 用于从环境变量更新配置
    if (window.BACKEND_API_URL) {
        window.APP_CONFIG.API_BASE_URL = window.BACKEND_API_URL;
    }
    if (window.FRONTEND_PORT) {
        window.APP_CONFIG.APP_PORT = window.FRONTEND_PORT;
    }
    
    console.log('App Config Loaded:', window.APP_CONFIG);
};

// 立即加载配置
window.loadConfig(); 