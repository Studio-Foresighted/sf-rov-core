import * as THREE from '../lib/three.module.js';
import { HealthBar } from '../ui/healthBar.js';
import { Projectile } from './projectile.js';

export class Tower {
    constructor(scene, team, position, game) {
        this.scene = scene;
        this.team = team;
        this.game = game;
        this.mesh = null;
        
        // Stats
        this.maxHealth = 2000;
        this.health = 2000;
        this.damage = 150; // Increased to ensure one-shot on minions and heavy dmg on heroes
        this.range = 12; 
        this.cooldown = 1.5; // Slower fire rate for "big shots"
        this.lastAttackTime = 0;
        this.isDead = false;

        this.gem = null; 

        this.init(position);
    }

    init(position) {
        this.mesh = new THREE.Group();
        this.mesh.position.copy(position);
        this.mesh.userData = { type: 'tower', entity: this, team: this.team };
        this.scene.add(this.mesh);

        const teamColor = this.team === 'blue' ? 0x4444ff : 0xff4444;
        const stoneColor = 0x555555;
        const darkStone = 0x333333;

        // 1. Base (Tiered)
        const baseGeo1 = new THREE.BoxGeometry(3, 0.5, 3);
        const baseMat = new THREE.MeshStandardMaterial({ color: darkStone });
        const base1 = new THREE.Mesh(baseGeo1, baseMat);
        base1.position.y = 0.25;
        this.mesh.add(base1);

        const baseGeo2 = new THREE.BoxGeometry(2.5, 0.5, 2.5);
        const base2 = new THREE.Mesh(baseGeo2, baseMat);
        base2.position.y = 0.75;
        this.mesh.add(base2);

        // 2. Main Shaft (Pillars)
        const pillarGeo = new THREE.BoxGeometry(0.6, 3, 0.6);
        const pillarMat = new THREE.MeshStandardMaterial({ color: stoneColor });
        
        const p1 = new THREE.Mesh(pillarGeo, pillarMat);
        p1.position.set(0.8, 2.5, 0.8);
        this.mesh.add(p1);

        const p2 = new THREE.Mesh(pillarGeo, pillarMat);
        p2.position.set(-0.8, 2.5, 0.8);
        this.mesh.add(p2);

        const p3 = new THREE.Mesh(pillarGeo, pillarMat);
        p3.position.set(0.8, 2.5, -0.8);
        this.mesh.add(p3);

        const p4 = new THREE.Mesh(pillarGeo, pillarMat);
        p4.position.set(-0.8, 2.5, -0.8);
        this.mesh.add(p4);

        // Core (Inner glow)
        const coreGeo = new THREE.BoxGeometry(1, 2.5, 1);
        const coreMat = new THREE.MeshStandardMaterial({ 
            color: teamColor, 
            emissive: teamColor,
            emissiveIntensity: 0.2
        });
        const core = new THREE.Mesh(coreGeo, coreMat);
        core.position.y = 2.5;
        this.mesh.add(core);

        // 3. Top Platform
        const topGeo = new THREE.BoxGeometry(2.2, 0.4, 2.2);
        const top = new THREE.Mesh(topGeo, baseMat);
        top.position.y = 4.2;
        this.mesh.add(top);

        // 4. Floating Crystal (The "Head")
        const gemGeo = new THREE.BoxGeometry(1.2, 1.2, 1.2);
        const gemMat = new THREE.MeshStandardMaterial({ 
            color: teamColor, 
            emissive: teamColor,
            emissiveIntensity: 0.8
        });
        this.gem = new THREE.Mesh(gemGeo, gemMat);
        this.gem.position.y = 5.5;
        this.mesh.add(this.gem);

        // Range Ring
        const rangeGeo = new THREE.RingGeometry(this.range - 0.2, this.range, 64);
        const rangeMat = new THREE.MeshBasicMaterial({ 
            color: teamColor, 
            side: THREE.DoubleSide, 
            transparent: true, 
            opacity: 0.1 
        });
        const rangeRing = new THREE.Mesh(rangeGeo, rangeMat);
        rangeRing.rotation.x = -Math.PI / 2;
        rangeRing.position.y = 0.1;
        this.mesh.add(rangeRing);

        // Health Bar
        const camera = this.game ? this.game.camera : null;
        this.healthBar = new HealthBar(this.scene, this.mesh, this.maxHealth, 7, 0, camera);
    }

