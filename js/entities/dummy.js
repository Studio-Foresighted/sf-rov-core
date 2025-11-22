import * as THREE from '../lib/three.module.js';
import { HealthBar } from '../ui/healthBar.js';

export class Dummy {
    constructor(scene, position, game) {
        this.scene = scene;
        this.position = position;
        this.game = game;
        this.maxHealth = 1000;
        this.health = 1000;
        this.mesh = null;
        this.healthBar = null;
        this.isDead = false;
        
        this.init();
    }

    init() {
        const geometry = new THREE.CylinderGeometry(0.5, 0.5, 2, 16);
        const material = new THREE.MeshLambertMaterial({ color: 0xaaaaaa }); // Grey
        this.mesh = new THREE.Mesh(geometry, material);
        
        this.mesh.position.copy(this.position);
        this.mesh.position.y = 1;
        this.mesh.castShadow = true;
        this.mesh.receiveShadow = true;

        // Tag
        this.mesh.userData = { type: 'dummy', entity: this };

        this.scene.add(this.mesh);

        // Health Bar
        this.healthBar = new HealthBar(this.scene, this.mesh, this.maxHealth, 2.0);
    }

    takeDamage(amount, isCrit = false, attacker = null) {
        this.health -= amount;
        if (this.healthBar) this.healthBar.update(this.health);
        
        // Floating Text: ONLY if attacker is Player
        const isAttackerPlayer = attacker && attacker.mesh && attacker.mesh.userData.type === 'hero';

        if (this.game && this.game.floatingText && isAttackerPlayer) {
            const color = isCrit ? '#ff4500' : '#ff5555';
            this.game.floatingText.spawn(Math.round(amount), this.mesh.position, color);
        }
        
        console.log(`Dummy took ${amount} damage! HP: ${this.health}`);
        // Wiggle effect
        this.mesh.rotation.z = 0.2;
        setTimeout(() => { this.mesh.rotation.z = -0.2; }, 50);
        setTimeout(() => { this.mesh.rotation.z = 0; }, 100);
        
        // Flash red
        this.mesh.material.color.setHex(0xff0000);
        setTimeout(() => { this.mesh.material.color.setHex(0xaaaaaa); }, 100);

        if (this.health <= 0) {
            this.die();
        }
    }

    die() {
        this.isDead = true;
        this.scene.remove(this.mesh);
        if (this.healthBar) this.healthBar.destroy();
    }
}