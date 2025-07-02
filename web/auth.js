// 认证系统配置
const AUTH_CONFIG = {
    get API_BASE_URL() {
        return window.APP_CONFIG ? window.APP_CONFIG.API_BASE_URL : 'http://localhost:81/api';
    },
    get TOKEN_KEY() {
        return window.APP_CONFIG ? window.APP_CONFIG.TOKEN_KEY : 'joyful_auth_token';
    },
    get USER_KEY() {
        return window.APP_CONFIG ? window.APP_CONFIG.USER_KEY : 'joyful_user_info';
    }
};

// 模态框管理器
class ModalManager {
    static showModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.add('show');
            // 防止背景滚动
            document.body.style.overflow = 'hidden';
        }
    }

    static hideModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.remove('show');
            // 恢复背景滚动
            document.body.style.overflow = 'auto';
        }
    }

    static hideAllModals() {
        const modals = document.querySelectorAll('.modal-overlay');
        modals.forEach(modal => {
            modal.classList.remove('show');
        });
        document.body.style.overflow = 'auto';
    }

    static initModalEvents() {
        // 登录按钮点击事件
        const loginBtn = document.getElementById('loginBtn');
        if (loginBtn) {
            loginBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                
                if (AuthUtils.isLoggedIn()) {
                    // 如果已登录，显示用户菜单或直接跳转
                    return;
                }
                
                this.showModal('loginModal');
            });
        }

        // 模态框关闭按钮
        document.getElementById('closeLoginModal')?.addEventListener('click', () => {
            this.hideModal('loginModal');
        });

        document.getElementById('closeRegisterModal')?.addEventListener('click', () => {
            this.hideModal('registerModal');
        });

        // 模态框切换
        document.getElementById('showRegisterModal')?.addEventListener('click', (e) => {
            e.preventDefault();
            this.hideModal('loginModal');
            this.showModal('registerModal');
        });

        document.getElementById('showLoginModal')?.addEventListener('click', (e) => {
            e.preventDefault();
            this.hideModal('registerModal');
            this.showModal('loginModal');
        });

        // 点击遮罩层关闭模态框
        document.querySelectorAll('.modal-overlay').forEach(overlay => {
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) {
                    this.hideAllModals();
                }
            });
        });

        // ESC键关闭模态框
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.hideAllModals();
            }
        });
    }
}

// 工具函数
class AuthUtils {
    // 设置Token
    static setToken(token) {
        localStorage.setItem(AUTH_CONFIG.TOKEN_KEY, token);
    }

    // 获取Token
    static getToken() {
        return localStorage.getItem(AUTH_CONFIG.TOKEN_KEY);
    }

    // 移除Token
    static removeToken() {
        localStorage.removeItem(AUTH_CONFIG.TOKEN_KEY);
        localStorage.removeItem(AUTH_CONFIG.USER_KEY);
    }

    // 设置用户信息
    static setUserInfo(userInfo) {
        localStorage.setItem(AUTH_CONFIG.USER_KEY, JSON.stringify(userInfo));
    }

    // 获取用户信息
    static getUserInfo() {
        const userInfo = localStorage.getItem(AUTH_CONFIG.USER_KEY);
        return userInfo ? JSON.parse(userInfo) : null;
    }

    // 检查是否已登录
    static isLoggedIn() {
        return !!this.getToken();
    }

    // 显示错误信息
    static showError(message, elementId = 'loginErrorMessage') {
        const errorElement = document.getElementById(elementId);
        if (errorElement) {
            errorElement.textContent = message;
            errorElement.style.display = 'block';
        }
    }

    // 隐藏错误信息
    static hideError(elementId = 'loginErrorMessage') {
        const errorElement = document.getElementById(elementId);
        if (errorElement) {
            errorElement.style.display = 'none';
        }
    }

    // 设置按钮加载状态
    static setButtonLoading(buttonId, isLoading) {
        const button = document.getElementById(buttonId);
        if (button) {
            const btnText = button.querySelector('.btn-text');
            const btnLoading = button.querySelector('.btn-loading');
            
            if (isLoading) {
                btnText.style.display = 'none';
                btnLoading.style.display = 'flex';
                button.disabled = true;
            } else {
                btnText.style.display = 'block';
                btnLoading.style.display = 'none';
                button.disabled = false;
            }
        }
    }