    takeDamage(amount, isCrit = false, attacker = null) {
        this.health -= amount;
        if (this.healthBar) this.healthBar.update(this.health);
        
        // Floating Text: ONLY if attacker is Player
        const isAttackerPlayer = attacker && attacker.mesh && attacker.mesh.userData.type === 'hero';

        if (isAttackerPlayer && this.game && this.game.stats) {
            this.game.stats.damageDone += amount;
        }

        if (this.game && this.game.floatingText && isAttackerPlayer) {
            const color = isCrit ? '#ff4500' : '#ff5555';
            this.game.floatingText.spawn(Math.round(amount), this.mesh.position, color);
        }

        if (this.health <= 0) {
            // Gold Reward: ONLY if attacker is Player
            if (isAttackerPlayer) {
                attacker.addGold(10);
                if (this.game && this.game.floatingText) {
                    this.game.floatingText.spawn("+10g", this.mesh.position, '#ffd700');
                }
            }
            this.die();
        }
    }

    die() {
        this.isDead = true;
        this.scene.remove(this.mesh);
        if (this.healthBar) this.healthBar.destroy();

        // Explosion VFX
        if (this.game && this.game.explosionManager) {
            this.game.explosionManager.spawn(this.mesh.position, 0xffaa00, 20); // Big explosion
        }

        // Update Stats
        if (this.team !== 'blue' && this.game) {
            this.game.stats.towers++;
        }

        // Trigger Game Over
        if (this.game) {
            this.game.checkGameOver(this.team);
        }
    }

    update(dt, enemies) {
        if (this.isDead) return;
        if (this.healthBar) this.healthBar.update(this.health);

        // Animate Gem
        if (this.gem) {
            this.gem.rotation.y += dt;
            this.gem.position.y = 5.5 + Math.sin(Date.now() / 500) * 0.2;
        }

        // Simple cooldown
        const now = this.game && this.game.clock ? this.game.clock.getElapsedTime() : Date.now() / 1000;
        if (now - this.lastAttackTime < this.cooldown) return;

        // Find target
        let target = null;
        let minDist = this.range;

        // Ensure enemies list is valid
        if (!enemies) return;

        for (const enemy of enemies) {
            if (enemy.isDead) continue;
            // Check team
            if (enemy.team === this.team) continue;
            
            // Ignore projectiles and non-units
            // Fix: Check mesh.userData, not entity.userData
            if (!enemy.mesh || !enemy.mesh.userData || !['hero', 'minion'].includes(enemy.mesh.userData.type)) continue;

            const dist = this.mesh.position.distanceTo(enemy.mesh.position);
            if (dist < minDist) {
                minDist = dist;
                target = enemy;
            }
        }

        if (target) {
            this.attack(target);
        }
    }

    attack(target) {
        // RNG Damage (Variance +/- 10%)
        const variance = 0.1; 
        const finalDamage = this.damage * (1 - variance + Math.random() * (variance * 2));

        // Spawn Projectile
        // Origin should be the gem
        const origin = this.mesh.position.clone().add(new THREE.Vector3(0, 5.5, 0));
        
        const proj = new Projectile(this.scene, this, target, finalDamage, 15, false, origin);
        
        // Make it a "Big Shot"
        proj.mesh.scale.set(2.0, 2.0, 2.0);

        // If Projectile uses owner.mesh.position, it will start at base of tower.
        // We can manually override the position of the projectile after creation if needed.
        // proj.mesh.position.copy(this.mesh.position).add(new THREE.Vector3(0, 5.5, 0));

        if (this.game) {
            this.game.entities.push(proj);
        }
        
        // Reset cooldown
        this.lastAttackTime = this.game && this.game.clock ? this.game.clock.getElapsedTime() : Date.now() / 1000;
    }
}