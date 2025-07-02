-- AI Text-to-Image 数据库初始化脚本
-- 创建时间: 2024

USE joyful;

-- 创建用户表
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 创建使用记录表
CREATE TABLE IF NOT EXISTS usage_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT,
    demo_type VARCHAR(50) NOT NULL,
    used_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_user_id (user_id),
    INDEX idx_used_at (used_at),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 插入默认管理员账号
-- 密码: admin123 (SHA256: 240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9)
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
    updated_at = NOW();

-- 插入测试用户账号
-- 密码: user123 (SHA256: 4a63aab75b0e8e52b2ac6b60a6b9e62c8d5c0c6a2aa8b0b2b7b5b8c0d1e2f3a4)
INSERT INTO users (email, password_hash, role, demo_count, created_at, updated_at) 
VALUES (
    'user@example.com',
    SHA2('user123', 256),
    'user',
    5,
    NOW(),
    NOW()
) ON DUPLICATE KEY UPDATE 
    updated_at = NOW();

-- 查看表结构
DESCRIBE users;
DESCRIBE usage_logs;

-- 显示初始化完成信息
SELECT 'Database initialization completed successfully!' as message;
SELECT CONCAT('Admin account: admin@example.com / admin123') as admin_info;
SELECT CONCAT('Test user account: user@example.com / user123') as user_info; 