// DOM Elements
const promptInput = document.getElementById('prompt-input');
const charCount = document.querySelector('.char-count');
const generateBtn = document.getElementById('generate-btn');
const previewArea = document.getElementById('preview-area');
const currentImages = document.getElementById('current-images');

// New selector elements
const contentTypeSelector = document.getElementById('contentTypeSelector');
const contentTypeDropdown = document.getElementById('contentTypeDropdown');
const aspectRatioSelector = document.getElementById('aspectRatioSelector');
const aspectRatioDropdown = document.getElementById('aspectRatioDropdown');
const imageCountSelector = document.getElementById('imageCountSelector');
const imageCountDropdown = document.getElementById('imageCountDropdown');
const videoTypeSelector = document.getElementById('videoTypeSelector');
const videoTypeDropdown = document.getElementById('videoTypeDropdown');
const videoResolutionSelector = document.getElementById('videoResolutionSelector');
const videoResolutionDropdown = document.getElementById('videoResolutionDropdown');
const imageControls = document.getElementById('imageControls');
const videoControls = document.getElementById('videoControls');

// Compact selector elements
const contentTypeSelectorCompact = document.getElementById('contentTypeSelectorCompact');
const aspectRatioSelectorCompact = document.getElementById('aspectRatioSelectorCompact');
const imageCountSelectorCompact = document.getElementById('imageCountSelectorCompact');

const navItems = document.querySelectorAll('.nav-item');

// State
let selectedContentType = 'image'; // 'image' or 'video'
let selectedRatio = '1:1';
let selectedImageCount = 1;
let selectedVideoType = 'text-to-video'; // 'text-to-video' or 'image-to-video'
let selectedVideoResolution = '1920*1080'; // '1920*1080', '1280*720', '832*480'
let isGenerating = false;
let currentProgress = 0;
let userTrialStatus = null;

// Image upload state
let uploadedImageData = null; // Store base64 image data
let uploadedImageFile = null; // Store original file

// 会话管理状态
let conversations = [];
let currentConversationId = null;
let conversationHistory = [];

// API Configuration
const API_BASE_URL = window.APP_CONFIG ? window.APP_CONFIG.API_BASE_URL : 'http://localhost:81/api';

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    initEventListeners();
    updateCharCount();
    updateGenerateButtonText();
    updateContentTypeDisplay(); // Initialize content type display
    updateAspectRatioDisplay(selectedRatio); // Initialize aspect ratio display
    updateImageCountDisplay(selectedImageCount); // Initialize image count display
    updateVideoTypeDisplay(selectedVideoType); // Initialize video type display
    updateVideoResolutionDisplay(selectedVideoResolution); // Initialize video resolution display
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
        
        // Load conversations
        await loadConversations();
        
        // Load conversation history if there's a current conversation
        if (currentConversationId) {
            await loadConversationHistory(currentConversationId);
        }
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
    
    // Show trial info - commented out to remove popup notification
    // showTrialInfo(remaining_trials, is_admin);
}

// Display user info in the interface
function displayUserInfo() {
    if (!userTrialStatus) return;

    const { remaining_trials, is_admin } = userTrialStatus;
    
    // Update top-right user status display
    updateUserStatusDisplay();
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

// Update top-right user status display
function updateUserStatusDisplay() {
    const userStatusDisplay = document.getElementById('userStatusDisplay');
    const subscriptionPlan = document.getElementById('subscriptionPlan');
    const trialCount = document.getElementById('trialCount');
    
    if (!userStatusDisplay || !subscriptionPlan || !trialCount) {
        console.warn('User status display elements not found');
        return;
    }
    
    if (!userTrialStatus) {
        userStatusDisplay.style.display = 'none';
        return;
    }
    
    const { remaining_trials, is_admin } = userTrialStatus;
    
    // Show the user status display
    userStatusDisplay.style.display = 'flex';
    
    // Update trial count
    trialCount.textContent = is_admin ? '∞' : remaining_trials;
    
    // Update subscription plan (for now, show "Subscribe" as placeholder)
    // TODO: This should be fetched from user's actual subscription data
    subscriptionPlan.textContent = 'Subscribe';
    subscriptionPlan.className = 'subscription-plan unsubscribed';
    
    // Add click handler for subscription plan
    subscriptionPlan.onclick = () => {
        window.location.href = 'subscribe.html';
    };
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
    
    // Initialize new selector functionality
    initSelectorEvents();
    
    // Initialize expandable dialog functionality
    initExpandableDialog();
    
    // Initialize compact controls
    initCompactControls();
    
    // Generate button event
    generateBtn.addEventListener('click', handleGenerate);
    
    // Navigation events
    navItems.forEach(item => {
        item.addEventListener('click', () => handleNavClick(item));
    });
    
    // 新建会话按钮事件
    const newConversationBtn = document.getElementById('newConversationBtn');
    if (newConversationBtn) {
        newConversationBtn.addEventListener('click', handleNewConversation);
    }
    
    // Initialize image upload events
    initImageUploadEvents();
}

// Handle prompt input changes
function handlePromptInput() {
    updateCharCount();
    toggleGenerateButton();
}

// Initialize selector events
function initSelectorEvents() {
    // Content type selector
    if (contentTypeSelector && contentTypeDropdown) {
        initSelectorDropdown(contentTypeSelector, contentTypeDropdown, (value) => {
            selectedContentType = value;
            updateContentTypeDisplay();
            updateGenerateButtonText();
        });
    }
    
    // Aspect ratio selector
    if (aspectRatioSelector && aspectRatioDropdown) {
        initSelectorDropdown(aspectRatioSelector, aspectRatioDropdown, (value) => {
            selectedRatio = value;
            updateAspectRatioDisplay(value);
        });
    }
    
    // Image count selector
    if (imageCountSelector && imageCountDropdown) {
        initSelectorDropdown(imageCountSelector, imageCountDropdown, (value) => {
            selectedImageCount = parseInt(value);
            updateImageCountDisplay(value);
            updateGenerateButtonText();
        });
    }
    
    // Video type selector
    if (videoTypeSelector && videoTypeDropdown) {
        initSelectorDropdown(videoTypeSelector, videoTypeDropdown, (value) => {
            selectedVideoType = value;
            updateVideoTypeDisplay(value);
        });
    }
    
    // Video resolution selector
    if (videoResolutionSelector && videoResolutionDropdown) {
        initSelectorDropdown(videoResolutionSelector, videoResolutionDropdown, (value) => {
            selectedVideoResolution = value;
            updateVideoResolutionDisplay(value);
        });
    }
}

// Generic selector dropdown initialization
function initSelectorDropdown(selectorBtn, dropdown, onSelect) {
    // Toggle dropdown on button click
    selectorBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        
        // Close other dropdowns
        document.querySelectorAll('.selector-dropdown.show').forEach(d => {
            if (d !== dropdown) {
                d.classList.remove('show');
                d.previousElementSibling.classList.remove('open');
            }
        });
        
        // Toggle current dropdown
        dropdown.classList.toggle('show');
        selectorBtn.classList.toggle('open');
    });
    
    // Handle option selection
    dropdown.addEventListener('click', (e) => {
        const option = e.target.closest('.dropdown-option');
        if (!option) return;
        
        e.stopPropagation();
        
        // Update active state
        dropdown.querySelectorAll('.dropdown-option').forEach(opt => {
            opt.classList.remove('active');
            opt.querySelector('.fa-check').style.display = 'none';
        });
        
        option.classList.add('active');
        option.querySelector('.fa-check').style.display = 'inline';
        
        // Update selector button
        const selectorText = selectorBtn.querySelector('.selector-text');
        const selectorIcon = selectorBtn.querySelector('.selector-icon');
        // 兼容：某些下拉项含有 .option-icon（例如内容类型、比例），而精简的数量下拉没有该图标
        // 旧结构依赖 span:nth-child(2)，在移除第一个 emoji/icon span 后失效
        let labelSpan = option.querySelector('.option-icon ~ span');
        if (!labelSpan) {
            // 回退到第一个普通 span（数量下拉 / 未来其它精简结构）
            labelSpan = option.querySelector('span');
        }
        const optionText = (labelSpan ? labelSpan.textContent : option.getAttribute('data-value') || '').trim();
        const optionIcon = option.querySelector('.option-icon');
        
        selectorText.textContent = optionText;
        if (optionIcon && selectorIcon) {
            // 仅当下拉项自身有图标（内容类型/比例/视频类型）时同步按钮图标；数量选择保留固定的 fa-images 图标
            selectorIcon.innerHTML = optionIcon.innerHTML;
        }
        
        // Close dropdown
        dropdown.classList.remove('show');
        selectorBtn.classList.remove('open');
        
        // Call callback
        onSelect(option.dataset.value);
    });
}

