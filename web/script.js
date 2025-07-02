// DOM Elements
const promptInput = document.getElementById('prompt-input');
const charCount = document.querySelector('.char-count');
const ratioButtons = document.querySelectorAll('.ratio-btn');
const generateBtn = document.getElementById('generate-btn');
const imageCountSelect = document.getElementById('image-count');
const previewArea = document.getElementById('preview-area');
const currentImages = document.getElementById('current-images');
const progressOverlay = document.getElementById('progress-overlay');
// Clear All button removed - using individual delete buttons
const navItems = document.querySelectorAll('.nav-item');

// State
let selectedRatio = '1:1';
let selectedImageCount = 1;
let isGenerating = false;
let currentProgress = 0;
let userTrialStatus = null;

// API Configuration
const API_BASE_URL = window.APP_CONFIG ? window.APP_CONFIG.API_BASE_URL : 'http://localhost:81/api';

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    initEventListeners();
    updateCharCount();
    updateGenerateButtonText();
    checkAPIHealth();
    initUserSystem();
});

// Initialize user system
async function initUserSystem() {
    if (!window.AuthUtils || !window.AuthUtils.isLoggedIn()) {
        // Show login modal if not authenticated
        if (window.ModalManager) {
            window.ModalManager.showModal('loginModal');
        }
        return;
    }

    try {
        // Get user trial status
        userTrialStatus = await window.UserManager.checkTrialStatus();
        updateUIBasedOnTrialStatus();
        displayUserInfo();
    } catch (error) {
        console.error('Failed to get user trial status:', error);
        showToast('Failed to load user information', 'error');
    }
}

// Update UI based on trial status
function updateUIBasedOnTrialStatus() {
    if (!userTrialStatus) return;

    const { has_trials, remaining_trials, is_admin } = userTrialStatus;
    
    // Update generate button based on remaining trials
    if (!has_trials && !is_admin) {
        disableGenerateButton('No trials remaining');
    } else {
        enableGenerateButton();
    }
    
    // Show trial info
    showTrialInfo(remaining_trials, is_admin);
}

// Display user info in the interface
function displayUserInfo() {
    if (!userTrialStatus) return;

    const { remaining_trials, is_admin } = userTrialStatus;
    
    // Create or update user info display
    let userInfoElement = document.querySelector('.user-trial-info');
    if (!userInfoElement) {
        userInfoElement = document.createElement('div');
        userInfoElement.className = 'user-trial-info';
        
        // Insert after the generate button
        const generateBtnContainer = generateBtn.parentElement;
        generateBtnContainer.appendChild(userInfoElement);
    }
    
    const trialText = is_admin ? 'Unlimited' : remaining_trials;
    userInfoElement.innerHTML = `
        <div class="trial-status">
            <i class="fas fa-magic"></i>
            <span>Remaining generations: ${trialText}</span>
        </div>
    `;
}

// Show trial information
function showTrialInfo(remainingTrials, isAdmin) {
    if (isAdmin) {
        showToast('Admin account: Unlimited generations', 'success');
    } else if (remainingTrials > 0) {
        showToast(`You have ${remainingTrials} free generations remaining`, 'info');
    } else {
        showToast('No free generations remaining', 'warning');
    }
}

// Disable generate button
function disableGenerateButton(reason) {
    generateBtn.disabled = true;
    generateBtn.style.opacity = '0.5';
    generateBtn.style.cursor = 'not-allowed';
    
    // Update button text
    const btnText = generateBtn.querySelector('.btn-text');
    if (btnText) {
        btnText.textContent = reason;
    }
}

// Enable generate button
function enableGenerateButton() {
    if (!isGenerating) {
        generateBtn.disabled = false;
        generateBtn.style.opacity = '1';
        generateBtn.style.cursor = 'pointer';
        updateGenerateButtonText();
    }
}

// Check API health
async function checkAPIHealth() {
    try {
        const response = await fetch(`${API_BASE_URL}/health`);
        const data = await response.json();
        
        if (!data.api_key_configured) {
            showToast('Warning: API key not configured. Please set DASHSCOPE_API_KEY environment variable.', 'warning');
        }
    } catch (error) {
        console.error('API health check failed:', error);
        showToast('Warning: Backend API is not available. Please start the backend server.', 'error');
    }
}

