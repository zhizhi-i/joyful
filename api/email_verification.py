#!/usr/bin/env python3
"""
邮箱验证服务模块
提供邮箱验证码发送和验证功能
"""

import smtplib
import ssl
import random
import string
import time
import threading
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime, timedelta
import logging

logger = logging.getLogger(__name__)

class EmailVerificationService:
    """邮箱验证服务"""
    
    def __init__(self):
        # 邮箱服务器配置
        self.smtp_server = "smtppro.zoho.com"
        self.port = 465  # SSL端口
        self.username = "system@joyful.cloud"
        self.password = "Uzfzj7-n"
        
        # 验证码存储 {email: {code: str, expires_at: datetime, attempts: int}}
        self.verification_codes = {}
        self.lock = threading.Lock()  # 线程锁，确保多用户并发安全
        
        # 配置参数
        self.code_length = 6  # 验证码长度
        self.code_expiry_minutes = 10  # 验证码有效期（分钟）
        self.max_attempts = 3  # 最大验证尝试次数
        self.send_interval_seconds = 60  # 发送间隔（秒）
        
    def generate_verification_code(self):
        """生成6位数字验证码"""
        return ''.join(random.choices(string.digits, k=self.code_length))
    
    def create_email_content(self, verification_code):
        """创建邮件内容"""
        # 邮件正文（英文）
        text_content = f"""
You are registering for a Joyful platform account.

Your verification code is: {verification_code}

This code will expire in {self.code_expiry_minutes} minutes.
Please do not share this code with anyone.

If you did not request this verification, please ignore this email.

Best regards,
Joyful Team
        """.strip()
        
        # HTML格式邮件正文
        html_content = f"""
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Joyful Registration Verification</title>
    <style>
        body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
        .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
        .header {{ background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; text-align: center; border-radius: 10px 10px 0 0; }}
        .content {{ background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }}
        .code {{ background: #fff; border: 2px dashed #667eea; padding: 20px; text-align: center; margin: 20px 0; border-radius: 8px; }}
        .code-number {{ font-size: 32px; font-weight: bold; color: #667eea; letter-spacing: 8px; }}
        .footer {{ text-align: center; color: #666; margin-top: 20px; font-size: 14px; }}
        .warning {{ background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 5px; margin: 20px 0; }}
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🎨 Joyful Platform</h1>
            <h2>Registration Verification</h2>
        </div>
        <div class="content">
            <p>Hello!</p>
            <p>You are registering for a <strong>Joyful</strong> platform account.</p>
            
            <div class="code">
                <p>Your verification code is:</p>
                <div class="code-number">{verification_code}</div>
            </div>
            
            <div class="warning">
                <p><strong>⚠️ Important:</strong></p>
                <ul>
                    <li>This code will expire in <strong>{self.code_expiry_minutes} minutes</strong></li>
                    <li>Please do not share this code with anyone</li>
                    <li>If you did not request this verification, please ignore this email</li>
                </ul>
            </div>
            
            <p>Thank you for choosing Joyful!</p>
            
            <div class="footer">
                <p>Best regards,<br><strong>Joyful Team</strong></p>
                <p><small>This is an automated email. Please do not reply to this message.</small></p>
            </div>
        </div>
    </div>
</body>
</html>
        """.strip()
        
        return text_content, html_content
    
    def send_verification_email(self, to_email, verification_code):
        """发送验证邮件"""
        try:
            # 创建邮件
            msg = MIMEMultipart("alternative")
            msg["Subject"] = "Joyful Registration Service - Verification Code"
            msg["From"] = f"Joyful System <{self.username}>"
            msg["To"] = to_email
            
            # 创建邮件内容
            text_content, html_content = self.create_email_content(verification_code)
            
            # 添加文本和HTML部分
            text_part = MIMEText(text_content, "plain")
            html_part = MIMEText(html_content, "html")
            
            msg.attach(text_part)
            msg.attach(html_part)
            
            # 创建SSL连接并发送邮件
            context = ssl.create_default_context()
            with smtplib.SMTP_SSL(self.smtp_server, self.port, context=context) as server:
                server.login(self.username, self.password)
                server.send_message(msg)
                
            logger.info(f"验证邮件发送成功: {to_email}")
            return True
            
        except Exception as e:
            logger.error(f"发送验证邮件失败: {to_email}, 错误: {e}")
            return False
    
    def can_send_code(self, email):
        """检查是否可以发送验证码（防止频繁发送）"""
        with self.lock:
            if email not in self.verification_codes:
                return True, "可以发送"
            
            last_send_time = self.verification_codes[email].get('last_send_time')
            if last_send_time:
                time_diff = (datetime.now() - last_send_time).total_seconds()
                if time_diff < self.send_interval_seconds:
                    remaining = self.send_interval_seconds - int(time_diff)
                    return False, f"请等待 {remaining} 秒后再试"
            
            return True, "可以发送"
    
    def send_verification_code(self, email):
        """发送验证码"""
        # 检查发送频率限制
        can_send, message = self.can_send_code(email)
        if not can_send:
            return {
                'success': False,
                'message': message,
                'code': 'RATE_LIMITED'
            }
        
        # 生成验证码
        verification_code = self.generate_verification_code()
        
        # 发送邮件
        if self.send_verification_email(email, verification_code):
            # 保存验证码信息
            with self.lock:
                self.verification_codes[email] = {
                    'code': verification_code,
                    'expires_at': datetime.now() + timedelta(minutes=self.code_expiry_minutes),
                    'attempts': 0,
                    'last_send_time': datetime.now()
                }
            
            logger.info(f"验证码已发送: {email}, 验证码: {verification_code}")
            
            return {
                'success': True,
                'message': f'Verification code sent to {email}',
                'expires_in_minutes': self.code_expiry_minutes
            }
        else:
            return {
                'success': False,
                'message': 'Failed to send verification email',
                'code': 'SEND_FAILED'
            }
    
    def verify_code(self, email, input_code):
        """验证验证码"""
        with self.lock:
            if email not in self.verification_codes:
                return {
                    'success': False,
                    'message': 'No verification code found for this email',
                    'code': 'CODE_NOT_FOUND'
                }
            
            code_info = self.verification_codes[email]
            
            # 检查是否过期
            if datetime.now() > code_info['expires_at']:
                del self.verification_codes[email]
                return {
                    'success': False,
                    'message': 'Verification code has expired',
                    'code': 'CODE_EXPIRED'
                }
            
            # 检查尝试次数
            if code_info['attempts'] >= self.max_attempts:
                del self.verification_codes[email]
                return {
                    'success': False,
                    'message': f'Too many failed attempts. Please request a new code.',
                    'code': 'TOO_MANY_ATTEMPTS'
                }
            
            # 验证码校验
            if input_code == code_info['code']:
                # 验证成功，删除验证码
                del self.verification_codes[email]
                logger.info(f"验证码验证成功: {email}")
                return {
                    'success': True,
                    'message': 'Verification successful'
                }
            else:
                # 验证失败，增加尝试次数
                code_info['attempts'] += 1
                remaining_attempts = self.max_attempts - code_info['attempts']
                
                logger.warning(f"验证码验证失败: {email}, 剩余尝试次数: {remaining_attempts}")
                
                return {
                    'success': False,
                    'message': f'Invalid verification code. {remaining_attempts} attempts remaining.',
                    'code': 'INVALID_CODE',
                    'remaining_attempts': remaining_attempts
                }
    
    def cleanup_expired_codes(self):
        """清理过期的验证码（可以定期调用）"""
        with self.lock:
            current_time = datetime.now()
            expired_emails = [
                email for email, info in self.verification_codes.items()
                if current_time > info['expires_at']
            ]
            
            for email in expired_emails:
                del self.verification_codes[email]
            
            if expired_emails:
                logger.info(f"清理了 {len(expired_emails)} 个过期验证码")
    
    def get_verification_status(self, email):
        """获取验证码状态"""
        with self.lock:
            if email not in self.verification_codes:
                return None
            
            code_info = self.verification_codes[email]
            current_time = datetime.now()
            
            if current_time > code_info['expires_at']:
                del self.verification_codes[email]
                return None
            
            remaining_seconds = int((code_info['expires_at'] - current_time).total_seconds())
            
            return {
                'exists': True,
                'expires_in_seconds': remaining_seconds,
                'attempts_used': code_info['attempts'],
                'max_attempts': self.max_attempts
            }

# 全局邮箱验证服务实例
email_service = EmailVerificationService()