// Close dropdowns when clicking outside
document.addEventListener('click', () => {
    document.querySelectorAll('.selector-dropdown.show').forEach(dropdown => {
        dropdown.classList.remove('show');
        dropdown.previousElementSibling.classList.remove('open');
    });
});

// Update content type display
function updateContentTypeDisplay() {
    if (selectedContentType === 'image') {
        imageControls.style.display = 'flex';
        videoControls.style.display = 'none';
    } else {
        imageControls.style.display = 'none';
        videoControls.style.display = 'flex';
    }
    
    // Update compact controls
    if (contentTypeSelectorCompact) {
        const compactIcon = contentTypeSelectorCompact.querySelector('.selector-icon i');
        const compactText = contentTypeSelectorCompact.querySelector('.selector-text');
        if (selectedContentType === 'image') {
            compactIcon.className = 'fas fa-image';
            compactText.textContent = 'Image';
        } else {
            compactIcon.className = 'fas fa-video';
            compactText.textContent = 'Video';
        }
    }
}

// Update aspect ratio display
function updateAspectRatioDisplay(ratio) {
    const selectorIcon = aspectRatioSelector.querySelector('.selector-icon .ratio-preview');
    if (selectorIcon) {
        selectorIcon.className = 'ratio-preview';
        switch (ratio) {
            case '1:1': selectorIcon.classList.add('square'); break;
            case '16:9': selectorIcon.classList.add('wide'); break;
            case '9:16': selectorIcon.classList.add('tall'); break;
            case '4:3': selectorIcon.classList.add('standard'); break;
            case '3:4': selectorIcon.classList.add('portrait'); break;
        }
    }
    
    // Update compact controls
    if (aspectRatioSelectorCompact) {
        const compactIcon = aspectRatioSelectorCompact.querySelector('.selector-icon .ratio-preview');
        const compactText = aspectRatioSelectorCompact.querySelector('.selector-text');
        if (compactIcon) {
            compactIcon.className = 'ratio-preview';
            switch (ratio) {
                case '1:1': compactIcon.classList.add('square'); break;
                case '16:9': compactIcon.classList.add('wide'); break;
                case '9:16': compactIcon.classList.add('tall'); break;
                case '4:3': compactIcon.classList.add('standard'); break;
                case '3:4': compactIcon.classList.add('portrait'); break;
            }
        }
        compactText.textContent = ratio;
    }
}

// Update image count display
function updateImageCountDisplay(count) {
    const text = count;
    imageCountSelector.querySelector('.selector-text').textContent = text;
    
    // Update compact controls
    if (imageCountSelectorCompact) {
        imageCountSelectorCompact.querySelector('.selector-text').textContent = text;
    }
}

// Update video type display
function updateVideoTypeDisplay(type) {
    console.log('=== 更新视频类型显示 ===');
    console.log('视频类型:', type);
    
    const text = type === 'image-to-video' ? 'Image to Video' : 'Text to Video';
    videoTypeSelector.querySelector('.selector-text').textContent = text;
    
    // Show/hide image upload area based on video type
    const imageUploadGroup = document.getElementById('imageUploadGroup');
    if (imageUploadGroup) {
        if (type === 'image-to-video') {
            console.log('显示图片上传区域');
            imageUploadGroup.style.display = 'block';
        } else {
            console.log('隐藏图片上传区域');
            imageUploadGroup.style.display = 'none';
            // Clear uploaded image when switching away from image-to-video
            clearUploadedImage();
        }
    } else {
        console.warn('未找到图片上传区域元素');
    }
    
    console.log('视频类型显示更新完成');
}

// Update video resolution display
function updateVideoResolutionDisplay(resolution) {
    const resolutionMap = {
        '1920*1080': '1080P',
        '1280*720': '720P',
        '832*480': '480P'
    };
    const text = resolutionMap[resolution] || '1080P';
    videoResolutionSelector.querySelector('.selector-text').textContent = text;
}

// Image upload functionality
function initImageUploadEvents() {
    const uploadPlaceholder = document.getElementById('uploadPlaceholder');
    const imageUploadInput = document.getElementById('imageUploadInput');
    const removeImageBtn = document.getElementById('removeImageBtn');
    
    if (uploadPlaceholder && imageUploadInput) {
        // Click to upload
        uploadPlaceholder.addEventListener('click', () => {
            imageUploadInput.click();
        });
        
        // Handle file selection
        imageUploadInput.addEventListener('change', handleImageUpload);
    }
    
    if (removeImageBtn) {
        removeImageBtn.addEventListener('click', clearUploadedImage);
    }
}

function handleImageUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    // Validate file type
    if (!file.type.startsWith('image/')) {
        alert('Please select a valid image file.');
        return;
    }
    
    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
        alert('Image file size should be less than 10MB.');
        return;
    }
    
    // Convert to base64
    const reader = new FileReader();
    reader.onload = function(e) {
        uploadedImageData = e.target.result;
        uploadedImageFile = file;
        displayUploadedImage(e.target.result);
    };
    reader.readAsDataURL(file);
}

function displayUploadedImage(imageSrc) {
    const uploadPlaceholder = document.getElementById('uploadPlaceholder');
    const uploadedImagePreview = document.getElementById('uploadedImagePreview');
    const previewImage = document.getElementById('previewImage');
    
    if (uploadPlaceholder && uploadedImagePreview && previewImage) {
        uploadPlaceholder.style.display = 'none';
        uploadedImagePreview.style.display = 'flex';
        previewImage.src = imageSrc;
    }
}