// Event Listeners
function initEventListeners() {
    // Prompt input events
    promptInput.addEventListener('input', handlePromptInput);
    promptInput.addEventListener('keydown', handleKeydown);
    
    // Image count selection
    imageCountSelect.addEventListener('change', handleImageCountChange);
    
    // Ratio selection events
    ratioButtons.forEach(btn => {
        btn.addEventListener('click', () => handleRatioSelect(btn));
    });
    
    // Generate button event
    generateBtn.addEventListener('click', handleGenerate);
    
    // Clear all button event
    // Clear All button functionality removed
    
    // Navigation events
    navItems.forEach(item => {
        item.addEventListener('click', () => handleNavClick(item));
    });
}

// Handle prompt input changes
function handlePromptInput() {
    updateCharCount();
    toggleGenerateButton();
}

// Handle image count selection
function handleImageCountChange() {
    selectedImageCount = parseInt(imageCountSelect.value);
    updateGenerateButtonText();
}

// Handle keyboard shortcuts
function handleKeydown(e) {
    // Ctrl/Cmd + Enter to generate
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        if (!isGenerating && promptInput.value.trim()) {
            handleGenerate();
        }
    }
}

// Update character count
function updateCharCount() {
    const currentLength = promptInput.value.length;
    const maxLength = 500;
    charCount.textContent = `${currentLength}/${maxLength}`;
    
    // Change color when approaching limit
    if (currentLength > maxLength * 0.8) {
        charCount.style.color = '#f59e0b';
    } else if (currentLength > maxLength * 0.9) {
        charCount.style.color = '#ef4444';
    } else {
        charCount.style.color = 'rgba(100, 116, 139, 0.8)';
    }
    
    // Prevent further input if max length exceeded
    if (currentLength > maxLength) {
        promptInput.value = promptInput.value.substring(0, maxLength);
        charCount.textContent = `${maxLength}/${maxLength}`;
    }
}

// Toggle generate button state
function toggleGenerateButton() {
    const hasText = promptInput.value.trim().length > 0;
    generateBtn.disabled = !hasText || isGenerating;
}

// Update generate button text
function updateGenerateButtonText() {
    const btnText = document.querySelector('.btn-text');
    if (btnText) {
        const imageText = selectedImageCount === 1 ? 'Image' : 'Images';
        btnText.textContent = `Generate ${imageText}`;
    }
}

// Handle ratio selection
function handleRatioSelect(selectedBtn) {
    // Remove active class from all buttons
    ratioButtons.forEach(btn => btn.classList.remove('active'));
    
    // Add active class to selected button
    selectedBtn.classList.add('active');
    
    // Update selected ratio
    selectedRatio = selectedBtn.dataset.ratio;
    
    // Add visual feedback
    selectedBtn.style.transform = 'scale(0.95)';
    setTimeout(() => {
        selectedBtn.style.transform = '';
    }, 150);
}

// Handle navigation clicks
function handleNavClick(selectedItem) {
    // Remove active class from all nav items
    navItems.forEach(item => item.classList.remove('active'));
    
    // Add active class to selected item
    selectedItem.classList.add('active');
    
    // Add ripple effect
    createRippleEffect(selectedItem);
}

// Handle generate button click
async function handleGenerate() {
    if (isGenerating || !promptInput.value.trim()) return;
    
    // Check user authentication
    if (!window.AuthUtils || !window.AuthUtils.isLoggedIn()) {
        showToast('Please login to generate images', 'error');
        if (window.ModalManager) {
            window.ModalManager.showModal('loginModal');
        }
        return;
    }
    
    // Check trial status before generation
    if (userTrialStatus && !userTrialStatus.has_trials && !userTrialStatus.is_admin) {
        showToast('No trials remaining. Please contact support for more generations.', 'error');
        return;
    }
    
    const prompt = promptInput.value.trim();
    
    isGenerating = true;
    currentProgress = 0;
    
    // 只在第一次生成时隐藏占位符
    if (currentImages.children.length === 0) {
        previewArea.style.display = 'none';
    }
    
    showProgressOverlay();
    updateGenerateButton();
    simulateProgress();
    
    try {
        // Use trial before generation
        const trialResponse = await window.UserManager.useTrial('image_generation');
        
        if (!trialResponse.success) {
            throw new Error(trialResponse.message || 'Failed to use trial');
        }
        
        // Update trial status
        userTrialStatus = {
            has_trials: trialResponse.remaining_trials > 0 || trialResponse.is_admin,
            remaining_trials: trialResponse.remaining_trials,
            is_admin: trialResponse.is_admin
        };
        
        // Call real backend API
        const result = await generateImageAPI();
        
        if (result.success && result.images && result.images.length > 0) {
            // Show generated images
            showGeneratedImages(result.images);
            
            const imageText = result.images.length === 1 ? 'image' : 'images';
            showToast(`${result.images.length} ${imageText} generated successfully!`, 'success');
            
            // Update user info display
            displayUserInfo();
            updateUIBasedOnTrialStatus();
        } else {
            throw new Error(result.error || 'Image generation failed');
        }
    } catch (error) {
        console.error('Generation failed:', error);
        showErrorMessage(error.message);
        showToast(`Generation failed: ${error.message}`, 'error');
        
        // 只有在没有任何图片时才显示占位符
        if (currentImages.children.length === 0) {
            previewArea.style.display = 'flex';
        }
    } finally {
        isGenerating = false;
        updateGenerateButton();
        hideProgressOverlay();
    }
}

