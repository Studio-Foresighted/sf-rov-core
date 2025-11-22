import * as THREE from '../lib/three.module.js';

export class HealthBar {
    constructor(scene, parentMesh, maxHealth, yOffset = 1.5, maxMana = 0, camera = null) {
        this.scene = scene;
        this.parentMesh = parentMesh;
        this.maxHealth = maxHealth;
        this.currentHealth = maxHealth;
        this.maxMana = maxMana;
        this.currentMana = maxMana;
        this.yOffset = yOffset;
        this.camera = camera;

        this.barGroup = new THREE.Group();
        
        // Background (Black) - Taller if mana exists
        const height = maxMana > 0 ? 0.25 : 0.15;
        const bgGeo = new THREE.PlaneGeometry(1, height);
        const bgMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
        this.bgMesh = new THREE.Mesh(bgGeo, bgMat);
        this.barGroup.add(this.bgMesh);

        // Health Bar (Green)
        const hpHeight = 0.15;
        const fgGeo = new THREE.PlaneGeometry(1, hpHeight);
        const fgMat = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
        this.fgMesh = new THREE.Mesh(fgGeo, fgMat);
        this.fgMesh.position.z = 0.01;
        // If mana exists, shift health bar up slightly
        if (maxMana > 0) {
            this.fgMesh.position.y = 0.05;
        }
        this.barGroup.add(this.fgMesh);

        // Mana Bar (Blue)
        if (maxMana > 0) {
            const manaHeight = 0.08;
            const manaGeo = new THREE.PlaneGeometry(1, manaHeight);
            const manaMat = new THREE.MeshBasicMaterial({ color: 0x0088ff });
            this.manaMesh = new THREE.Mesh(manaGeo, manaMat);
            this.manaMesh.position.z = 0.01;
            this.manaMesh.position.y = -0.07; // Below health
            this.barGroup.add(this.manaMesh);
        }

        this.scene.add(this.barGroup);
    }

    update(health, mana = 0) {
        this.currentHealth = Math.max(0, health);
        const ratio = this.currentHealth / this.maxHealth;
        
        // Scale the green bar
        this.fgMesh.scale.x = ratio;
        this.fgMesh.position.x = -0.5 * (1 - ratio);

        // Color change based on health
        if (ratio < 0.3) {
            this.fgMesh.material.color.setHex(0xff0000);
        } else {
            this.fgMesh.material.color.setHex(0x00ff00);
        }

        // Update Mana
        if (this.manaMesh && this.maxMana > 0) {
            this.currentMana = Math.max(0, mana);
            const manaRatio = this.currentMana / this.maxMana;
            this.manaMesh.scale.x = manaRatio;
            this.manaMesh.position.x = -0.5 * (1 - manaRatio);
        }

        // Follow parent
        if (this.parentMesh) {
            this.barGroup.position.copy(this.parentMesh.position);
            this.barGroup.position.y += this.yOffset;
        }

        // Billboard (Face Camera)
        if (this.camera) {
            this.barGroup.lookAt(this.camera.position);
        }
    }
    
    lookAt(target) {
        this.barGroup.lookAt(target);
    }

    destroy() {
        this.scene.remove(this.barGroup);
    }
}