function clearUploadedImage() {
    const uploadPlaceholder = document.getElementById('uploadPlaceholder');
    const uploadedImagePreview = document.getElementById('uploadedImagePreview');
    const imageUploadInput = document.getElementById('imageUploadInput');
    
    uploadedImageData = null;
    uploadedImageFile = null;
    
    if (uploadPlaceholder && uploadedImagePreview) {
        uploadPlaceholder.style.display = 'flex';
        uploadedImagePreview.style.display = 'none';
    }
    
    if (imageUploadInput) {
        imageUploadInput.value = '';
    }
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
        charCount.style.color = 'rgba(255, 255, 255, 0.4)';
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
    // Update button to show only arrow icon for compact design
    generateBtn.innerHTML = '<i class="fas fa-arrow-right"></i>';
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
    
    // 创建占位符并显示进度
    const placeholder = createContentPlaceholder(prompt, selectedContentType);
    
    // 只在第一次生成时隐藏占位符
    if (currentImages.children.length === 0) {
        previewArea.style.display = 'none';
    }
    
    // 显示当前图片容器
    currentImages.style.display = 'block';
    
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
        
        // Call appropriate API based on content type
        let result;
        console.log('=== 接口选择调试信息 ===');
        console.log('selectedContentType:', selectedContentType);
        console.log('selectedVideoType:', selectedVideoType);
        console.log('uploadedImageData存在:', !!uploadedImageData);
        
        if (selectedContentType === 'image') {
            console.log('调用图片生成API');
            result = await generateImageAPI();
        } else if (selectedContentType === 'video' && selectedVideoType === 'image-to-video') {
            console.log('调用图片转视频API');
            // Validate that an image has been uploaded
            if (!uploadedImageData) {
                throw new Error('Please upload an image first for Image to Video generation');
            }
            result = await generateImageToVideoAPI();
        } else if (selectedContentType === 'video') {
            console.log('调用文本生成视频API');
            result = await generateVideoAPI();
        } else {
            console.log('不支持的内容类型');
            // For now, show a message that this content type is not implemented
            throw new Error('This content type is not yet supported!');
        }
        
        if (result.success) {
            if (selectedContentType === 'image' && result.images && result.images.length > 0) {
                // 处理图片生成结果
                console.log('=== 图片生成结果 ===');
                console.log('结果对象:', result);
                console.log('图片数量:', result.images.length);
                console.log('图片数组:', result.images);
                result.images.forEach((img, index) => {
                    console.log(`图片 ${index + 1}:`, {
                        url: img.url,
                        base64_length: img.base64 ? img.base64.length : 0,
                        base64_preview: img.base64 ? img.base64.substring(0, 50) + '...' : 'null'
                    });
                });
                
                // 填充生成的图片到占位符位置
                fillGeneratedImages(placeholder, result.images);
                
                const imageText = result.images.length === 1 ? 'image' : 'images';
                showToast(`${result.images.length} ${imageText} generated successfully!`, 'success');
            } else if (selectedContentType === 'video' && result.videos && result.videos.length > 0) {
                // 处理视频生成结果
                console.log('=== 视频生成结果 ===');
                console.log('结果对象:', result);
                console.log('视频数量:', result.videos.length);
                console.log('视频数组:', result.videos);
                
                // 填充生成的视频到占位符位置
                fillGeneratedVideos(placeholder, result.videos);
                
                const videoText = result.videos.length === 1 ? 'video' : 'videos';
                showToast(`${result.videos.length} ${videoText} generated successfully!`, 'success');
            } else if (selectedVideoType === 'image-to-video' && result.video) {
                // 处理Image-to-Video生成结果
                console.log('=== Image-to-Video生成结果 ===');
                console.log('结果对象:', result);
                console.log('视频URL:', result.video);
                
                // 填充生成的视频到占位符位置
                fillGeneratedVideos(placeholder, [{ url: result.video }]);
                
                showToast('Image-to-Video generated successfully!', 'success');
                
                // 清除上传的图片
                clearUploadedImage();
            } else {
                throw new Error('No content generated');
            }
            
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
        
        // 移除失败的占位符
        if (placeholder && placeholder.parentNode) {
            placeholder.remove();
        }
        
        // 只有在没有任何图片时才显示占位符
        if (currentImages.children.length === 0) {
            previewArea.style.display = 'flex';
        }
    } finally {
        isGenerating = false;
        updateGenerateButton();
    }
}

// Call backend API to generate image
async function generateImageAPI() {
    const requestData = {
        prompt: promptInput.value.trim(),
        ratio: selectedRatio,
        count: selectedImageCount,
        conversation_id: currentConversationId // 包含当前会话ID
    };
    
    try {
        const token = window.AuthUtils.getToken();
        const response = await fetch(`${API_BASE_URL}/generate`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}` // 添加认证头
            },
            body: JSON.stringify(requestData)
        });
        
        const data = await response.json();
        
        // 添加详细的响应数据调试
        console.log('=== API响应详细信息 ===');
        console.log('响应状态:', response.status);
        console.log('响应数据完整对象:', data);
        console.log('data.success:', data.success);
        console.log('data.images:', data.images);
        console.log('data.images 类型:', typeof data.images);
        console.log('data.images 是否为数组:', Array.isArray(data.images));
        if (data.images) {
            console.log('data.images 长度:', data.images.length);
        }
        console.log('data 的所有键:', Object.keys(data));
        
        if (!response.ok) {
            throw new Error(data.error || `HTTP error! status: ${response.status}`);
        }
        
        // 如果生成成功，更新当前会话ID和试用次数信息
        if (data.success && data.conversation_id) {
            currentConversationId = data.conversation_id;
            
            // 更新试用次数显示
            if (data.remaining_trials !== undefined) {
                if (userTrialStatus) {
                    userTrialStatus.remaining_trials = data.remaining_trials;
                    displayUserInfo();
                }
            }
        }
        
        return data;
    } catch (error) {
        if (error.name === 'TypeError' && error.message.includes('fetch')) {
            throw new Error('Cannot connect to the backend server. Please ensure it is running on port 81.');
        }
        throw error;
    }
}

// Generate video using video API
async function generateVideoAPI() {
    const requestData = {
        prompt: promptInput.value.trim(),
        video_type: selectedVideoType,
        size: selectedVideoResolution,  // 后端期望的是 size 参数
        conversation_id: currentConversationId // 包含当前会话ID
    };
    
    try {
        const token = window.AuthUtils.getToken();
        const response = await fetch(`${API_BASE_URL}/generate-video`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}` // 添加认证头
            },
            body: JSON.stringify(requestData)
        });
        
        const data = await response.json();
        
        // 添加详细的响应数据调试
        console.log('=== Video API响应详细信息 ===');
        console.log('响应状态:', response.status);
        console.log('响应数据完整对象:', data);
        console.log('data.success:', data.success);
        console.log('data.task_id:', data.task_id);
        console.log('data 的所有键:', Object.keys(data));
        
        if (!response.ok) {
            throw new Error(data.error || `HTTP error! status: ${response.status}`);
        }
        
        // 如果视频生成任务创建成功，开始轮询状态
        if (data.success && data.task_id) {
            const videoResult = await pollVideoStatus(data.task_id);
            
            // 更新当前会话ID和试用次数信息
            if (data.conversation_id) {
                currentConversationId = data.conversation_id;
            }
            
            // 更新试用次数显示
            if (data.remaining_trials !== undefined) {
                if (userTrialStatus) {
                    userTrialStatus.remaining_trials = data.remaining_trials;
                    displayUserInfo();
                }
            }
            
            return videoResult;
        } else {
            throw new Error(data.error || 'Failed to create video generation task');
        }
        
    } catch (error) {
        if (error.name === 'TypeError' && error.message.includes('fetch')) {
            throw new Error('Cannot connect to the backend server. Please ensure it is running on port 81.');
        }
        throw error;
    }
}

