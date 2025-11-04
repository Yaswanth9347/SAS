// Mobile Navbar Debug Script
// Add this to any page to debug hamburger menu issues

(function() {
    console.log('🔍 Mobile Navbar Debug Script Loaded');
    
    // Wait for DOM and navbar to be ready
    setTimeout(() => {
        const hamburger = document.querySelector('.hamburger');
        const navMenu = document.getElementById('navMenu');
        const navContainer = document.querySelector('.nav-container');
        
        console.group('📱 Navbar Elements Check');
        console.log('Hamburger exists:', !!hamburger);
        console.log('Nav Menu exists:', !!navMenu);
        console.log('Nav Container exists:', !!navContainer);
        console.groupEnd();
        
        if (hamburger) {
            console.group('🍔 Hamburger Details');
            console.log('Display:', window.getComputedStyle(hamburger).display);
            console.log('Position:', window.getComputedStyle(hamburger).position);
            console.log('Z-Index:', window.getComputedStyle(hamburger).zIndex);
            console.log('Pointer Events:', window.getComputedStyle(hamburger).pointerEvents);
            console.log('Visibility:', window.getComputedStyle(hamburger).visibility);
            console.log('Opacity:', window.getComputedStyle(hamburger).opacity);
            
            const rect = hamburger.getBoundingClientRect();
            console.log('Position on screen:', {
                top: rect.top,
                right: rect.right,
                bottom: rect.bottom,
                left: rect.left,
                width: rect.width,
                height: rect.height
            });
            console.log('Is visible in viewport:', rect.width > 0 && rect.height > 0);
            console.groupEnd();
            
            // Test if hamburger responds to clicks
            console.log('🧪 Testing hamburger click handler...');
            let clickCount = 0;
            
            hamburger.addEventListener('click', function testClick(e) {
                clickCount++;
                console.log(`✅ Hamburger click detected! (Count: ${clickCount})`);
                console.log('Event details:', {
                    type: e.type,
                    target: e.target.tagName,
                    clientX: e.clientX,
                    clientY: e.clientY
                });
            });
            
            hamburger.addEventListener('touchstart', function testTouch(e) {
                console.log('👆 Hamburger touch detected!');
                console.log('Touch details:', {
                    type: e.type,
                    touches: e.touches.length
                });
            });
            
            // Visual indicator
            hamburger.style.boxShadow = '0 0 0 3px rgba(255, 0, 0, 0.5)';
            setTimeout(() => {
                hamburger.style.boxShadow = '';
            }, 3000);
            
            console.log('✨ Added red outline to hamburger for 3 seconds');
            
        } else {
            console.error('❌ Hamburger element not found!');
        }
        
        if (navMenu) {
            console.group('📋 Nav Menu Details');
            console.log('Classes:', navMenu.className);
            console.log('Position:', window.getComputedStyle(navMenu).position);
            console.log('Right:', window.getComputedStyle(navMenu).right);
            console.log('Pointer Events:', window.getComputedStyle(navMenu).pointerEvents);
            console.groupEnd();
        }
        
        // Viewport info
        console.group('📐 Viewport Info');
        console.log('Window width:', window.innerWidth);
        console.log('Window height:', window.innerHeight);
        console.log('Screen width:', window.screen.width);
        console.log('Device pixel ratio:', window.devicePixelRatio);
        console.log('Touch device:', 'ontouchstart' in window);
        console.groupEnd();
        
        // Check for overlapping elements
        if (hamburger) {
            const hamburgerRect = hamburger.getBoundingClientRect();
            const centerX = hamburgerRect.left + hamburgerRect.width / 2;
            const centerY = hamburgerRect.top + hamburgerRect.height / 2;
            const elementAtPoint = document.elementFromPoint(centerX, centerY);
            
            console.group('🎯 Element at Hamburger Position');
            console.log('Element:', elementAtPoint);
            console.log('Is hamburger or child:', hamburger.contains(elementAtPoint));
            
            if (!hamburger.contains(elementAtPoint)) {
                console.warn('⚠️ Another element is blocking the hamburger!');
                console.log('Blocking element:', elementAtPoint);
                console.log('Z-index of blocker:', window.getComputedStyle(elementAtPoint).zIndex);
            }
            console.groupEnd();
        }
        
        console.log('');
        console.log('💡 To manually test: Type this in console:');
        console.log('   document.querySelector(".hamburger").click()');
        
    }, 1000);
    
})();