// Call backend API to generate image
async function generateImageAPI() {
    const requestData = {
        prompt: promptInput.value.trim(),
        ratio: selectedRatio,
        count: selectedImageCount
    };
    
    try {
        const response = await fetch(`${API_BASE_URL}/generate`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestData)
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || `HTTP error! status: ${response.status}`);
        }
        
        return data;
    } catch (error) {
        if (error.name === 'TypeError' && error.message.includes('fetch')) {
            throw new Error('Cannot connect to the backend server. Please ensure it is running on port 5001.');
        }
        throw error;
    }
}

// Update generate button appearance
function updateGenerateButton() {
    if (isGenerating) {
        generateBtn.disabled = true;
    } else {
        generateBtn.disabled = !promptInput.value.trim();
    }
}

// Show progress overlay
function showProgressOverlay() {
    progressOverlay.style.display = 'block';
}

// Hide progress overlay
function hideProgressOverlay() {
    progressOverlay.style.display = 'none';
}

// Simulate progress for better UX
function simulateProgress() {
    if (!isGenerating) return;
    
    // Simulate progress with some randomness
    const increment = Math.random() * 15 + 5; // 5-20% increments
    currentProgress = Math.min(currentProgress + increment, 90); // Don't exceed 90% until complete
    
    updateProgress(currentProgress);
    
    if (currentProgress < 90) {
        // Continue simulating with varying delays
        const delay = Math.random() * 2000 + 1000; // 1-3 second delays
        setTimeout(simulateProgress, delay);
    }
}

// Update progress display
function updateProgress(progress) {
    const progressPercentage = document.querySelector('.progress-percentage');
    
    if (progressPercentage) {
        progressPercentage.textContent = `${Math.round(progress)}%`;
    }
}