// Generate Image-to-Video using Image-to-Video API
async function generateImageToVideoAPI() {
    const requestData = {
        prompt: promptInput.value.trim(),
        image_base64: uploadedImageData, // base64图像数据
        conversation_id: currentConversationId
    };
    
    console.log('=== Image-to-Video API请求数据 ===');
    console.log('prompt:', requestData.prompt);
    console.log('conversation_id:', requestData.conversation_id);
    console.log('image_base64 前50字符:', requestData.image_base64 ? requestData.image_base64.substring(0, 50) : 'null');
    console.log('image_base64 总长度:', requestData.image_base64 ? requestData.image_base64.length : 0);
    console.log('uploadedImageData:', !!uploadedImageData);
    
    try {
        const token = window.AuthUtils.getToken();
        const response = await fetch(`${API_BASE_URL}/generate-image-to-video`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(requestData)
        });
        
        const data = await response.json();
        
        console.log('=== Image-to-Video API响应详细信息 ===');
        console.log('响应状态:', response.status);
        console.log('响应数据完整对象:', data);
        console.log('data.success:', data.success);
        console.log('data.task_id:', data.task_id);
        console.log('data 的所有键:', Object.keys(data));
        
        if (!response.ok) {
            throw new Error(data.error || `HTTP error! status: ${response.status}`);
        }
        
        // 如果Image-to-Video生成任务创建成功，开始轮询状态
        if (data.success && data.task_id) {
            const videoResult = await pollImageToVideoStatus(data.task_id);
            
            // 更新当前会话ID和试用次数信息
            if (data.conversation_id) {
                currentConversationId = data.conversation_id;
            }
            
            // 更新试用次数显示
            if (data.remaining_trials !== undefined) {
                if (userTrialStatus) {
                    userTrialStatus.remaining_trials = data.remaining_trials;
                    displayUserInfo();
                }
            }
            
            return videoResult;
        } else {
            throw new Error(data.error || 'Failed to create Image-to-Video generation task');
        }
        
    } catch (error) {
        if (error.name === 'TypeError' && error.message.includes('fetch')) {
            throw new Error('Cannot connect to the backend server. Please ensure it is running on port 81.');
        }
        throw error;
    }
}

// Poll Image-to-Video generation status
async function pollVideoStatus(taskId) {
    const maxAttempts = 15; // 最大尝试次数（约5分钟，15次 × 20秒）
    const interval = 20000; // 20秒间隔
    
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        try {
            const token = window.AuthUtils.getToken();
            const response = await fetch(`${API_BASE_URL}/video-status/${taskId}`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            const data = await response.json();
            
            console.log(`轮询状态 (尝试 ${attempt + 1}):`, data);
            console.log('任务状态:', data.task_status);
            console.log('视频URL:', data.video_url);
            
            if (!response.ok) {
                throw new Error(data.error || `HTTP error! status: ${response.status}`);
            }
            
            if (data.task_status === 'SUCCEEDED') {
                // 视频生成成功，返回结果
                return {
                    success: true,
                    videos: [{
                        url: data.video_url,
                        task_id: taskId
                    }]
                };
            } else if (data.task_status === 'FAILED') {
                throw new Error(data.message || 'Video generation failed');
            } else if (data.task_status === 'RUNNING' || data.task_status === 'PENDING') {
                // 继续等待
                await new Promise(resolve => setTimeout(resolve, interval));
                continue;
            } else {
                throw new Error(`Unknown status: ${data.task_status}`);
            }
        } catch (error) {
            console.error(`轮询状态出错 (尝试 ${attempt + 1}):`, error);
            if (attempt === maxAttempts - 1) {
                throw error;
            }
            await new Promise(resolve => setTimeout(resolve, interval));
        }
    }
    
    throw new Error('Video generation timeout (5 minutes). Please try again later.');
}

// Poll Image-to-Video generation status
async function pollImageToVideoStatus(taskId) {
    const maxAttempts = 15; // 最大尝试次数（约5分钟，15次 × 20秒）
    const interval = 20000; // 20秒间隔
    
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        try {
            const token = window.AuthUtils.getToken();
            const response = await fetch(`${API_BASE_URL}/image-to-video-status/${taskId}`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            const data = await response.json();
            
            console.log(`轮询Image-to-Video状态 (尝试 ${attempt + 1}):`, data);
            console.log('任务状态:', data.task_status);
            console.log('视频URL:', data.video_url);
            
            if (!response.ok) {
                throw new Error(data.error || `HTTP error! status: ${response.status}`);
            }
            
            if (data.task_status === 'SUCCEEDED') {
                // Image-to-Video生成成功，返回结果
                return {
                    success: true,
                    video: data.video_url,
                    task_id: taskId
                };
            } else if (data.task_status === 'FAILED') {
                throw new Error(data.message || 'Image-to-Video generation failed');
            } else if (data.task_status === 'RUNNING' || data.task_status === 'PENDING') {
                // 继续等待
                await new Promise(resolve => setTimeout(resolve, interval));
                continue;
            } else {
                throw new Error(`Unknown status: ${data.task_status}`);
            }
        } catch (error) {
            console.error(`轮询Image-to-Video状态出错 (尝试 ${attempt + 1}):`, error);
            if (attempt === maxAttempts - 1) {
                throw error;
            }
            await new Promise(resolve => setTimeout(resolve, interval));
        }
    }
    
    throw new Error('Image-to-Video generation timeout (5 minutes). Please try again later.');
}

// Update generate button appearance
function updateGenerateButton() {
    if (isGenerating) {
        generateBtn.disabled = true;
    } else {
        generateBtn.disabled = !promptInput.value.trim();
    }
}