    // API请求
    static async apiRequest(endpoint, options = {}) {
        const url = `${AUTH_CONFIG.API_BASE_URL}${endpoint}`;
        const token = this.getToken();
        
        const config = {
            headers: {
                'Content-Type': 'application/json',
                ...(token && { 'Authorization': `Bearer ${token}` })
            },
            ...options
        };

        try {
            const response = await fetch(url, config);
            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.message || 'Request failed');
            }
            
            return data;
        } catch (error) {
            console.error('API Request Error:', error);
            throw error;
        }
    }
}

// 登录功能
class LoginManager {
    static async login(email, password) {
        try {
            const response = await AuthUtils.apiRequest('/login', {
                method: 'POST',
                body: JSON.stringify({ email, password })
            });

            if (response.success) {
                AuthUtils.setToken(response.access_token);
                AuthUtils.setUserInfo(response.user);
                return response;
            } else {
                throw new Error(response.message || 'Login failed');
            }
        } catch (error) {
            throw error;
        }
    }

    static async handleLoginForm() {
        const form = document.getElementById('loginForm');
        if (!form) return;

        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const email = document.getElementById('loginEmail').value.trim();
            const password = document.getElementById('loginPassword').value;

            // 基本验证
            if (!email || !password) {
                AuthUtils.showError('Please fill in all fields', 'loginErrorMessage');
                return;
            }

            // 简单邮箱格式检查
            if (!email.includes('@') || !email.includes('.')) {
                AuthUtils.showError('Please enter a valid email address', 'loginErrorMessage');
                return;
            }

            AuthUtils.hideError('loginErrorMessage');
            AuthUtils.setButtonLoading('loginSubmitBtn', true);

            try {
                await this.login(email, password);
                
                // 登录成功，关闭模态框
                ModalManager.hideAllModals();
                
                // 刷新页面或跳转
                const currentPage = window.location.pathname.split('/').pop();
                if (currentPage === 'index.html' || currentPage === '') {
                    // 首页刷新以更新用户状态
                    window.location.reload();
                } else {
                    // 其他页面跳转到generator
                    window.location.href = 'generator.html';
                }
            } catch (error) {
                AuthUtils.showError(error.message || 'Login failed. Please try again.', 'loginErrorMessage');
            } finally {
                AuthUtils.setButtonLoading('loginSubmitBtn', false);
            }
        });
    }
}

// 注册功能
class RegisterManager {
    static async register(email, password) {
        try {
            const response = await AuthUtils.apiRequest('/register', {
                method: 'POST',
                body: JSON.stringify({ email, password })
            });

            if (response.success) {
                AuthUtils.setToken(response.access_token);
                AuthUtils.setUserInfo(response.user);
                return response;
            } else {
                throw new Error(response.message || 'Registration failed');
            }
        } catch (error) {
            throw error;
        }
    }

    static async handleRegisterForm() {
        const form = document.getElementById('registerForm');
        if (!form) return;

        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const email = document.getElementById('registerEmail').value.trim();
            const password = document.getElementById('registerPassword').value;
            const confirmPassword = document.getElementById('registerConfirmPassword').value;

            // 基本验证
            if (!email || !password || !confirmPassword) {
                AuthUtils.showError('Please fill in all fields', 'registerErrorMessage');
                return;
            }

            // 简单邮箱格式检查
            if (!email.includes('@') || !email.includes('.')) {
                AuthUtils.showError('Please enter a valid email address', 'registerErrorMessage');
                return;
            }

            // 密码长度检查
            if (password.length < 6) {
                AuthUtils.showError('Password must be at least 6 characters long', 'registerErrorMessage');
                return;
            }

            // 密码确认检查
            if (password !== confirmPassword) {
                AuthUtils.showError('Passwords do not match', 'registerErrorMessage');
                return;
            }

            AuthUtils.hideError('registerErrorMessage');
            AuthUtils.setButtonLoading('registerSubmitBtn', true);

            try {
                await this.register(email, password);
                
                // 注册成功，关闭模态框
                ModalManager.hideAllModals();
                
                // 刷新页面或跳转
                const currentPage = window.location.pathname.split('/').pop();
                if (currentPage === 'index.html' || currentPage === '') {
                    // 首页刷新以更新用户状态
                    window.location.reload();
                } else {
                    // 其他页面跳转到generator
                    window.location.href = 'generator.html';
                }
            } catch (error) {
                AuthUtils.showError(error.message || 'Registration failed. Please try again.', 'registerErrorMessage');
            } finally {
                AuthUtils.setButtonLoading('registerSubmitBtn', false);
            }
        });
    }
}

