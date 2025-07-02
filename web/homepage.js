// Homepage JavaScript functionality
document.addEventListener('DOMContentLoaded', function() {
    // Initialize homepage features
    initHomepage();
});

function initHomepage() {
    // Initialize smooth scrolling
    initSmoothScroll();
    
    // Initialize navigation interactions
    initNavigation();
    
    // Initialize carousel
    initCarousel();
    
    // Initialize gallery interactions
    initGallery();
    
    // Initialize scroll effects
    initScrollEffects();
    
    // Initialize animations
    initAnimations();
}

// Smooth scroll functionality
function initSmoothScroll() {
    const galleryLinks = document.querySelectorAll('a[href="#gallery"]');
    
    galleryLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            
            const targetId = this.getAttribute('href').substring(1);
            const targetElement = document.getElementById(targetId);
            
            if (targetElement) {
                const headerOffset = 80; // Navigation bar height
                const elementPosition = targetElement.getBoundingClientRect().top;
                const offsetPosition = elementPosition + window.pageYOffset - headerOffset;
                
                window.scrollTo({
                    top: offsetPosition,
                    behavior: 'smooth'
                });
            }
        });
    });
}

// Navigation interactions
function initNavigation() {
    const navbar = document.querySelector('.navbar');
    
    // Navigation bar style changes on scroll
    window.addEventListener('scroll', function() {
        if (window.scrollY > 50) {
            navbar.classList.add('scrolled');
        } else {
            navbar.classList.remove('scrolled');
        }
    });
    
    // Navigation link click effects
    const navLinks = document.querySelectorAll('.nav-link');
    navLinks.forEach(link => {
        link.addEventListener('click', function() {
            // Add click animation effect
            this.style.transform = 'scale(0.95)';
            setTimeout(() => {
                this.style.transform = '';
            }, 150);
        });
    });
}

// Carousel functionality
function initCarousel() {
    const slides = document.querySelectorAll('.carousel-slide');
    const indicators = document.querySelectorAll('.indicator');
    const prevBtn = document.querySelector('.carousel-prev');
    const nextBtn = document.querySelector('.carousel-next');
    let currentSlide = 0;
    let autoPlayInterval;
    
    if (!slides.length) return;
    
    // Function to show specific slide
    function showSlide(index) {
        // Remove active class from all slides and indicators
        slides.forEach(slide => slide.classList.remove('active', 'prev'));
        indicators.forEach(indicator => indicator.classList.remove('active'));
        
        // Add active class to current slide and indicator
        slides[index].classList.add('active');
        indicators[index].classList.add('active');
        
        currentSlide = index;
    }
    
    // Function to go to next slide
    function nextSlide() {
        const nextIndex = (currentSlide + 1) % slides.length;
        showSlide(nextIndex);
    }
    
    // Function to go to previous slide
    function prevSlide() {
        const prevIndex = (currentSlide - 1 + slides.length) % slides.length;
        showSlide(prevIndex);
    }
    
    // Auto-play functionality
    function startAutoPlay() {
        autoPlayInterval = setInterval(nextSlide, 4000); // Change slide every 4 seconds
    }
    
    function stopAutoPlay() {
        clearInterval(autoPlayInterval);
    }
    
    // Event listeners for navigation buttons
    if (nextBtn) {
        nextBtn.addEventListener('click', () => {
            nextSlide();
            stopAutoPlay();
            startAutoPlay(); // Restart auto-play
        });
    }
    
    if (prevBtn) {
        prevBtn.addEventListener('click', () => {
            prevSlide();
            stopAutoPlay();
            startAutoPlay(); // Restart auto-play
        });
    }
    
    // Event listeners for indicators
    indicators.forEach((indicator, index) => {
        indicator.addEventListener('click', () => {
            showSlide(index);
            stopAutoPlay();
            startAutoPlay(); // Restart auto-play
        });
    });
    
    // Pause auto-play on hover
    const carousel = document.querySelector('.carousel-container');
    if (carousel) {
        carousel.addEventListener('mouseenter', stopAutoPlay);
        carousel.addEventListener('mouseleave', startAutoPlay);
    }
    
    // Touch/swipe support for mobile
    let startX = 0;
    let startY = 0;
    let endX = 0;
    let endY = 0;
    
    if (carousel) {
        carousel.addEventListener('touchstart', (e) => {
            startX = e.touches[0].clientX;
            startY = e.touches[0].clientY;
        });
        
        carousel.addEventListener('touchend', (e) => {
            endX = e.changedTouches[0].clientX;
            endY = e.changedTouches[0].clientY;
            
            const diffX = startX - endX;
            const diffY = startY - endY;
            
            // Check if horizontal swipe is more significant than vertical
            if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > 50) {
                if (diffX > 0) {
                    // Swiped left - next slide
                    nextSlide();
                } else {
                    // Swiped right - previous slide
                    prevSlide();
                }
                stopAutoPlay();
                startAutoPlay();
            }
        });
    }
    
    // Keyboard navigation
    document.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowLeft') {
            prevSlide();
            stopAutoPlay();
            startAutoPlay();
        } else if (e.key === 'ArrowRight') {
            nextSlide();
            stopAutoPlay();
            startAutoPlay();
        }
    });
    
    // Initialize carousel
    showSlide(0);
    startAutoPlay();
    
    console.log('Carousel initialized with', slides.length, 'slides');
}