// Simulate progress for better UX
function simulateProgress() {
    if (!isGenerating) return;
    
    // 只有图片生成才模拟进度，视频生成不需要进度条
    if (selectedContentType === 'video') {
        return; // 视频生成不显示进度百分比
    }
    
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
    const placeholderPercentage = document.querySelector('.placeholder-percentage');
    
    if (placeholderPercentage) {
        placeholderPercentage.textContent = `${Math.round(progress)}%`;
    }
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

// View video in full size modal
function viewVideoFullSize(videoUrl) {
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
    
    const video = document.createElement('video');
    video.src = videoUrl;
    video.controls = true;
    video.autoplay = true;
    video.style.cssText = `
        max-width: 90%;
        max-height: 90%;
        border-radius: 12px;
        box-shadow: 0 20px 40px rgba(0, 0, 0, 0.5);
        cursor: default;
    `;
    
    // Prevent closing modal when clicking on video
    video.addEventListener('click', (e) => {
        e.stopPropagation();
    });
    
    modal.appendChild(video);
    document.body.appendChild(modal);
    
    // Close modal on click
    modal.addEventListener('click', () => {
        video.pause();
        document.body.removeChild(modal);
    });
    
    // Close modal on escape key
    const handleKeydown = (e) => {
        if (e.key === 'Escape') {
            video.pause();
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

// Download video data
function downloadVideoData(videoUrl, index = 0) {
    try {
        const link = document.createElement('a');
        link.href = videoUrl;
        link.download = `generated-video-${index + 1}-${Date.now()}.mp4`;
        link.target = '_blank'; // 新窗口下载，避免页面跳转
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        showToast('Video download started!', 'success');
    } catch (error) {
        console.error('Video download failed:', error);
        showToast('Video download failed', 'error');
    }
}

// Copy video URL to clipboard
async function copyVideoData(videoUrl) {
    try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            await navigator.clipboard.writeText(videoUrl);
            showToast('Video URL copied to clipboard!', 'success');
        } else {
            // Fallback for older browsers
            const textArea = document.createElement('textarea');
            textArea.value = videoUrl;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            showToast('Video URL copied to clipboard!', 'success');
        }
    } catch (error) {
        console.error('Copy video URL failed:', error);
        showToast('Copy failed - try downloading instead', 'error');
    }
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

// Show toast notification (simplified - only show critical errors)
function showToast(message, type = 'info') {
    // Only show critical error messages to user
    if (type === 'error' && (
        message.includes('login') || 
        message.includes('trials remaining') || 
        message.includes('Generation failed') ||
        message.includes('Failed to load user information')
    )) {
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        
        const colors = {
            error: '#ef4444'
        };
        
        toast.innerHTML = `
            <i class="fas fa-exclamation-circle" style="color: ${colors[type]}; margin-right: 8px;"></i>
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
    } else {
        // For non-critical messages, just log to console
        console.log(`[${type.toUpperCase()}] ${message}`);
    }
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

// ===== 会话管理功能 =====

// 加载用户的所有会话
async function loadConversations() {
    try {
        const token = window.AuthUtils.getToken();
        const response = await fetch(`${API_BASE_URL}/conversations`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        const data = await response.json();
        
        if (data.success) {
            conversations = data.conversations;
            
            // 如果有会话，自动选择最新的会话
            if (conversations.length > 0) {
                currentConversationId = conversations[0].id;
            }
            
            // 更新会话列表UI
            updateConversationsList();
            
            console.log('Conversations loaded:', conversations);
        } else {
            console.error('Failed to load conversations:', data.error);
        }
    } catch (error) {
        console.error('Error loading conversations:', error);
    }
}

// 创建新会话
async function createNewConversation(title = null) {
    try {
        const token = window.AuthUtils.getToken();
        const response = await fetch(`${API_BASE_URL}/conversations`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ title })
        });

        const data = await response.json();
        
        if (data.success) {
            // 重新加载会话列表
            await loadConversations();
            
            // 设置为当前会话
            currentConversationId = data.conversation_id;
            
            // 清空当前图片显示
            clearCurrentImages();
            
            showToast('New conversation created successfully', 'success');
            
            return data.conversation_id;
        } else {
            showToast('Failed to create conversation: ' + data.error, 'error');
            return null;
        }
    } catch (error) {
        console.error('Error creating conversation:', error);
        showToast('Failed to create conversation', 'error');
        return null;
    }
}

// 加载会话历史
async function loadConversationHistory(conversationId) {
    try {
        const token = window.AuthUtils.getToken();
        const response = await fetch(`${API_BASE_URL}/conversations/${conversationId}/history`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        const data = await response.json();
        
        if (data.success) {
            conversationHistory = data.history;
            
            console.log('=== 会话历史加载成功 ===');
            console.log('历史记录总数:', conversationHistory.length);
            console.log('原始历史数据:', data.history);
            
            // 分析记录类型
            const imageCount = conversationHistory.filter(item => item.type === 'image').length;
            const videoCount = conversationHistory.filter(item => item.type === 'video').length;
            console.log(`图片记录数: ${imageCount}, 视频记录数: ${videoCount}`);
            
            // 显示历史图片
            displayConversationHistory();
            
            console.log('Conversation history loaded:', conversationHistory);
        } else {
            console.error('Failed to load conversation history:', data.error);
        }
    } catch (error) {
        console.error('Error loading conversation history:', error);
    }
}

// 显示会话历史
function displayConversationHistory() {
    if (conversationHistory.length === 0) {
        // 如果没有历史记录，显示占位符
        currentImages.style.display = 'none';
        previewArea.style.display = 'flex';
        return;
    }

    previewArea.style.display = 'none';
    currentImages.style.display = 'block';
    
    // 清空当前内容
    currentImages.innerHTML = '';
    
    // 按提示词和时间分组历史记录
    const groupedHistory = {};
    
    conversationHistory.forEach((historyItem) => {
        const prompt = historyItem.prompt;
        const timeKey = historyItem.created_at.substring(0, 16); // 精确到分钟
        const groupKey = `${prompt}_${timeKey}`;
        
        if (!groupedHistory[groupKey]) {
            groupedHistory[groupKey] = {
                prompt: prompt,
                created_at: historyItem.created_at,
                images: [],
                videos: []
            };
        }
        
        // 根据类型分类记录
        if (historyItem.type === 'image' && historyItem.image_base64) {
            console.log('处理图片记录:', historyItem.prompt.substring(0, 30) + '...');
            groupedHistory[groupKey].images.push({
                base64: historyItem.image_base64,
                url: historyItem.image_url || ''
            });
        } else if ((historyItem.type === 'video' || historyItem.type === 'image_to_video') && historyItem.video_url) {
            console.log('处理视频记录:', historyItem.type, historyItem.prompt.substring(0, 30) + '...', 'URL:', historyItem.video_url);
            groupedHistory[groupKey].videos.push({
                url: historyItem.video_url,
                size: historyItem.size,
                duration: historyItem.duration,
                sourceImage: historyItem.image_base64 || null, // 如果是image_to_video，包含源图片
                videoType: historyItem.type // 标记视频类型
            });
        } else {
            console.log('跳过记录 - 类型:', historyItem.type, '有image_base64:', !!historyItem.image_base64, '有video_url:', !!historyItem.video_url);
        }
    });
    
    console.log('分组后的历史记录:', groupedHistory);
    
    // 按时间排序并显示分组
    Object.values(groupedHistory)
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
        .forEach((groupedItem, index) => {
            // 创建历史记录组
            const historyGroup = document.createElement('div');
            historyGroup.className = 'image-group history-group';
            
            // 添加时间戳和提示词
            const historyHeader = document.createElement('div');
            historyHeader.className = 'history-header';
            
            const promptTitle = document.createElement('div');
            promptTitle.className = 'prompt-title';
            promptTitle.innerHTML = `
                <span>${groupedItem.prompt}</span>
                <small>${new Date(groupedItem.created_at).toLocaleString()}</small>
            `;
            
            historyHeader.appendChild(promptTitle);
            historyGroup.appendChild(historyHeader);
            
            // 创建内容容器
            const historyContentContainer = document.createElement('div');
            historyContentContainer.className = 'image-grid';
            
            console.log(`分组 ${index + 1} 包含 ${groupedItem.images.length} 张图片，${groupedItem.videos.length} 个视频`);
            
            // 处理图片
            groupedItem.images.forEach((image, imgIndex) => {
                const imageItem = document.createElement('div');
                imageItem.className = 'image-item';
                imageItem.innerHTML = `
                    <img src="${image.base64}" alt="Generated ${imgIndex + 1}" data-image-src="${image.base64}">
                    <div class="image-actions">
                        <button class="action-btn download-btn" data-download-src="${image.base64}" data-download-index="${imgIndex}">
                            <i class="fas fa-download"></i>
                        </button>
                        <button class="action-btn copy-btn" data-copy-src="${image.base64}">
                            <i class="fas fa-copy"></i>
                        </button>
                    </div>
                `;
                
                // 为图片添加双击事件监听器
                const img = imageItem.querySelector('img');
                img.addEventListener('dblclick', function() {
                    const imageSrc = this.getAttribute('data-image-src');
                    viewImageFullSize(imageSrc);
                });
                
                // 为下载按钮添加事件监听器
                const downloadBtn = imageItem.querySelector('.download-btn');
                downloadBtn.addEventListener('click', function() {
                    const imageSrc = this.getAttribute('data-download-src');
                    const imageIndex = parseInt(this.getAttribute('data-download-index'));
                    downloadImageData(imageSrc, imageIndex);
                });
                
                // 为复制按钮添加事件监听器
                const copyBtn = imageItem.querySelector('.copy-btn');
                copyBtn.addEventListener('click', function() {
                    const imageSrc = this.getAttribute('data-copy-src');
                    copyImageData(imageSrc);
                });
                
                historyContentContainer.appendChild(imageItem);
            });
            
            // 处理视频
            groupedItem.videos.forEach((video, videoIndex) => {
                const videoItem = document.createElement('div');
                videoItem.className = 'video-item';
                videoItem.innerHTML = `
                    <div class="video-container">
                        <video controls>
                            <source src="${video.url}" type="video/mp4">
                            您的浏览器不支持视频播放。
                        </video>
                        <div class="video-info">
                            <span class="video-resolution">${video.size || '未知分辨率'}</span>
                            <span class="video-duration">${video.duration || 5}s</span>
                        </div>
                    </div>
                    <div class="video-actions">
                        <button class="action-btn download-video-btn" data-video-url="${video.url}" data-video-index="${videoIndex}">
                            <i class="fas fa-download"></i>
                        </button>
                        <button class="action-btn fullscreen-btn" data-video-url="${video.url}">
                            <i class="fas fa-expand"></i>
                        </button>
                    </div>
                `;
                
                // 为下载按钮添加事件监听器
                const downloadBtn = videoItem.querySelector('.download-video-btn');
                downloadBtn.addEventListener('click', function() {
                    const videoUrl = this.getAttribute('data-video-url');
                    const videoIndex = parseInt(this.getAttribute('data-video-index'));
                    downloadVideoData(videoUrl, videoIndex);
                });
                
                // 为全屏按钮添加事件监听器
                const fullscreenBtn = videoItem.querySelector('.fullscreen-btn');
                fullscreenBtn.addEventListener('click', function() {
                    const videoUrl = this.getAttribute('data-video-url');
                    viewVideoFullSize(videoUrl);
                });
                
                historyContentContainer.appendChild(videoItem);
            });
            
            historyGroup.appendChild(historyContentContainer);
            currentImages.appendChild(historyGroup);
        });
}

// 更新会话列表UI
function updateConversationsList() {
    const conversationsList = document.getElementById('conversationsList');
    
    if (!conversationsList) {
        console.warn('Conversations list element not found');
        return;
    }
    
    if (conversations.length === 0) {
        // 显示占位符
        conversationsList.innerHTML = `
            <div class="conversation-placeholder">
                <i class="fas fa-comments"></i>
                <p>No conversations yet<br>Click "New Chat" to start</p>
            </div>
        `;
        return;
    }
    
    // 生成会话列表
    const conversationsHTML = conversations.map(conversation => {
        const isActive = conversation.id === currentConversationId;
        const timeFormatted = new Date(conversation.updated_at).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric'
        });
        
        return `
            <div class="conversation-item ${isActive ? 'active' : ''}" data-conversation-id="${conversation.id}">
                <div class="conversation-content">
                    <div class="conversation-title" data-conversation-id="${conversation.id}">${conversation.title}</div>
                    <div class="conversation-time">${timeFormatted}</div>
                </div>
                <div class="conversation-actions">
                    <button class="edit-conversation-btn" data-conversation-id="${conversation.id}" title="Edit name">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="delete-conversation-btn" data-conversation-id="${conversation.id}" title="Delete">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `;
    }).join('');
    
    conversationsList.innerHTML = conversationsHTML;
    
    // 为会话项添加点击事件
    const conversationItems = conversationsList.querySelectorAll('.conversation-item');
    conversationItems.forEach(item => {
        // 会话内容点击切换会话
        const conversationContent = item.querySelector('.conversation-content');
        conversationContent.addEventListener('click', function() {
            const conversationId = parseInt(item.getAttribute('data-conversation-id'));
            switchToConversation(conversationId);
        });
        
        // 编辑按钮事件
        const editBtn = item.querySelector('.edit-conversation-btn');
        editBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            const conversationId = parseInt(this.getAttribute('data-conversation-id'));
            startEditingConversationName(conversationId);
        });
        
        // 删除按钮事件
        const deleteBtn = item.querySelector('.delete-conversation-btn');
        deleteBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            const conversationId = parseInt(this.getAttribute('data-conversation-id'));
            deleteConversation(conversationId);
        });
    });
}

// 清空当前图片显示
function clearCurrentImages() {
    currentImages.innerHTML = '';
    currentImages.style.display = 'none';
    previewArea.style.display = 'flex';
    conversationHistory = [];
}

// 切换到指定会话
async function switchToConversation(conversationId) {
    if (conversationId === currentConversationId) {
        return; // 已经是当前会话
    }
    
    currentConversationId = conversationId;
    
    // 加载会话历史
    await loadConversationHistory(conversationId);
    
    // 更新UI状态
    updateConversationsList();
}

// 处理新建会话
async function handleNewConversation() {
    const conversationId = await createNewConversation();
    if (conversationId) {
        currentConversationId = conversationId;
        updateConversationsList();
    }
}

// 开始编辑会话名称
function startEditingConversationName(conversationId) {
    const titleElement = document.querySelector(`.conversation-title[data-conversation-id="${conversationId}"]`);
    if (!titleElement) return;
    
    const currentTitle = titleElement.textContent;
    
    // 创建输入框
    const input = document.createElement('input');
    input.type = 'text';
    input.value = currentTitle;
    input.className = 'conversation-title-input';
    input.maxLength = 50;
    
    // 替换标题元素
    titleElement.style.display = 'none';
    titleElement.parentNode.insertBefore(input, titleElement);
    
    // 聚焦并选中文本
    input.focus();
    input.select();
    
    let isEditing = true; // 添加编辑状态标志
    
    // 保存函数
    const saveEdit = async () => {
        if (!isEditing) return; // 防止重复调用
        isEditing = false;
        
        const newTitle = input.value.trim();
        if (newTitle && newTitle !== currentTitle) {
            try {
                const response = await fetch(`${API_BASE_URL}/conversations/${conversationId}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${AuthUtils.getToken()}`
                    },
                    body: JSON.stringify({ title: newTitle })
                });
                
                const data = await response.json();
                if (data.success) {
                    // 更新本地数据
                    const conversation = conversations.find(c => c.id === conversationId);
                    if (conversation) {
                        conversation.title = newTitle;
                    }
                    showToast('Conversation name updated successfully', 'success');
                } else {
                    showToast('Failed to update conversation name: ' + data.error, 'error');
                    // 如果失败，恢复原标题
                    titleElement.textContent = currentTitle;
                }
            } catch (error) {
                console.error('Error updating conversation:', error);
                showToast('Failed to update conversation name', 'error');
                // 如果失败，恢复原标题
                titleElement.textContent = currentTitle;
            }
        } else {
            // 恢复原标题
            titleElement.textContent = currentTitle;
        }
        
        // 清理输入框和事件监听器
        cleanupEdit();
    };
    
    // 取消编辑函数
    const cancelEdit = () => {
        if (!isEditing) return; // 防止重复调用
        isEditing = false;
        
        // 恢复原标题
        titleElement.textContent = currentTitle;
        
        // 清理输入框和事件监听器
        cleanupEdit();
    };
    
    // 清理函数
    const cleanupEdit = () => {
        if (input.parentNode) {
            input.remove();
        }
        titleElement.style.display = '';
        // 重新渲染会话列表
        updateConversationsList();
    };
    
    // 事件监听
    input.addEventListener('blur', saveEdit);
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            saveEdit();
        } else if (e.key === 'Escape') {
            e.preventDefault();
            cancelEdit();
        }
    });
}

// 删除会话
async function deleteConversation(conversationId) {
    if (!confirm('Are you sure you want to delete this conversation? This action cannot be undone.')) {
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE_URL}/conversations/${conversationId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${AuthUtils.getToken()}`
            }
        });
        
        const data = await response.json();
        if (data.success) {
            // 从本地数组中移除
            conversations = conversations.filter(c => c.id !== conversationId);
            
            // 如果删除的是当前会话，切换到其他会话或清空
            if (currentConversationId === conversationId) {
                if (conversations.length > 0) {
                    currentConversationId = conversations[0].id;
                    await loadConversationHistory(currentConversationId);
                } else {
                    currentConversationId = null;
                    clearCurrentImages();
                }
            }
            
            showToast('Conversation deleted successfully', 'success');
            updateConversationsList();
        } else {
            showToast('Failed to delete conversation: ' + data.error, 'error');
        }
    } catch (error) {
        console.error('Error deleting conversation:', error);
        showToast('Failed to delete conversation', 'error');
    }
}

