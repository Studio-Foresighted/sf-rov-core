import * as THREE from '../lib/three.module.js';

// Shared Geometry and Materials to reduce draw calls/memory
const PROJ_GEO = new THREE.BoxGeometry(0.4, 0.4, 0.4);
const PROJ_MAT_CYAN = new THREE.MeshBasicMaterial({ color: 0x00ffff });
const PROJ_MAT_ORANGE = new THREE.MeshBasicMaterial({ color: 0xffaa00 });

export class Projectile {
    constructor(scene, owner, target, damage, speed = 15, isCrit = false, startPos = null, isSkillshot = false) {
        this.scene = scene;
        this.owner = owner; 
        this.target = target;
        this.damage = damage;
        this.speed = speed;
        this.isCrit = isCrit;
        this.isSkillshot = isSkillshot;
        
        if (startPos) {
            this.position = startPos.clone();
        } else {
            this.position = owner.mesh.position.clone();
            this.position.y = 1.5; // Shoot from chest height
        }
        
        this.mesh = null;
        this.isDead = false;
        this.hitRadius = 1.0; // Larger hit radius for skillshots

        this.init();
    }

    init() {
        // Use shared geometry/material
        const material = this.isCrit ? PROJ_MAT_ORANGE : PROJ_MAT_CYAN;
        this.mesh = new THREE.Mesh(PROJ_GEO, material);
        this.mesh.position.copy(this.position);
        
        // Removed PointLight for performance
        // const light = new THREE.PointLight(material.color, 0.5, 3);
        // this.mesh.add(light);

        this.scene.add(this.mesh);
    }

    update(dt) {
        if (this.isDead) return;

        // Skillshot Logic (Directional)
        if (this.isSkillshot) {
            // Move towards target position (which is just a point in space for skillshots)
            const targetPos = this.target.mesh.position.clone();
            targetPos.y = 1.5;
            
            const direction = new THREE.Vector3().subVectors(targetPos, this.mesh.position);
            const distToTarget = direction.length();
            
            // Check collisions with enemies
            if (this.owner && this.owner.game && this.owner.game.entities) {
                for (const entity of this.owner.game.entities) {
                    // Filter out: Self, Teammates, Dead units, and Non-Units (like other projectiles)
                    if (entity === this.owner || entity.isDead) continue;
                    if (entity.team && this.owner.team && entity.team === this.owner.team) continue;
                    if (!entity.takeDamage) continue; // Must be a unit (has health)
                    
                    // Simple sphere collision
                    const dist = this.mesh.position.distanceTo(entity.mesh.position);
                    if (dist < this.hitRadius + 0.5) { // +0.5 for entity radius approx
                        this.onHit(entity);
                        return;
                    }
                }
            }

            if (distToTarget < 0.5) {
                // Reached max range without hitting anything
                this.die(); // Just explode/disappear
            } else {
                direction.normalize();
                this.mesh.position.add(direction.multiplyScalar(this.speed * dt));
            }
            return;
        }

        // Homing missile logic
        if (this.target) {
            // If target is dead, continue to its last known position (don't disappear mid-air)
            // We rely on the mesh position still being valid even if removed from scene
            
            // Prevent self-hit (though logic below shouldn't allow it unless target == owner)
            if (this.target === this.owner) {
                this.die();
                return;
            }

            const targetPos = this.target.mesh.position.clone();
            targetPos.y = 1.5; 

            const direction = new THREE.Vector3().subVectors(targetPos, this.mesh.position);
            const dist = direction.length();

            if (dist < 0.5) {
                this.onHit(this.target);
            } else {
                direction.normalize();
                this.mesh.position.add(direction.multiplyScalar(this.speed * dt));
            }
        } else {
            this.die();
        }
    }

    onHit(targetEntity) {
        if (targetEntity && targetEntity.takeDamage) {
            targetEntity.takeDamage(this.damage, this.isCrit, this.owner);
        }
        
        // Visual Explosion
        if (this.owner && this.owner.game && this.owner.game.explosionManager) {
            const color = this.isCrit ? 0xffaa00 : 0x00ffff;
            this.owner.game.explosionManager.spawn(this.mesh.position, color, 5);
        }

        this.die();
    }

    die() {
        this.isDead = true;
        this.scene.remove(this.mesh);
    }
}