// Gallery interaction functionality
function initGallery() {
    const galleryItems = document.querySelectorAll('.gallery-item');
    
    galleryItems.forEach(item => {
        // 移除点击放大功能，避免与生成器页面冲突
        // 只保留悬停效果
        
        // Add hover effects
        item.addEventListener('mouseenter', function() {
            this.style.transform = 'translateY(-8px) scale(1.02)';
        });
        
        item.addEventListener('mouseleave', function() {
            this.style.transform = '';
        });
    });
}

// Image modal functionality
function openImageModal(imageSrc, title, description) {
    // Create modal
    const modal = document.createElement('div');
    modal.className = 'image-modal';
    modal.innerHTML = `
        <div class="modal-overlay">
            <div class="modal-content">
                <button class="modal-close">&times;</button>
                <img src="${imageSrc}" alt="${title}" class="modal-image">
                <div class="modal-info">
                    <h3>${title}</h3>
                    <p>${description}</p>
                </div>
            </div>
        </div>
    `;
    
    // Add modal styles
    const modalStyles = `
        .image-modal {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            z-index: 10000;
            display: flex;
            align-items: center;
            justify-content: center;
            animation: fadeIn 0.3s ease;
        }
        
        .modal-overlay {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.9);
            backdrop-filter: blur(10px);
        }
        
        .modal-content {
            position: relative;
            max-width: 90%;
            max-height: 90%;
            background: white;
            border-radius: 20px;
            overflow: hidden;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
            animation: slideIn 0.3s ease;
        }
        
        .modal-close {
            position: absolute;
            top: 15px;
            right: 15px;
            width: 40px;
            height: 40px;
            border: none;
            background: rgba(0, 0, 0, 0.7);
            color: white;
            border-radius: 50%;
            font-size: 20px;
            cursor: pointer;
            z-index: 10001;
            transition: all 0.3s ease;
        }
        
        .modal-close:hover {
            background: rgba(0, 0, 0, 0.9);
            transform: scale(1.1);
        }
        
        .modal-image {
            width: 100%;
            max-height: 70vh;
            object-fit: contain;
            display: block;
        }
        
        .modal-info {
            padding: 20px;
            text-align: center;
        }
        
        .modal-info h3 {
            font-size: 20px;
            font-weight: 600;
            color: #374151;
            margin-bottom: 8px;
        }
        
        .modal-info p {
            color: #6b7280;
            line-height: 1.6;
        }
        
        @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
        }
        
        @keyframes slideIn {
            from { transform: scale(0.8) translateY(20px); opacity: 0; }
            to { transform: scale(1) translateY(0); opacity: 1; }
        }
    `;
    
    // Add styles to page
    if (!document.querySelector('#modal-styles')) {
        const styleSheet = document.createElement('style');
        styleSheet.id = 'modal-styles';
        styleSheet.textContent = modalStyles;
        document.head.appendChild(styleSheet);
    }
    
    // Add modal to page
    document.body.appendChild(modal);
    document.body.style.overflow = 'hidden';
    
    // Close modal functionality
    const closeModal = () => {
        modal.style.animation = 'fadeOut 0.3s ease';
        setTimeout(() => {
            document.body.removeChild(modal);
            document.body.style.overflow = '';
        }, 300);
    };
    
    // Click close button
    modal.querySelector('.modal-close').addEventListener('click', closeModal);
    
    // Click background to close
    modal.querySelector('.modal-overlay').addEventListener('click', function(e) {
        if (e.target === this) {
            closeModal();
        }
    });
    
    // ESC key to close
    const handleKeyDown = (e) => {
        if (e.key === 'Escape') {
            closeModal();
            document.removeEventListener('keydown', handleKeyDown);
        }
    };
    document.addEventListener('keydown', handleKeyDown);
}

// Login button functionality


