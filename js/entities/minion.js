import * as THREE from '../lib/three.module.js';
import { HealthBar } from '../ui/healthBar.js';
import { Projectile } from './projectile.js';

export class Minion {
    constructor(scene, team, spawnPos, waypoints, game, type = 'melee') {
        this.scene = scene;
        this.team = team; // 'blue' or 'red'
        this.waypoints = waypoints || [];
        this.game = game;
        this.type = type; // 'melee' or 'mage'
        this.currentWaypointIndex = 0;
        this.speed = 3;
        this.maxHealth = type === 'mage' ? 70 : 100;
        this.health = this.maxHealth;
        this.damage = type === 'mage' ? 15 : 10;
        this.attackRange = type === 'mage' ? 8 : 2;
        this.attackCooldown = 1.5;
        this.lastAttackTime = 0;
        
        this.mesh = null;
        this.healthBar = null;
        this.isDead = false;
        this.target = null;
        this.aggroTimer = 0; // Time spent chasing current target

        this.init(spawnPos);
    }

    init(pos) {
        const color = this.team === 'blue' ? 0x000088 : 0x880000;
        // Voxel Body
        const geometry = new THREE.BoxGeometry(1, 1, 1);
        const material = new THREE.MeshStandardMaterial({ 
            color: color,
            roughness: 0.2,
            metalness: 0.5
        });
        this.mesh = new THREE.Mesh(geometry, material);
        
        this.mesh.position.copy(pos);
        this.mesh.position.y = 0.5; // On ground
        this.mesh.castShadow = true;
        this.mesh.receiveShadow = true;

        // Mage Hat (Visual distinction)
        if (this.type === 'mage') {
            const hatGeo = new THREE.ConeGeometry(0.4, 0.8, 4);
            const hatMat = new THREE.MeshStandardMaterial({ color: 0x550055 });
            const hat = new THREE.Mesh(hatGeo, hatMat);
            hat.position.y = 0.8;
            this.mesh.add(hat);
        }
        
        // Eyes
        const eyeGeo = new THREE.BoxGeometry(0.2, 0.2, 0.1);
        const eyeMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
        const pupilGeo = new THREE.BoxGeometry(0.1, 0.1, 0.11);
        const pupilMat = new THREE.MeshBasicMaterial({ color: 0x000000 });

        const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
        leftEye.position.set(-0.25, 0.1, 0.5);
        this.mesh.add(leftEye);
        
        const leftPupil = new THREE.Mesh(pupilGeo, pupilMat);
        leftPupil.position.set(-0.25, 0.1, 0.5);
        this.mesh.add(leftPupil);

        const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
        rightEye.position.set(0.25, 0.1, 0.5);
        this.mesh.add(rightEye);

        const rightPupil = new THREE.Mesh(pupilGeo, pupilMat);
        rightPupil.position.set(0.25, 0.1, 0.5);
        this.mesh.add(rightPupil);
        
        // Tag for raycasting
        this.mesh.userData = { type: 'minion', entity: this };

        this.scene.add(this.mesh);

        // Health Bar
        const camera = this.game ? this.game.camera : null;
        this.healthBar = new HealthBar(this.scene, this.mesh, this.maxHealth, 1.0, 0, camera);
    }

    takeDamage(amount, isCrit = false, attacker = null) {
        this.health -= amount;
        if (this.healthBar) this.healthBar.update(this.health);

        // Floating Text Logic
        // 1. Damage Text: ONLY if attacker is Player
        const isAttackerPlayer = attacker && attacker.mesh && attacker.mesh.userData.type === 'hero';
        
        if (isAttackerPlayer && this.game && this.game.stats) {
            this.game.stats.damageDone += amount;
        }

        if (this.game && this.game.floatingText && isAttackerPlayer) {
            // Use OrangeRed for crit to distinguish from Yellow Gold
            const color = isCrit ? '#ff4500' : '#ff5555'; 
            this.game.floatingText.spawn(Math.round(amount), this.mesh.position, color);
        }

        if (this.health <= 0) {
            // Gold Reward: ONLY if attacker is Player
            if (isAttackerPlayer) {
                attacker.addGold(10);
                if (this.game && this.game.stats) {
                    this.game.stats.cs++;
                }
                if (this.game && this.game.floatingText) {
                    this.game.floatingText.spawn("+10g", this.mesh.position, '#ffd700');
                }
            }
            this.die();
        } else {
            // Flash white
            this.mesh.material.emissive.setHex(0xffffff);
            setTimeout(() => {
                if (!this.isDead) this.mesh.material.emissive.setHex(0x000000);
            }, 100);
        }
    }