// Show generated images with double-click zoom functionality
function showGeneratedImages(images) {
    previewArea.style.display = 'none';
    currentImages.style.display = 'block';
    
    // Clear All button removed - using individual delete buttons
    
    // 创建新的图片组
    const imageGroup = document.createElement('div');
    imageGroup.className = 'image-group';
    
    // 添加提示词标题和删除按钮
    const promptTitle = document.createElement('div');
    promptTitle.className = 'prompt-title';
    
    const promptText = document.createElement('span');
    promptText.textContent = promptInput.value.trim();
    
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'delete-group-btn';
    deleteBtn.innerHTML = '<i class="fas fa-trash"></i> Delete';
    
    promptTitle.appendChild(promptText);
    promptTitle.appendChild(deleteBtn);
    imageGroup.appendChild(promptTitle);
    
    // 为删除按钮添加事件监听器
    deleteBtn.addEventListener('click', function() {
        if (confirm('Are you sure you want to delete this image group?')) {
            imageGroup.remove();
            // 如果没有更多图片组，显示占位符
            if (currentImages.children.length === 0) {
                currentImages.style.display = 'none';
                previewArea.style.display = 'flex';
            }
        }
    });
    
    // 创建图片网格容器
    const imageGrid = document.createElement('div');
    imageGrid.className = 'image-grid';
    
    imageGrid.innerHTML = images.map((img, index) => `
        <div class="image-item" data-image-index="${index}">
            <img src="${img.base64}" alt="Generated ${index + 1}" data-image-src="${img.base64}">
            <div class="image-actions">
                <button class="action-btn download-btn" data-download-src="${img.base64}" data-download-index="${index}">
                    <i class="fas fa-download"></i>
                </button>
                <button class="action-btn copy-btn" data-copy-src="${img.base64}">
                    <i class="fas fa-copy"></i>
                </button>
            </div>
        </div>
    `).join('');
    
    imageGroup.appendChild(imageGrid);
    
    // 为图片添加双击事件监听器
    const imageItems = imageGrid.querySelectorAll('.image-item img');
    imageItems.forEach(img => {
        img.addEventListener('dblclick', function() {
            const imageSrc = this.getAttribute('data-image-src');
            viewImageFullSize(imageSrc);
        });
    });
    
    // 为下载按钮添加事件监听器
    const downloadBtns = imageGrid.querySelectorAll('.download-btn');
    downloadBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            const imageSrc = this.getAttribute('data-download-src');
            const imageIndex = parseInt(this.getAttribute('data-download-index'));
            downloadImageData(imageSrc, imageIndex);
        });
    });
    
    // 为复制按钮添加事件监听器
    const copyBtns = imageGrid.querySelectorAll('.copy-btn');
    copyBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            const imageSrc = this.getAttribute('data-copy-src');
            copyImageData(imageSrc);
        });
    });
    
    // 追加到容器中，而不是替换
    currentImages.appendChild(imageGroup);
    
    // 滚动到最新的图片组
    setTimeout(() => {
        imageGroup.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
}

// View image in full size (double-click functionality)
function viewImageFullSize(base64Data) {
    const modal = document.createElement('div');
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.9);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
        cursor: pointer;
    `;
    
    const img = document.createElement('img');
    img.src = base64Data;
    img.style.cssText = `
        max-width: 90%;
        max-height: 90%;
        border-radius: 12px;
        box-shadow: 0 20px 40px rgba(0, 0, 0, 0.5);
        object-fit: contain;
    `;
    
    modal.appendChild(img);
    document.body.appendChild(modal);
    
    // Close modal on click
    modal.addEventListener('click', () => {
        document.body.removeChild(modal);
    });
    
    // Close modal on escape key
    const handleKeydown = (e) => {
        if (e.key === 'Escape') {
            document.body.removeChild(modal);
            document.removeEventListener('keydown', handleKeydown);
        }
    };
    document.addEventListener('keydown', handleKeydown);
}

// Download image data
function downloadImageData(base64Data, index = 0) {
    try {
        const link = document.createElement('a');
        link.href = base64Data;
        link.download = `generated-image-${index + 1}-${Date.now()}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        showToast('Image downloaded successfully!', 'success');
    } catch (error) {
        console.error('Download failed:', error);
        showToast('Download failed', 'error');
    }
}

// Copy image data to clipboard
async function copyImageData(base64Data) {
    // 检查浏览器兼容性
    if (!navigator.clipboard || !navigator.clipboard.write) {
        showToast('Your browser does not support clipboard API - try downloading instead', 'warning');
        return;
    }

    try {
        // 检测Safari浏览器
        const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
        
        if (isSafari) {
            // Safari专用处理：直接处理base64，避免fetch异步操作
            await copyImageDataSafari(base64Data);
        } else {
            // 其他浏览器使用标准方法
            await copyImageDataStandard(base64Data);
        }
        
        showToast('Image copied to clipboard successfully!', 'success');
    } catch (error) {
        console.error('Copy failed:', error);
        
        // 提供更详细的错误信息
        let errorMessage = 'Copy failed - try downloading instead';
        if (error.name === 'NotAllowedError') {
            errorMessage = 'Clipboard access denied. Please allow clipboard permissions and try again, or download instead';
        } else if (error.name === 'SecurityError') {
            errorMessage = 'Clipboard access not allowed in this context - try downloading instead';
        }
        
        showToast(errorMessage, 'error');
    }
}

// Safari专用复制方法
async function copyImageDataSafari(base64Data) {
    // 直接从base64数据创建blob，避免fetch异步操作
    const base64Response = base64Data.split(',')[1];
    const mimeMatch = base64Data.match(/data:([^;]+);/);
    const mimeType = mimeMatch ? mimeMatch[1] : 'image/png';
    
    // 将base64转换为二进制数据
    const binaryString = atob(base64Response);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    
    // 创建blob
    const blob = new Blob([bytes], { type: mimeType });
    
    // 同步执行复制操作，保持用户交互上下文
    await navigator.clipboard.write([
        new ClipboardItem({ [mimeType]: blob })
    ]);
}