// Toast notification functionality
function showToast(message, type = 'info') {
    // Create toast element
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    // Set message content
    const icon = getToastIcon(type);
    toast.innerHTML = `
        <div class="toast-content">
            <i class="${icon}"></i>
            <span>${message}</span>
        </div>
    `;
    
    // Add toast styles
    const toastStyles = `
        .toast {
            position: fixed;
            top: 100px;
            right: 20px;
            background: white;
            border-radius: 12px;
            padding: 16px 20px;
            box-shadow: 0 8px 30px rgba(0, 0, 0, 0.2);
            z-index: 10000;
            animation: slideInRight 0.3s ease;
            border-left: 4px solid;
            max-width: 400px;
        }
        
        .toast-info { border-left-color: #3b82f6; }
        .toast-success { border-left-color: #10b981; }
        .toast-warning { border-left-color: #0ea5e9; }
        .toast-error { border-left-color: #ef4444; }
        
        .toast-content {
            display: flex;
            align-items: center;
            gap: 12px;
        }
        
        .toast-content i {
            font-size: 18px;
        }
        
        .toast-info i { color: #3b82f6; }
        .toast-success i { color: #10b981; }
        .toast-warning i { color: #0ea5e9; }
        .toast-error i { color: #ef4444; }
        
        .toast-content span {
            color: #374151;
            font-weight: 500;
        }
        
        @keyframes slideInRight {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }
        
        @keyframes slideOutRight {
            from { transform: translateX(0); opacity: 1; }
            to { transform: translateX(100%); opacity: 0; }
        }
    `;
    
    // Add styles to page
    if (!document.querySelector('#toast-styles')) {
        const styleSheet = document.createElement('style');
        styleSheet.id = 'toast-styles';
        styleSheet.textContent = toastStyles;
        document.head.appendChild(styleSheet);
    }
    
    // Add toast to page
    document.body.appendChild(toast);
    
    // Auto remove toast
    setTimeout(() => {
        toast.style.animation = 'slideOutRight 0.3s ease';
        setTimeout(() => {
            if (document.body.contains(toast)) {
                document.body.removeChild(toast);
            }
        }, 300);
    }, 4000);
}

function getToastIcon(type) {
    const icons = {
        info: 'fas fa-info-circle',
        success: 'fas fa-check-circle',
        warning: 'fas fa-exclamation-triangle',
        error: 'fas fa-times-circle'
    };
    return icons[type] || icons.info;
}

// Scroll effects
function initScrollEffects() {
    // Navigation bar scroll effects
    const navbar = document.querySelector('.navbar');
    
    window.addEventListener('scroll', function() {
        const scrolled = window.scrollY > 50;
        
        if (scrolled) {
            navbar.style.background = 'rgba(255, 255, 255, 0.98)';
            navbar.style.boxShadow = '0 4px 30px rgba(0, 0, 0, 0.15)';
        } else {
            navbar.style.background = 'rgba(255, 255, 255, 0.95)';
            navbar.style.boxShadow = '0 4px 20px rgba(0, 0, 0, 0.1)';
        }
    });
    
    // Element enter view animation
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };
    
    const observer = new IntersectionObserver(function(entries) {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('animate-in');
            }
        });
    }, observerOptions);
    
    // Observe elements that need animation
    const animateElements = document.querySelectorAll('.feature-card, .gallery-item, .section-header, .showcase-item, .metric-item');
    animateElements.forEach(el => {
        observer.observe(el);
    });
}

// Initialize animations
function initAnimations() {
    // Add CSS animation classes
    const animationStyles = `
        .animate-in {
            animation: fadeInUp 0.6s ease forwards;
        }
        
        @keyframes fadeInUp {
            from {
                opacity: 0;
                transform: translateY(30px);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }
        
        .feature-card,
        .gallery-item,
        .section-header,
        .showcase-item,
        .metric-item {
            opacity: 0;
            transform: translateY(30px);
            transition: all 0.6s ease;
        }
        
        .feature-card.animate-in,
        .gallery-item.animate-in,
        .section-header.animate-in,
        .showcase-item.animate-in,
        .metric-item.animate-in {
            opacity: 1;
            transform: translateY(0);
        }
    `;
    
    // Add animation styles
    if (!document.querySelector('#animation-styles')) {
        const styleSheet = document.createElement('style');
        styleSheet.id = 'animation-styles';
        styleSheet.textContent = animationStyles;
        document.head.appendChild(styleSheet);
    }
}

// Handle page load completion
window.addEventListener('load', function() {
    // Hide loading state (if any)
    document.body.classList.add('loaded');
    
    // Add page load animations
    const heroContent = document.querySelector('.hero-content');
    const heroVisual = document.querySelector('.hero-visual');
    
    if (heroContent) {
        heroContent.style.animation = 'fadeInUp 0.8s ease forwards';
    }
    
    if (heroVisual) {
        heroVisual.style.animation = 'fadeInUp 0.8s ease 0.2s forwards';
        heroVisual.style.opacity = '0';
        setTimeout(() => {
            heroVisual.style.opacity = '1';
        }, 200);
    }
});

// Error handling
window.addEventListener('error', function(e) {
    console.error('Page error:', e.error);
});

// Ensure compatibility
if (!window.IntersectionObserver) {
    // Provide fallback for browsers that don't support IntersectionObserver
    const animateElements = document.querySelectorAll('.feature-card, .gallery-item, .section-header, .showcase-item, .metric-item');
    animateElements.forEach(el => {
        el.classList.add('animate-in');
    });
} 