    die() {
        this.isDead = true;
        this.scene.remove(this.mesh);
        if (this.healthBar) this.healthBar.destroy();
    }

    update(dt, allEntities) {
        if (this.isDead) return;
        if (this.healthBar) this.healthBar.update(this.health);

        // AI Logic
        // 1. Check if we have a valid target
        if (this.target && this.target.isDead) {
            this.target = null;
            this.aggroTimer = 0;
        }

        // De-aggro logic
        if (this.target) {
            this.aggroTimer += dt;
            
            // 1. Stop attacking player after 3 seconds if there are other targets
            if (this.target.userData && this.target.userData.type === 'hero' && this.aggroTimer > 3.0) {
                // Try to find a minion target instead
                let foundMinion = false;
                for (const entity of allEntities) {
                    if (entity === this || entity.isDead) continue;
                    if (entity.team === this.team) continue;
                    
                    // Ignore projectiles
                    if (!entity.mesh || !entity.mesh.userData || entity.mesh.userData.type !== 'minion') continue;

                    if (entity.userData.type === 'minion') { // Redundant check but safe
                        const dist = this.mesh.position.distanceTo(entity.mesh.position);
                        if (dist < 10) {
                            this.target = entity;
                            this.aggroTimer = 0;
                            foundMinion = true;
                            break;
                        }
                    }
                }
                if (!foundMinion) {
                    // If no minion, maybe just drop aggro and go back to lane?
                    // For now, keep attacking if no other target.
                }
            }

            // 2. General De-aggro: If chasing for too long (5s) without attacking (implied by timer), reset.
            // This handles the "following continuously" issue.
            if (this.aggroTimer > 5.0) {
                const dist = this.mesh.position.distanceTo(this.target.mesh.position);
                if (dist > this.attackRange) {
                    // We are chasing but not in range for 5 seconds -> Give up
                    this.target = null;
                    this.aggroTimer = 0;
                }
            }
        }

        // 2. If no target, look for one
        if (!this.target) {
            let closestDist = 10; // Aggro range
            for (const entity of allEntities) {
                if (entity === this || entity.isDead) continue;
                
                // Check team
                if (entity.team === this.team) continue;

                // Ignore projectiles and non-units
                if (!entity.mesh || !entity.mesh.userData || !['hero', 'minion', 'tower'].includes(entity.mesh.userData.type)) continue;

                const dist = this.mesh.position.distanceTo(entity.mesh.position);
                if (dist < closestDist) {
                    closestDist = dist;
                    this.target = entity;
                    this.aggroTimer = 0;
                }
            }
        }

        // 3. Combat or Move
        if (this.target) {
            const dist = this.mesh.position.distanceTo(this.target.mesh.position);
            if (dist <= this.attackRange) {
                // Attack
                const now = Date.now() / 1000;
                if (now - this.lastAttackTime >= this.attackCooldown) {
                    this.attack(this.target);
                    this.lastAttackTime = now;
                }
            } else {
                // Chase
                const direction = new THREE.Vector3().subVectors(this.target.mesh.position, this.mesh.position).normalize();
                this.mesh.position.add(direction.multiplyScalar(this.speed * dt));
            }
        } else {
            // Move along waypoints
            if (this.currentWaypointIndex < this.waypoints.length) {
                const target = this.waypoints[this.currentWaypointIndex];
                const direction = new THREE.Vector3().subVectors(target, this.mesh.position);
                const dist = direction.length();

                if (dist < 0.5) {
                    this.currentWaypointIndex++;
                } else {
                    direction.normalize();
                    this.mesh.position.add(direction.multiplyScalar(this.speed * dt));
                }
            }
        }
    }

    attack(target) {
        // RNG Damage (Variance +/- 10%)
        const variance = 0.1; 
        const finalDamage = this.damage * (1 - variance + Math.random() * (variance * 2));

        if (this.type === 'mage') {
            // Ranged Attack
            const proj = new Projectile(this.scene, this, target, finalDamage, 10);
            if (this.game) {
                this.game.entities.push(proj);
            }
        } else {
            // Melee Attack
            // Bump animation
            const originalPos = this.mesh.position.clone();
            const direction = new THREE.Vector3().subVectors(target.mesh.position, this.mesh.position).normalize();
            this.mesh.position.add(direction.multiplyScalar(0.3));
            setTimeout(() => {
                if(!this.isDead) this.mesh.position.copy(originalPos);
            }, 100);

            if (target.takeDamage) {
                target.takeDamage(finalDamage, false, this);
            }
        }
    }
}