// 标准浏览器复制方法
async function copyImageDataStandard(base64Data) {
    const response = await fetch(base64Data);
    const blob = await response.blob();
    
    // 确保有正确的MIME类型
    const mimeType = blob.type || 'image/png';
    
    await navigator.clipboard.write([
        new ClipboardItem({ [mimeType]: blob })
    ]);
}

// Show error message
function showErrorMessage(errorMsg = 'An unexpected error occurred during image generation.') {
    const errorContainer = document.createElement('div');
    errorContainer.className = 'error-message';
    errorContainer.innerHTML = `
        <div class="error-content">
            <i class="fas fa-exclamation-triangle" style="font-size: 48px; color: #ef4444; margin-bottom: 16px;"></i>
            <h3 style="color: #ef4444; margin-bottom: 12px;">Generation Failed</h3>
            <p style="color: rgba(100, 116, 139, 0.8); margin-bottom: 16px;">${errorMsg}</p>
            <button onclick="this.parentElement.parentElement.remove()" 
                    style="background: #ef4444; color: white; border: none; padding: 8px 16px; 
                           border-radius: 6px; cursor: pointer; transition: all 0.3s ease;">
                Dismiss
            </button>
        </div>
    `;
    
    errorContainer.style.cssText = `
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 40px;
        text-align: center;
        background: rgba(239, 68, 68, 0.1);
        border: 1px solid rgba(239, 68, 68, 0.2);
        border-radius: 12px;
        margin: 20px 0;
    `;
    
    previewArea.innerHTML = '';
    previewArea.appendChild(errorContainer);
}

// Create ripple effect
function createRippleEffect(element) {
    const ripple = document.createElement('span');
    const rect = element.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height);
    
    ripple.style.width = ripple.style.height = size + 'px';
    ripple.style.left = '50%';
    ripple.style.top = '50%';
    ripple.style.transform = 'translate(-50%, -50%)';
    ripple.classList.add('ripple');
    
    const existingRipple = element.querySelector('.ripple');
    if (existingRipple) {
        existingRipple.remove();
    }
    
    element.appendChild(ripple);
    
    setTimeout(() => {
        ripple.remove();
    }, 600);
}

// Show toast notification
function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    const icons = {
        success: 'fas fa-check-circle',
        error: 'fas fa-exclamation-circle',
        warning: 'fas fa-exclamation-triangle',
        info: 'fas fa-info-circle'
    };
    
    const colors = {
        success: '#10b981',
        error: '#ef4444',
        warning: '#f59e0b',
        info: '#3b82f6'
    };
    
    toast.innerHTML = `
        <i class="${icons[type]}" style="color: ${colors[type]}; margin-right: 8px;"></i>
        ${message}
    `;
    
    toast.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: rgba(255, 255, 255, 0.95);
        color: #1e293b;
        padding: 12px 20px;
        border-radius: 8px;
        border-left: 4px solid ${colors[type]};
        z-index: 10000;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        backdrop-filter: blur(10px);
        transform: translateX(100%);
        transition: transform 0.3s ease;
        max-width: 300px;
        word-wrap: break-word;
    `;
    
    document.body.appendChild(toast);
    
    // Animate in
    setTimeout(() => {
        toast.style.transform = 'translateX(0)';
    }, 100);
    
    // Auto remove
    setTimeout(() => {
        toast.style.transform = 'translateX(100%)';
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 300);
    }, 5000);
}

// Add CSS for loading spinner and ripple animation
const style = document.createElement('style');
style.textContent = `
    .loading-spinner {
        width: 20px;
        height: 20px;
        border: 2px solid rgba(99, 102, 241, 0.2);
        border-top: 2px solid #6366f1;
        border-radius: 50%;
        animation: spin 1s ease-in-out infinite;
    }
    
    @keyframes spin {
        to { transform: rotate(360deg); }
    }
    
    @keyframes ripple {
        to {
            transform: scale(4);
            opacity: 0;
        }
    }
    
    .ripple {
        position: absolute;
        border-radius: 50%;
        background: rgba(99, 102, 241, 0.3);
        transform: scale(0);
        animation: ripple 0.6s linear;
        pointer-events: none;
    }
`;

document.head.appendChild(style);

// Clear all images
function clearAllImages() {
    currentImages.innerHTML = '';
    currentImages.style.display = 'none';
    previewArea.style.display = 'flex';
    // Clear All button removed
    showToast('All images cleared', 'info');
} 