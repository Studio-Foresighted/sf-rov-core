import * as THREE from '../lib/three.module.js';

export class FloatingTextManager {
    constructor() {
        this.container = document.createElement('div');
        this.container.id = 'floating-text-layer';
        this.container.style.position = 'absolute';
        this.container.style.top = '0';
        this.container.style.left = '0';
        this.container.style.width = '100%';
        this.container.style.height = '100%';
        this.container.style.pointerEvents = 'none';
        this.container.style.overflow = 'hidden';
        this.container.style.zIndex = '50'; // Below main UI but above canvas
        document.body.appendChild(this.container);
        this.texts = [];
    }

    spawn(text, position, color = '#ffd700') {
        const el = document.createElement('div');
        el.textContent = text;
        el.style.position = 'absolute';
        el.style.color = color;
        el.style.fontFamily = "'VT323', monospace";
        el.style.fontSize = '2.5rem';
        el.style.textShadow = '2px 2px 0 #000';
        el.style.fontWeight = 'bold';
        el.style.userSelect = 'none';
        el.style.transform = 'translate(-50%, -50%)';
        el.style.opacity = '1';
        el.style.transition = 'opacity 0.2s';
        
        this.container.appendChild(el);
        
        this.texts.push({
            element: el,
            position: position.clone(), // 3D world position
            life: 0,
            offsetY: 0
        });
    }

    update(dt, camera) {
        for (let i = this.texts.length - 1; i >= 0; i--) {
            const item = this.texts[i];
            item.life += dt;
            
            // Animation: Float up slowly
            item.offsetY += dt * 1.5; 
            
            // Project to screen
            const screenPos = item.position.clone();
            screenPos.y += 2.0 + item.offsetY; // Start above head + float
            screenPos.project(camera);
            
            // Convert to CSS coordinates
            const x = (screenPos.x * 0.5 + 0.5) * window.innerWidth;
            const y = (-(screenPos.y * 0.5) + 0.5) * window.innerHeight;
            
            item.element.style.left = `${x}px`;
            item.element.style.top = `${y}px`;

            // Visibility logic
            // Hold for 0.5s, then disappear (fade out quickly)
            if (item.life > 0.5) {
                item.element.style.opacity = '0';
            }
            
            // Remove after fade
            if (item.life > 0.7) {
                item.element.remove();
                this.texts.splice(i, 1);
            }
        }
    }
}
