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
                
                // 更新UI状态
                const userInfo = AuthUtils.getUserInfo();
                UIManager.updateNavUserStatus(true, userInfo);
                
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
    static verificationCodeSent = false;
    static countdownTimer = null;

    // 发送验证码
    static async sendVerificationCode(email) {
        try {
            const response = await AuthUtils.apiRequest('/send-verification-code', {
                method: 'POST',
                body: JSON.stringify({ email })
            });

            if (response.success) {
                return response;
            } else {
                throw new Error(response.message || 'Failed to send verification code');
            }
        } catch (error) {
            throw error;
        }
    }

    // 验证邮箱验证码
    static async verifyEmailCode(email, code) {
        try {
            const response = await AuthUtils.apiRequest('/verify-email-code', {
                method: 'POST',
                body: JSON.stringify({ email, code })
            });

            if (response.success) {
                return response;
            } else {
                throw new Error(response.message || 'Invalid verification code');
            }
        } catch (error) {
            throw error;
        }
    }

    // 开始倒计时
    static startCountdown() {
        const sendBtn = document.getElementById('sendCodeBtn');
        const btnText = sendBtn.querySelector('.btn-text');
        const btnCountdown = sendBtn.querySelector('.btn-countdown');
        
        let countdown = 60;
        sendBtn.disabled = true;
        btnText.style.display = 'none';
        btnCountdown.style.display = 'block';
        
        const updateCountdown = () => {
            btnCountdown.textContent = `${countdown}s`;
            countdown--;
            
            if (countdown < 0) {
                clearInterval(this.countdownTimer);
                sendBtn.disabled = false;
                btnText.style.display = 'block';
                btnCountdown.style.display = 'none';
                this.countdownTimer = null;
            }
        };
        
        updateCountdown();
        this.countdownTimer = setInterval(updateCountdown, 1000);
    }

    static async register(email, password, verificationCode) {
        try {
            const response = await AuthUtils.apiRequest('/register', {
                method: 'POST',
                body: JSON.stringify({ email, password, verification_code: verificationCode })
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

    static initSendCodeButton() {
        const sendBtn = document.getElementById('sendCodeBtn');
        const emailInput = document.getElementById('registerEmail');
        
        if (!sendBtn || !emailInput) return;

        sendBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            
            const email = emailInput.value.trim();
            
            // 验证邮箱格式
            if (!email) {
                AuthUtils.showError('Please enter your email address first', 'registerErrorMessage');
                return;
            }
            
            if (!email.includes('@') || !email.includes('.')) {
                AuthUtils.showError('Please enter a valid email address', 'registerErrorMessage');
                return;
            }
            
            AuthUtils.hideError('registerErrorMessage');
            
            try {
                sendBtn.disabled = true;
                sendBtn.querySelector('.btn-text').textContent = 'Sending...';
                
                await this.sendVerificationCode(email);
                this.verificationCodeSent = true;
                this.startCountdown();
                
                // 显示成功消息
                const successMsg = document.createElement('div');
                successMsg.className = 'success-message';
                successMsg.style.cssText = 'background: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.3); color: #10b981; padding: 12px 16px; border-radius: 8px; font-size: 14px; margin-bottom: 16px; text-align: center;';
                successMsg.textContent = 'Verification code sent! Please check your email.';
                
                const errorDiv = document.getElementById('registerErrorMessage');
                errorDiv.parentNode.insertBefore(successMsg, errorDiv);
                
                setTimeout(() => {
                    if (successMsg.parentNode) {
                        successMsg.parentNode.removeChild(successMsg);
                    }
                }, 5000);
                
            } catch (error) {
                AuthUtils.showError(error.message || 'Failed to send verification code', 'registerErrorMessage');
            } finally {
                if (!this.countdownTimer) {
                    sendBtn.disabled = false;
                    sendBtn.querySelector('.btn-text').textContent = 'Get Code';
                }
            }
        });
    }

    static async handleRegisterForm() {
        const form = document.getElementById('registerForm');
        if (!form) return;

        // 初始化发送验证码按钮
        this.initSendCodeButton();

        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const email = document.getElementById('registerEmail').value.trim();
            const password = document.getElementById('registerPassword').value;
            const confirmPassword = document.getElementById('registerConfirmPassword').value;
            const verificationCode = document.getElementById('verificationCode').value.trim();

            // 基本验证
            if (!email || !password || !confirmPassword || !verificationCode) {
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

            // 验证码格式检查
            if (!/^\d{6}$/.test(verificationCode)) {
                AuthUtils.showError('Please enter a valid 6-digit verification code', 'registerErrorMessage');
                return;
            }

            // 检查是否已发送验证码
            if (!this.verificationCodeSent) {
                AuthUtils.showError('Please send verification code first', 'registerErrorMessage');
                return;
            }

            AuthUtils.hideError('registerErrorMessage');
            AuthUtils.setButtonLoading('registerSubmitBtn', true);

            try {
                await this.register(email, password, verificationCode);
                
                // 注册成功，关闭模态框
                ModalManager.hideAllModals();
                
                // 更新UI状态
                const userInfo = AuthUtils.getUserInfo();
                UIManager.updateNavUserStatus(true, userInfo);
                
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

// 用户界面管理
class UIManager {
    // 更新导航栏用户状态
    static updateNavUserStatus(isLoggedIn, userInfo = null) {
        console.log('UIManager.updateNavUserStatus 被调用:');
        console.log('isLoggedIn:', isLoggedIn);
        console.log('userInfo:', userInfo);
        
        const loginBtn = document.getElementById('loginBtn');
        const userDropdownContainer = document.getElementById('userDropdownContainer');
        const userName = document.getElementById('userName');
        
        console.log('找到的元素:');
        console.log('loginBtn:', loginBtn);
        console.log('userDropdownContainer:', userDropdownContainer);
        console.log('userName:', userName);
        
        if (isLoggedIn && userInfo) {
            console.log('用户已登录，隐藏登录按钮，显示用户菜单');
            // 完全隐藏登录按钮
            if (loginBtn) {
                loginBtn.style.display = 'none';
                loginBtn.style.visibility = 'hidden';
                loginBtn.classList.add('hidden');
                // 移除所有事件监听器
                loginBtn.removeEventListener('click', this.originalLoginHandler);
                loginBtn.innerHTML = ''; // 清空内容
            }
            
            // 显示用户下拉菜单并设置用户名
            if (userDropdownContainer) {
                userDropdownContainer.style.display = 'block';
                userDropdownContainer.style.visibility = 'visible';
                
                // 设置用户名（使用邮箱前缀或完整邮箱）
                if (userName) {
                    const displayName = userInfo.email.length > 15 
                        ? userInfo.email.split('@')[0] 
                        : userInfo.email;
                    userName.textContent = displayName;
                }
                
                this.initUserDropdown();
            }
        } else {
            console.log('用户未登录，显示登录按钮，隐藏用户菜单');
            // 显示登录按钮
            if (loginBtn) {
                loginBtn.style.display = 'flex';
                loginBtn.style.visibility = 'visible';
                loginBtn.classList.remove('hidden');
                // 恢复按钮内容
                if (!loginBtn.innerHTML.trim()) {
                    loginBtn.innerHTML = '<i class="fas fa-user"></i> Login';
                }
            }
            
            // 隐藏用户下拉菜单
            if (userDropdownContainer) {
                userDropdownContainer.style.display = 'none';
            }
        }
    }
    
    // 初始化用户下拉菜单
    static initUserDropdown() {
        const userDropdownBtn = document.getElementById('userDropdownBtn');
        const userDropdownContainer = document.getElementById('userDropdownContainer');
        const userDropdownMenu = document.getElementById('userDropdownMenu');
        
        if (!userDropdownBtn || !userDropdownContainer || !userDropdownMenu) return;
        
        // 移除之前的事件监听器（如果有）
        const newBtn = userDropdownBtn.cloneNode(true);
        userDropdownBtn.parentNode.replaceChild(newBtn, userDropdownBtn);
        
        // 点击用户按钮切换下拉菜单
        newBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            const isOpen = userDropdownContainer.classList.contains('open');
            if (isOpen) {
                this.closeUserDropdown();
            } else {
                this.openUserDropdown();
            }
        });
        
        // 点击外部关闭下拉菜单
        document.addEventListener('click', (e) => {
            if (!userDropdownContainer.contains(e.target)) {
                this.closeUserDropdown();
            }
        });
        
        // 处理下拉菜单项点击
        const dropdownItems = userDropdownMenu.querySelectorAll('.dropdown-item');
        dropdownItems.forEach(item => {
            item.addEventListener('click', (e) => {
                const action = item.dataset.action;
                
                // 如果是链接元素，让它正常导航
                if (item.tagName === 'A') {
                    // 关闭下拉菜单，让链接正常工作
                    this.closeUserDropdown();
                    return;
                }
                
                // 如果是按钮元素，处理特殊动作
                e.preventDefault();
                
                switch (action) {
                    case 'logout':
                        AuthUtils.logout();
                        window.location.reload();
                        break;
                    default:
                        console.log('Unknown action:', action);
                }
                
                this.closeUserDropdown();
            });
        });
    }
    
    // 打开用户下拉菜单
    static openUserDropdown() {
        const userDropdownContainer = document.getElementById('userDropdownContainer');
        if (userDropdownContainer) {
            userDropdownContainer.classList.add('open');
        }
    }
    
    // 关闭用户下拉菜单
    static closeUserDropdown() {
        const userDropdownContainer = document.getElementById('userDropdownContainer');
        if (userDropdownContainer) {
            userDropdownContainer.classList.remove('open');
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
    
    // 检查用户登录状态并更新UI
    const isLoggedIn = AuthUtils.isLoggedIn();
    const userInfo = AuthUtils.getUserInfo();
    
    console.log('页面加载时的状态检查:');
    console.log('isLoggedIn:', isLoggedIn);
    console.log('userInfo:', userInfo);
    console.log('token:', AuthUtils.getToken());
    
    // 延迟更新UI，确保DOM完全加载
    setTimeout(() => {
        UIManager.updateNavUserStatus(isLoggedIn, userInfo);
    }, 100);
    
    switch (currentPage) {
        case 'generator.html':
            // generator页面需要登录
            RouteGuard.requireAuth();
            break;
            
        case 'index.html':
        case '':
            // 首页设置路由保护
            RouteGuard.handleCreateButtons();
            break;
    }
    
    // Initialize dropdown and subscription button handlers
    initializeNavigationHandlers();
});

// 初始化导航处理器
function initializeNavigationHandlers() {
    // 导航处理现在完全由UIManager.initUserDropdown()处理
    // 这个函数保留用于未来可能的其他导航功能
    console.log('Navigation handlers initialized');
}

// 导出给全局使用
window.AuthUtils = AuthUtils;
window.UserManager = UserManager;
window.RouteGuard = RouteGuard;
window.ModalManager = ModalManager;
window.UIManager = UIManager; 