// Expandable Dialog Functionality
function initExpandableDialog() {
    const promptContainer = document.querySelector('.prompt-container');
    const promptInput = document.getElementById('prompt-input');
    const inlineControls = document.getElementById('inlineGenerationControls');
    
    if (!promptContainer || !promptInput) return;

    // 初始保持收缩
    promptContainer.classList.remove('expanded');
    
    // Track if user is actively using the input
    let isInputActive = false;
    let expandTimer = null;
    
    // Focus event - expand the dialog
    promptInput.addEventListener('focus', () => {
        isInputActive = true;
        clearTimeout(expandTimer);
        promptContainer.classList.add('expanded');
    });
    
    // Input event - keep expanded while typing
    promptInput.addEventListener('input', () => {
        isInputActive = true;
        clearTimeout(expandTimer);
        promptContainer.classList.add('expanded');
    });
    
    // Blur event - start collapse timer
    promptInput.addEventListener('blur', () => {
        isInputActive = false;
        
        // Delay collapse to allow clicking on controls
        expandTimer = setTimeout(() => {
            if (!isInputActive && !promptContainer.matches(':hover')) {
                promptContainer.classList.remove('expanded');
            }
        }, 200);
    });
    
    // Mouse enter - cancel collapse if hovering
    promptContainer.addEventListener('mouseenter', () => {
        clearTimeout(expandTimer);
    });
    
    // Mouse leave - collapse if input not active
    promptContainer.addEventListener('mouseleave', () => {
        if (!isInputActive && !promptInput.matches(':focus')) {
            expandTimer = setTimeout(() => {
                promptContainer.classList.remove('expanded');
            }, 200);
        }
    });
    
    // Click outside - collapse immediately
    document.addEventListener('click', (event) => {
        if (!promptContainer.contains(event.target) && !isInputActive) {
            clearTimeout(expandTimer);
            promptContainer.classList.remove('expanded');
        }
    });
    
    // Prevent collapse when clicking on controls
    const expandableControls = document.querySelector('.expandable-controls');
    if (expandableControls) {
        expandableControls.addEventListener('mousedown', (event) => {
            // Prevent blur event from triggering when clicking controls
            event.preventDefault();
        });
        
        expandableControls.addEventListener('click', () => {
            // Keep focus on input when clicking controls
            promptInput.focus();
        });
    }
}