// 用户管理
class UserManager {
    // 获取用户信息
    static async getUserInfo() {
        try {
            const response = await AuthUtils.apiRequest('/user/info');
            if (response.success) {
                AuthUtils.setUserInfo(response.user);
                return response.user;
            }
            throw new Error(response.message);
        } catch (error) {
            console.error('Get user info error:', error);
            throw error;
        }
    }

    // 检查用户试用次数
    static async checkTrialStatus() {
        try {
            const response = await AuthUtils.apiRequest('/user/check-trial');
            if (response.success) {
                return response;
            }
            throw new Error(response.message);
        } catch (error) {
            console.error('Check trial status error:', error);
            throw error;
        }
    }

    // 使用试用次数
    static async useTrial(demoType = 'image_generation') {
        try {
            const response = await AuthUtils.apiRequest('/user/use-trial', {
                method: 'POST',
                body: JSON.stringify({ demo_type: demoType })
            });
            
            if (response.success) {
                return response;
            }
            throw new Error(response.message);
        } catch (error) {
            console.error('Use trial error:', error);
            throw error;
        }
    }

    // 登出
    static logout() {
        AuthUtils.removeToken();
        window.location.href = 'index.html';
    }

    // 更新导航栏用户信息
    static updateNavUserInfo() {
        const userInfo = AuthUtils.getUserInfo();
        const loginBtn = document.querySelector('.login-btn');
        
        if (userInfo && loginBtn) {
            // 更新登录按钮为用户信息
            loginBtn.innerHTML = `
                <i class="fas fa-user"></i>
                <span>${userInfo.email}</span>
                <div class="user-dropdown" style="display: none;">
                    <a href="#" onclick="UserManager.logout()">Logout</a>
                </div>
            `;
            
            // 添加下拉菜单功能（简单实现）
            loginBtn.addEventListener('click', (e) => {
                e.preventDefault();
                const dropdown = loginBtn.querySelector('.user-dropdown');
                if (dropdown) {
                    dropdown.style.display = dropdown.style.display === 'none' ? 'block' : 'none';
                }
            });
        }
    }
}

// 路由保护
class RouteGuard {
    // 检查是否需要登录
    static requireAuth() {
        if (!AuthUtils.isLoggedIn()) {
            // 在generator页面显示登录模态框
            ModalManager.showModal('loginModal');
            return false;
        }
        return true;
    }

    // 检查创建按钮点击
    static handleCreateButtons() {
        // 处理首页的 "Start Creating" 按钮
        const startCreatingBtn = document.querySelector('.cta-button.primary[href="generator.html"]');
        if (startCreatingBtn) {
            startCreatingBtn.addEventListener('click', (e) => {
                e.preventDefault();
                if (AuthUtils.isLoggedIn()) {
                    window.location.href = 'generator.html';
                } else {
                    ModalManager.showModal('loginModal');
                }
            });
        }

        // 处理导航栏的 "Create" 按钮
        const createNavBtn = document.querySelector('.nav-link[href="generator.html"]');
        if (createNavBtn) {
            createNavBtn.addEventListener('click', (e) => {
                e.preventDefault();
                if (AuthUtils.isLoggedIn()) {
                    window.location.href = 'generator.html';
                } else {
                    ModalManager.showModal('loginModal');
                }
            });
        }
    }
}

// 页面初始化
document.addEventListener('DOMContentLoaded', () => {
    const currentPage = window.location.pathname.split('/').pop();
    
    // 初始化模态框事件
    ModalManager.initModalEvents();
    
    // 初始化表单处理
    LoginManager.handleLoginForm();
    RegisterManager.handleRegisterForm();
    
    switch (currentPage) {
        case 'generator.html':
            // generator页面需要登录
            if (RouteGuard.requireAuth()) {
                UserManager.updateNavUserInfo();
            }
            break;
            
        case 'index.html':
        case '':
            // 首页设置路由保护
            RouteGuard.handleCreateButtons();
            if (AuthUtils.isLoggedIn()) {
                UserManager.updateNavUserInfo();
            }
            break;
    }
});

// 导出给全局使用
window.AuthUtils = AuthUtils;
window.UserManager = UserManager;
window.RouteGuard = RouteGuard;
window.ModalManager = ModalManager; 