// Initialize compact controls functionality
function initCompactControls() {
    // 紧凑控件点击时展开对话框并聚焦输入框
    if (contentTypeSelectorCompact) {
        contentTypeSelectorCompact.addEventListener('click', () => {
            const promptContainer = document.querySelector('.prompt-container');
            const promptInput = document.getElementById('prompt-input');
            promptContainer.classList.add('expanded');
            promptInput.focus();
        });
    }
    
    if (aspectRatioSelectorCompact) {
        aspectRatioSelectorCompact.addEventListener('click', () => {
            const promptContainer = document.querySelector('.prompt-container');
            const promptInput = document.getElementById('prompt-input');
            promptContainer.classList.add('expanded');
            promptInput.focus();
        });
    }
    
    if (imageCountSelectorCompact) {
        imageCountSelectorCompact.addEventListener('click', () => {
            const promptContainer = document.querySelector('.prompt-container');
            const promptInput = document.getElementById('prompt-input');
            promptContainer.classList.add('expanded');
            promptInput.focus();
        });
    }
} 

// 创建图片生成占位符
function createContentPlaceholder(prompt, contentType = 'image') {
    // 创建新的内容组
    const contentGroup = document.createElement('div');
    contentGroup.className = contentType === 'image' ? 'image-group' : 'video-group';
    
    // 添加提示词标题和删除按钮
    const promptTitle = document.createElement('div');
    promptTitle.className = 'prompt-title';
    
    const promptText = document.createElement('span');
    promptText.textContent = prompt;
    
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'delete-group-btn';
    deleteBtn.innerHTML = '<i class="fas fa-trash"></i> Delete';
    
    promptTitle.appendChild(promptText);
    promptTitle.appendChild(deleteBtn);
    contentGroup.appendChild(promptTitle);
    
    // 为删除按钮添加事件监听器
    deleteBtn.addEventListener('click', function() {
        const contentTypeName = contentType === 'image' ? 'image' : 'video';
        if (confirm(`Are you sure you want to delete this ${contentTypeName} group?`)) {
            contentGroup.remove();
            // 如果没有更多内容组，显示占位符
            if (currentImages.children.length === 0) {
                currentImages.style.display = 'none';
                previewArea.style.display = 'flex';
            }
        }
    });
    
    // 创建内容占位符
    const placeholder = document.createElement('div');
    placeholder.className = contentType === 'image' ? 'image-placeholder generating' : 'video-placeholder generating';
    
    const placeholderContent = document.createElement('div');
    placeholderContent.className = 'placeholder-content generating';
    
    const spinner = document.createElement('div');
    spinner.className = 'placeholder-spinner';
    
    const text = document.createElement('div');
    text.className = 'placeholder-text';
    text.textContent = contentType === 'image' ? 'Generating images...' : 'Generating video...';
    
    const percentage = document.createElement('div');
    percentage.className = 'placeholder-percentage';
    
    if (contentType === 'video') {
        // 视频生成显示提示文本而不是百分比
        percentage.textContent = 'Video generation takes longer, please wait patiently for 2-3 minutes';
        percentage.className = 'placeholder-message'; // 使用不同的类名以便样式区分
    } else {
        // 图片生成显示百分比
        percentage.textContent = '0%';
    }
    
    placeholderContent.appendChild(spinner);
    placeholderContent.appendChild(text);
    placeholderContent.appendChild(percentage);
    placeholder.appendChild(placeholderContent);
    
    contentGroup.appendChild(placeholder);
    
    // 添加到容器顶部
    currentImages.insertBefore(contentGroup, currentImages.firstChild);
    
    // 滚动到新创建的占位符
    setTimeout(() => {
        contentGroup.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
    
    return contentGroup;
}

// 填充生成的图片到占位符位置
function fillGeneratedImages(imageGroup, images) {
    console.log('=== fillGeneratedImages 调用 ===');
    console.log('传入的图片数组:', images);
    console.log('图片数量:', images.length);
    
    // 移除占位符
    const placeholder = imageGroup.querySelector('.image-placeholder');
    if (placeholder) {
        placeholder.remove();
    }
    
    // 创建图片网格容器
    const imageGrid = document.createElement('div');
    imageGrid.className = 'image-grid';
    
    console.log('=== 生成图片HTML ===');
    console.log('开始遍历图片数组，长度:', images.length);
    
    imageGrid.innerHTML = images.map((img, index) => {
        console.log(`处理图片 ${index + 1}:`, {
            index: index,
            url: img.url,
            base64_exists: !!img.base64,
            base64_length: img.base64 ? img.base64.length : 0
        });
        
        return `
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
    `;
    }).join('');
    
    console.log('生成的HTML长度:', imageGrid.innerHTML.length);
    console.log('图片网格子元素数量:', imageGrid.children.length);
    
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
    
    // 如果有当前会话，重新加载会话历史以包含新生成的图片
    if (currentConversationId) {
        setTimeout(async () => {
            await loadConversationHistory(currentConversationId);
        }, 500); // 延迟加载以确保后端已保存
    }
}

// Fill generated videos to placeholder
function fillGeneratedVideos(videoGroup, videos) {
    console.log('=== fillGeneratedVideos 调用 ===');
    console.log('传入的视频数组:', videos);
    console.log('视频数量:', videos.length);
    
    // 移除占位符
    const placeholder = videoGroup.querySelector('.video-placeholder, .image-placeholder');
    if (placeholder) {
        placeholder.remove();
    }
    
    // 创建视频网格容器
    const videoGrid = document.createElement('div');
    videoGrid.className = 'video-grid';
    
    console.log('=== 生成视频HTML ===');
    console.log('开始遍历视频数组，长度:', videos.length);
    
    videoGrid.innerHTML = videos.map((video, index) => {
        console.log(`处理视频 ${index + 1}:`, {
            index: index,
            url: video.url,
            task_id: video.task_id
        });
        
        return `
        <div class="video-item" data-video-index="${index}">
            <video controls preload="metadata" data-video-src="${video.url}">
                <source src="${video.url}" type="video/mp4">
                Your browser does not support the video tag.
            </video>
            <div class="video-actions">
                <button class="action-btn download-btn" data-download-src="${video.url}" data-download-index="${index}">
                    <i class="fas fa-download"></i>
                </button>
                <button class="action-btn copy-btn" data-copy-src="${video.url}">
                    <i class="fas fa-copy"></i>
                </button>
            </div>
        </div>
    `;
    }).join('');
    
    console.log('生成的HTML长度:', videoGrid.innerHTML.length);
    console.log('视频网格子元素数量:', videoGrid.children.length);
    
    videoGroup.appendChild(videoGrid);
    
    // 为视频添加双击事件监听器（全屏播放）
    const videoItems = videoGrid.querySelectorAll('.video-item video');
    videoItems.forEach(video => {
        video.addEventListener('dblclick', function() {
            if (this.requestFullscreen) {
                this.requestFullscreen();
            } else if (this.webkitRequestFullscreen) {
                this.webkitRequestFullscreen();
            } else if (this.mozRequestFullScreen) {
                this.mozRequestFullScreen();
            }
        });
    });
    
    // 为下载按钮添加事件监听器
    const downloadBtns = videoGrid.querySelectorAll('.download-btn');
    downloadBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            const videoSrc = this.getAttribute('data-download-src');
            const videoIndex = parseInt(this.getAttribute('data-download-index'));
            downloadVideoData(videoSrc, videoIndex);
        });
    });
    
    // 为复制按钮添加事件监听器
    const copyBtns = videoGrid.querySelectorAll('.copy-btn');
    copyBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            const videoSrc = this.getAttribute('data-copy-src');
            copyVideoData(videoSrc);
        });
    });
    
    // 如果有当前会话，重新加载会话历史以包含新生成的视频
    if (currentConversationId) {
        setTimeout(async () => {
            await loadConversationHistory(currentConversationId);
        }, 500); // 延迟加载以确保后端已保存
    }
}

// Download video data
function downloadVideoData(videoUrl, index = 0) {
    try {
        const link = document.createElement('a');
        link.href = videoUrl;
        link.download = `generated_video_${index + 1}.mp4`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        showToast('Video download started!', 'success');
    } catch (error) {
        console.error('视频下载失败:', error);
        showToast('Failed to download video', 'error');
    }
}

// Copy video URL to clipboard
function copyVideoData(videoUrl) {
    try {
        navigator.clipboard.writeText(videoUrl).then(() => {
            showToast('Video URL copied to clipboard!', 'success');
        }).catch(() => {
            // Fallback for older browsers
            const textArea = document.createElement('textarea');
            textArea.value = videoUrl;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            showToast('Video URL copied to clipboard!', 'success');
        });
    } catch (error) {
        console.error('复制视频URL失败:', error);
        showToast('Failed to copy video URL', 'error');
    }
}