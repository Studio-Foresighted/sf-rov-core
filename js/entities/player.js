import * as THREE from '../lib/three.module.js';
import { HealthBar } from '../ui/healthBar.js';
import { Projectile } from './projectile.js';

export class Player {
    constructor(scene, type, gameInstance) {
        this.scene = scene;
        this.type = type;
        this.team = 'blue'; // Player is always Blue team for now
        this.game = gameInstance; // Need reference to game to add projectiles
        this.mesh = null;
        this.speed = 5; // Units per second
        this.targetPosition = null;
        this.isMoving = false;
        this.isAttackMoving = false;
        this.autoAttack = false; // Auto-attack state
        
        // Combat stats (Defaults)
        this.maxHealth = 500;
        this.health = 500;
        this.damage = 50;
        this.attackRange = 3;
        this.attackCooldown = 1.0; 
        this.windupTime = 0.3; 
        this.lastAttackTime = 0;
        
        this.targetEntity = null;
        this.attackState = 'IDLE'; 
        this.windupTimer = 0;
        this.gold = 0;

        // Mana & Abilities
        this.maxMana = 200;
        this.mana = 200;
        this.manaRegen = 5; // per second
        this.abilities = {
            q: { name: 'Q', cooldown: 0, maxCooldown: 5, manaCost: 40 },
            w: { name: 'W', cooldown: 0, maxCooldown: 8, manaCost: 60 }
        };

        this.healthBar = null;
        this.rangeIndicator = null;

        // Recall & Buffs
        this.isRecalling = false;
        this.recallTimer = 0;
        this.recallDuration = 3.0; // 3 seconds
        this.recallVfx = null;
        
        this.speedBuffTimer = 0;
        this.baseSpeed = this.speed;

        this.init();
    }

    addGold(amount) {
        this.gold += amount;
        const goldEl = document.getElementById('gold-val');
        if (goldEl) {
            goldEl.textContent = this.gold;
        }
    }

    init() {
        // Create mesh based on type & Set Stats
        let color = 0xffffff;
        if (this.type === 'warrior') {
            color = 0x880000; // Dark Red
            this.maxHealth = 700;
            this.damage = 60;
            this.attackRange = 2.5; // Melee
            this.attackCooldown = 1.2;
        }
        if (this.type === 'mage') {
            color = 0x000088; // Dark Blue
            this.maxHealth = 450;
            this.damage = 45;
            this.attackRange = 10; // Ranged
            this.attackCooldown = 0.8;
            this.windupTime = 0.2; // Faster cast
        }
        this.health = this.maxHealth;

        // Voxel Character
        const geometry = new THREE.BoxGeometry(1, 1.5, 1);
        const material = new THREE.MeshStandardMaterial({ 
            color: color,
            roughness: 0.2,
            metalness: 0.5
        });
        this.mesh = new THREE.Mesh(geometry, material);
        
        // Head
        const headGeo = new THREE.BoxGeometry(0.8, 0.8, 0.8);
        const headMat = new THREE.MeshStandardMaterial({ color: 0xffccaa }); // Skin tone
        const head = new THREE.Mesh(headGeo, headMat);
        head.position.y = 1.15;
        this.mesh.add(head);

        // Eyes
        const eyeGeo = new THREE.BoxGeometry(0.15, 0.15, 0.1);
        const eyeMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
        const pupilGeo = new THREE.BoxGeometry(0.08, 0.08, 0.11);
        const pupilMat = new THREE.MeshBasicMaterial({ color: 0x000000 });

        const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
        leftEye.position.set(-0.2, 0.1, 0.4);
        head.add(leftEye);
        
        const leftPupil = new THREE.Mesh(pupilGeo, pupilMat);
        leftPupil.position.set(-0.2, 0.1, 0.4);
        head.add(leftPupil);

        const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
        rightEye.position.set(0.2, 0.1, 0.4);
        head.add(rightEye);

        const rightPupil = new THREE.Mesh(pupilGeo, pupilMat);
        rightPupil.position.set(0.2, 0.1, 0.4);
        head.add(rightPupil);

        // Weapon (Simple Voxel Sword/Staff)
        const weaponGeo = new THREE.BoxGeometry(0.2, 1.5, 0.2);
        const weaponMat = new THREE.MeshStandardMaterial({ color: 0x888888, metalness: 0.8 });
        const weapon = new THREE.Mesh(weaponGeo, weaponMat);
        weapon.position.set(0.6, 0.5, 0.5);
        weapon.rotation.x = Math.PI / 4;
        this.mesh.add(weapon);

        // Set initial position (Base)
        this.mesh.position.set(0, 0.75, 0); // y=0.75 because height is 1.5
        this.mesh.castShadow = true;
        this.mesh.receiveShadow = true;
        
        // Tag
        this.mesh.userData = { type: 'hero', entity: this };

        this.scene.add(this.mesh);

        // Health Bar (with Mana)
        const camera = this.game ? this.game.camera : null;
        this.healthBar = new HealthBar(this.scene, this.mesh, this.maxHealth, 2.5, this.maxMana, camera);
        
        // Update HUD
        const hpEl = document.getElementById('hp-val');
        if (hpEl) hpEl.textContent = this.maxHealth;

        // Range Indicator
        const rangeGeo = new THREE.RingGeometry(this.attackRange - 0.1, this.attackRange, 64);
        const rangeMat = new THREE.MeshBasicMaterial({ 
            color: 0xffffff, 
            side: THREE.DoubleSide, 
            transparent: true, 
            opacity: 0.2 
        });
        this.rangeIndicator = new THREE.Mesh(rangeGeo, rangeMat);
        this.rangeIndicator.rotation.x = -Math.PI / 2;
        this.rangeIndicator.position.y = -0.7; // Just above ground
        this.rangeIndicator.visible = false; // Hidden by default
        this.mesh.add(this.rangeIndicator);
    }

    takeDamage(amount, isCrit = false) {
        this.cancelRecall(); // Taking damage cancels recall
        this.health -= amount;
        
        // Track Stats
        if (this.game && this.game.stats) {
            this.game.stats.damageTaken += amount;
        }

        if (this.healthBar) this.healthBar.update(this.health, this.mana);
        
        // Update HUD
        const hpEl = document.getElementById('hp-val');
        if (hpEl) hpEl.textContent = Math.max(0, Math.ceil(this.health));

        // Floating Text: Removed for Player taking damage (User request: "RED for dmg by ONLY ME")
        // If we wanted to show damage TAKEN, we would use a different color or logic.
        // For now, strictly following "nothing else should show the dmg numbers".

        if (this.health <= 0) {
            console.log("Player died!");
            // Respawn logic later
            this.health = this.maxHealth;
            this.mesh.position.set(0, 1, 40); // Back to base
            this.targetPosition = null;
            this.isMoving = false;
            this.targetEntity = null;
            if (this.healthBar) this.healthBar.update(this.health);
        }
    }

    moveTo(point) {
        this.cancelRecall(); // Moving cancels recall
        this.targetPosition = point.clone();
        this.targetPosition.y = this.mesh.position.y;
        this.isMoving = true;
        this.isAttackMoving = false; // Normal move cancels attack move
        this.autoAttack = false; // Cancel auto-attack
        this.targetEntity = null; // Cancel specific target
        
        // Cancel attack if in windup (Animation Canceling - Before)
        if (this.attackState === 'WINDUP') {
            this.attackState = 'IDLE';
            this.windupTimer = 0;
            console.log("Attack Cancelled (Windup)");
        }
        
        this.mesh.lookAt(this.targetPosition);
    }

    attackMove(point) {
        this.moveTo(point);
        this.isAttackMoving = true;
        console.log("Attack Moving to", point);
    }

    attack(target) {
        this.targetEntity = target;
        this.isMoving = false;
        this.isAttackMoving = false;
    }

    update(dt, allEntities) {
        // Update Health Bar position
        if (this.healthBar) this.healthBar.update(this.health, this.mana);

        // Recall Logic
        if (this.isRecalling) {
            this.recallTimer += dt;
            
            // VFX Animation
            if (this.recallVfx) {
                this.recallVfx.rotation.y += dt * 2;
                this.recallVfx.position.copy(this.mesh.position);
                this.recallVfx.position.y = 0.1 + (this.recallTimer / this.recallDuration) * 2; // Rise up
                
                // Pulse opacity
                this.recallVfx.material.opacity = 0.5 + Math.sin(this.recallTimer * 10) * 0.2;
            }

            if (this.recallTimer >= this.recallDuration) {
                this.finishRecall();
            }
            return; // Skip other updates while recalling (cannot move/attack)
        }

        // Buff Logic
        if (this.speedBuffTimer > 0) {
            this.speedBuffTimer -= dt;
            
            // Update UI Timer
            const buffIcon = document.getElementById('buff-speed');
            if (buffIcon) {
                const timerEl = buffIcon.querySelector('.buff-timer');
                if (timerEl) {
                    timerEl.textContent = Math.ceil(this.speedBuffTimer);
                }
            }

            if (this.speedBuffTimer <= 0) {
                this.speed = this.baseSpeed;
                if (buffIcon) buffIcon.remove();
            }
        }

        // Mana Regen
        if (this.mana < this.maxMana) {
            this.mana += this.manaRegen * dt;
            if (this.mana > this.maxMana) this.mana = this.maxMana;
            
            // Update HUD
            const mpEl = document.getElementById('mp-val');
            if (mpEl) mpEl.textContent = Math.floor(this.mana);
        }

        // Cooldowns
        for (const key in this.abilities) {
            if (this.abilities[key].cooldown > 0) {
                this.abilities[key].cooldown -= dt;
                if (this.abilities[key].cooldown < 0) this.abilities[key].cooldown = 0;
            }
        }

        const now = Date.now() / 1000;

        // 1. Handle Attack State Machine
        if (this.attackState === 'WINDUP') {
            this.windupTimer += dt;
            if (this.windupTimer >= this.windupTime) {
                this.performDamage();
                this.attackState = 'COOLDOWN';
                this.lastAttackTime = now;
            }
            return; // Don't move while winding up
        }

        if (this.attackState === 'COOLDOWN') {
            if (now - this.lastAttackTime >= this.attackCooldown) {
                this.attackState = 'IDLE';
            }
            // We CAN move during cooldown (Backswing canceling)
        }

        // 2. Attack Move Logic: Scan for targets if moving
        if (this.isAttackMoving && this.isMoving) {
            // Simple scan: closest enemy in range
            let closestDist = this.attackRange;
            let foundTarget = null;

            if (allEntities) {
                for (const entity of allEntities) {
                    if (entity === this || entity.isDead) continue;
                    // Check if enemy (assuming Player is Blue)
                    if (entity.team === 'blue') continue; 
                    if (entity.userData && entity.userData.type === 'tower' && entity.team === 'blue') continue;

                    const dist = this.mesh.position.distanceTo(entity.mesh.position);
                    if (dist <= this.attackRange) {
                        // Found something in range! Stop and attack.
                        foundTarget = entity;
                        break; // Attack the first one found in range (or could find closest)
                    }
                }
            }

            if (foundTarget) {
                this.autoAttack = true; // Enable auto-attack since we found something via Attack Move
                this.attack(foundTarget); // Switch to attack mode
                return;
            }
        }

        // 3. Combat Logic (Chasing & Attacking specific target)
        if (this.targetEntity) {
            if (this.targetEntity.isDead) {
                this.targetEntity = null;
                
                // Auto Attack Logic: Look for next target
                if (this.autoAttack && allEntities) {
                    let closestDist = this.attackRange;
                    let nextTarget = null;
                    for (const entity of allEntities) {
                        if (entity === this || entity.isDead) continue;
                        if (entity.team === 'blue') continue;
                        if (entity.userData && entity.userData.type === 'tower' && entity.team === 'blue') continue;

                        const dist = this.mesh.position.distanceTo(entity.mesh.position);
                        if (dist <= this.attackRange) {
                            nextTarget = entity;
                            break;
                        }
                    }
                    if (nextTarget) {
                        this.attack(nextTarget);
                    } else {
                        // No target found, stop auto-attacking? Or stay in mode?
                        // Usually you stay in mode but idle.
                        // But for now let's just stay idle.
                    }
                }
                return;
            }

            const dist = this.mesh.position.distanceTo(this.targetEntity.mesh.position);
            
            if (dist > this.attackRange) {
                // Move towards target
                // Fix Tilt: Look at target but keep Y same as player
                const lookTarget = this.targetEntity.mesh.position.clone();
                lookTarget.y = this.mesh.position.y;
                this.mesh.lookAt(lookTarget);

                const direction = new THREE.Vector3().subVectors(this.targetEntity.mesh.position, this.mesh.position).normalize();
                this.mesh.position.add(direction.multiplyScalar(this.speed * dt));
            } else {
                // In range
                // Fix Tilt
                const lookTarget = this.targetEntity.mesh.position.clone();
                lookTarget.y = this.mesh.position.y;
                this.mesh.lookAt(lookTarget);
                
                // Start Attack if ready
                if (this.attackState === 'IDLE') {
                    this.startAttack();
                }
            }
            return;
        }

        // 4. Movement Logic
        if (!this.isMoving || !this.targetPosition) return;

        const currentPos = this.mesh.position;
        const direction = new THREE.Vector3().subVectors(this.targetPosition, currentPos);
        const distance = direction.length();

        if (distance < 0.1) {
            this.mesh.position.copy(this.targetPosition);
            this.isMoving = false;
            this.isAttackMoving = false; // Reached destination
            this.autoAttack = false; // Reached destination without attacking, so turn off
            return;
        }

        direction.normalize();
        const moveStep = direction.multiplyScalar(this.speed * dt);
        
        if (moveStep.length() > distance) {
            this.mesh.position.copy(this.targetPosition);
            this.isMoving = false;
            this.isAttackMoving = false;
            this.autoAttack = false; // Reached destination
        } else {
            this.mesh.position.add(moveStep);
        }

        // Clamp to Lane (approx width 15, so -7.5 to 7.5)
        // Lane is 1.5x wider now, so width ~22.5 -> -11 to 11
        // Visual lane is 15 width (-7.5 to 7.5).
        // We want to clamp to visual lane.
        // Updated to 25 width -> +/- 12.5
        if (this.mesh.position.x > 12.0) this.mesh.position.x = 12.0;
        if (this.mesh.position.x < -12.0) this.mesh.position.x = -12.0;

            // Mobile joystick movement & fire/skills
        if (window.innerWidth < 900 && this.game && this.game.input && typeof this.game.input.getMoveDirection === 'function') {
            const moveDir = this.game.input.getMoveDirection();
            if (moveDir.x !== 0 || moveDir.y !== 0) {
                this.mesh.position.x += moveDir.x * this.speed * dt * 2; // Double speed for responsiveness
                this.mesh.position.z += moveDir.y * this.speed * dt * 2;
                // Face movement direction
                const targetX = this.mesh.position.x + moveDir.x;
                const targetZ = this.mesh.position.z + moveDir.y;
                this.mesh.lookAt(targetX, this.mesh.position.y, targetZ);
                this.isMoving = true;
            }
        }
                // Fire button triggers basic attack
                if (this.game.input.isMouseDown) {
                    // For ranged: fire projectile. For melee: attack nearest enemy.
                    if (this.type === 'mage') {
                        // Find nearest enemy
                        let nearest = null;
                        let minDist = Infinity;
                        for (const entity of allEntities) {
                            if (entity === this || entity.team === this.team || !entity.mesh) continue;
                            const dist = this.mesh.position.distanceTo(entity.mesh.position);
                            if (dist < minDist) {
                                minDist = dist;
                                nearest = entity;
                            }
                        }
                        if (nearest && minDist < this.attackRange + 2) {
                            this.targetEntity = nearest;
                            this.startAttack();
                        }
                    } else {
                        // Melee: attack nearest enemy
                        let nearest = null;
                        let minDist = Infinity;
                        for (const entity of allEntities) {
                            if (entity === this || entity.team === this.team || !entity.mesh) continue;
                            const dist = this.mesh.position.distanceTo(entity.mesh.position);
                            if (dist < minDist) {
                                minDist = dist;
                                nearest = entity;
                            }
                        }
                        if (nearest && minDist < this.attackRange + 1) {
                            this.targetEntity = nearest;
                            this.startAttack();
                        }
                    }
                }

                // Skill buttons
                if (this.game.input.isSkill1Down) {
                    // Cast Q at current facing direction
                    const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(this.mesh.quaternion);
                    const targetPos = this.mesh.position.clone().add(forward.multiplyScalar(this.attackRange));
                    this.castAbility('q', targetPos);
                }
                if (this.game.input.isSkill2Down) {
                    // Cast W at current position
                    this.castAbility('w', this.mesh.position.clone());
                }
    }

    startAttack() {
        this.attackState = 'WINDUP';
        this.windupTimer = 0;
        
        // Visual: Windup (pull back slightly)
        // Recoil removed by user request
        // const backward = new THREE.Vector3(0, 0, -1).applyQuaternion(this.mesh.quaternion);
        // this.mesh.position.add(backward.multiplyScalar(0.2));
    }

    performDamage() {
        if (!this.targetEntity) return;
        if (this.targetEntity === this) return; // Prevent self-damage

        // RNG Damage (Variance)
        const variance = 0.1; // +/- 10%
        const baseDmg = this.damage * (1 - variance + Math.random() * (variance * 2));
        
        // Crit Logic
        const isCrit = Math.random() < 0.2; // 20% chance
        const finalDamage = isCrit ? baseDmg * 1.5 : baseDmg;

        if (this.type === 'mage') {
            // Ranged Attack: Spawn Projectile
            // Increased speed from 15 to 20 (approx 1.3x)
            const proj = new Projectile(this.scene, this, this.targetEntity, finalDamage, 20, isCrit);
                if (this.game) {
                this.game.entities.push(proj);
            }
        } else {
            // Melee Attack: Instant Hit
            // Visual: Strike (lunge forward)
            const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(this.mesh.quaternion);
            this.mesh.position.add(forward.multiplyScalar(0.7)); 
            
            // Reset position after short delay (visual only)
            const originalPos = this.mesh.position.clone().sub(forward.multiplyScalar(0.7));
            setTimeout(() => {
                this.mesh.position.copy(originalPos);
            }, 100);

            // Deal Damage
            if (this.targetEntity.takeDamage) {
                this.targetEntity.takeDamage(finalDamage, isCrit, this);
            }
        }
    }

    castAbility(key, targetPos = null) {
        const ability = this.abilities[key];
        if (!ability) return;

        if (ability.cooldown > 0) {
            console.log(`${ability.name} is on cooldown!`);
            return;
        }

        if (this.mana < ability.manaCost) {
            console.log(`Not enough mana for ${ability.name}!`);
            return;
        }

        // Execute Skill
        let success = false;
        if (key === 'q') success = this.castQ(targetPos);
        if (key === 'w') success = this.castW(targetPos);

        if (success) {
            this.mana -= ability.manaCost;
            ability.cooldown = ability.maxCooldown;
            console.log(`Casted ${ability.name}!`);
            
            // Update HUD immediately
            const mpEl = document.getElementById('mp-val');
            if (mpEl) mpEl.textContent = Math.floor(this.mana);
        }
    }

    castQ(targetPos) {
        if (this.type === 'warrior') {
            // Warrior Q: Dash
            // Dash forward 5 units
            const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(this.mesh.quaternion);
            const dashSpeed = 20;
            const dashDuration = 0.25; // 5 units / 20 speed
            
            // Simple dash implementation: Override movement for a short time
            // For now, just teleport/tween manually in update? 
            // Or just add velocity. Let's do a simple position add for instant dash feel or use a "dashing" state.
            // Let's just push position for now.
            this.mesh.position.add(forward.multiplyScalar(5));
            
            // Visual
            if (this.game && this.game.explosionManager) {
                // Trail effect?
                this.game.explosionManager.spawn(this.mesh.position, 0xffffff, 5);
            }
            return true;
        } 
        else if (this.type === 'mage') {
            // Mage Q: Fireball (Skillshot towards mouse)
            if (!targetPos) return false;

            // 1. Face the target
            this.mesh.lookAt(targetPos.x, this.mesh.position.y, targetPos.z);

            // 2. Calculate direction
            const direction = new THREE.Vector3().subVectors(targetPos, this.mesh.position);
            direction.y = 0;
            direction.normalize();

            // 3. Spawn Projectile
            const damage = this.damage * 2.5;
            // Create a dummy target at max range (15 units)
            const maxRange = 15;
            const endPos = this.mesh.position.clone().add(direction.multiplyScalar(maxRange));
            const dummyTarget = { mesh: { position: endPos }, isDead: false };
            
            // Pass isSkillshot = true
            const proj = new Projectile(this.scene, this, dummyTarget, damage, 25, true, null, true);
            proj.mesh.scale.set(1.5, 1.5, 1.5);
            
            if (this.game) this.game.entities.push(proj);
            return true;
        }
        return false;
    }

    castW(targetPos) {
        if (this.type === 'warrior') {
            // Warrior W: Spin (AoE)
            const range = 4;
            const damage = this.damage * 1.5;
            
            // Visual
            const geometry = new THREE.RingGeometry(range - 0.5, range, 32);
            const material = new THREE.MeshBasicMaterial({ color: 0xff0000, side: THREE.DoubleSide, transparent: true, opacity: 0.5 });
            const ring = new THREE.Mesh(geometry, material);
            ring.rotation.x = -Math.PI / 2;
            ring.position.copy(this.mesh.position);
            ring.position.y = 0.5;
            this.scene.add(ring);
            
            // Remove ring after animation
            let scale = 1;
            const animate = () => {
                scale -= 0.1;
                ring.scale.set(scale, scale, scale);
                if (scale <= 0) this.scene.remove(ring);
                else requestAnimationFrame(animate);
            };
            animate();

            // Damage Logic
            if (this.game && this.game.entities) {
                this.game.entities.forEach(entity => {
                    if (entity === this || entity.team === this.team) return;
                    if (entity.isDead) return;
                    
                    const dist = this.mesh.position.distanceTo(entity.mesh.position);
                    if (dist <= range) {
                        if (entity.takeDamage) entity.takeDamage(damage, false, this);
                    }
                });
            }
            return true;
        }
        else if (this.type === 'mage') {
            // Mage W: Nova (AoE Self)
            const range = 5;
            const damage = this.damage * 1.2;
            
            // Visual: Blue Ring
            const geometry = new THREE.RingGeometry(0.1, range, 32);
            const material = new THREE.MeshBasicMaterial({ color: 0x00ffff, side: THREE.DoubleSide, transparent: true, opacity: 0.3 });
            const ring = new THREE.Mesh(geometry, material);
            ring.rotation.x = -Math.PI / 2;
            ring.position.copy(this.mesh.position);
            ring.position.y = 0.5;
            this.scene.add(ring);
            
            // Fade out
            let opacity = 0.5;
            const animate = () => {
                opacity -= 0.02;
                ring.material.opacity = opacity;
                if (opacity <= 0) this.scene.remove(ring);
                else requestAnimationFrame(animate);
            };
            animate();

            // Damage Logic
            if (this.game && this.game.entities) {
                this.game.entities.forEach(entity => {
                    if (entity === this || entity.team === this.team) return;
                    if (entity.isDead) return;
                    
                    const dist = this.mesh.position.distanceTo(entity.mesh.position);
                    if (dist <= range) {
                        if (entity.takeDamage) entity.takeDamage(damage, false, this);
                        // Freeze/Slow effect? Maybe later.
                    }
                });
            }
            return true;
        }
        return false;
    }

    startRecall() {
        // Removed isMoving check to allow recall to interrupt movement
        if (this.isRecalling || this.attackState !== 'IDLE') return;
        
        console.log("Starting Recall...");
        
        // Stop Movement Immediately
        this.isMoving = false;
        this.targetPosition = null;
        this.isAttackMoving = false;
        this.autoAttack = false;
        this.targetEntity = null;

        this.isRecalling = true;
        this.recallTimer = 0;
        
        // Visual Effect
        let color = 0x00ffff; // Mage (Cyan/Magic)
        if (this.type === 'warrior') color = 0xffaa00; // Warrior (Gold/Power)

        // Create a ring or pillar of light
        const geometry = new THREE.CylinderGeometry(1, 1, 0.1, 32);
        const material = new THREE.MeshBasicMaterial({ 
            color: color, 
            transparent: true, 
            opacity: 0.5,
            side: THREE.DoubleSide
        });
        this.recallVfx = new THREE.Mesh(geometry, material);
        this.recallVfx.position.copy(this.mesh.position);
        this.recallVfx.position.y = 0.1;
        this.scene.add(this.recallVfx);
        
        // Add particles or animation in update
    }

    cancelRecall() {
        if (!this.isRecalling) return;
        console.log("Recall Cancelled!");
        this.isRecalling = false;
        this.recallTimer = 0;
        
        if (this.recallVfx) {
            this.scene.remove(this.recallVfx);
            this.recallVfx = null;
        }
    }

    finishRecall() {
        console.log("Recall Complete!");
        this.isRecalling = false;
        if (this.recallVfx) {
            this.scene.remove(this.recallVfx);
            this.recallVfx = null;
        }

        // Teleport to Base
        this.mesh.position.set(0, 1, 40); // Base coordinates
        this.targetPosition = null;
        this.isMoving = false;
        
        // Instant Heal
        this.health = this.maxHealth;
        this.mana = this.maxMana;
        if (this.healthBar) this.healthBar.update(this.health, this.mana);
        
        // Speed Buff (85% for 5s)
        this.speedBuffTimer = 5.0;
        this.speed = this.baseSpeed * 1.85;
        
        // Add Buff Icon
        const buffBar = document.getElementById('buff-bar');
        if (buffBar) {
            // Clear existing speed buff if any
            const existing = document.getElementById('buff-speed');
            if (existing) existing.remove();

            const icon = document.createElement('div');
            icon.className = 'buff-icon';
            icon.id = 'buff-speed';
            
            // Generate Pixel Art Icon
            if (this.game && this.game.skillIcons) {
                const canvas = this.game.skillIcons.createIconCanvas('buff_speed');
                if (canvas) {
                    canvas.style.position = 'absolute';
                    canvas.style.top = '0';
                    canvas.style.left = '0';
                    canvas.style.width = '100%';
                    canvas.style.height = '100%';
                    canvas.style.zIndex = '1'; // Ensure it sits above background
                    icon.appendChild(canvas);
                }
            }
            
            // Inner text for countdown
            const timer = document.createElement('span');
            timer.className = 'buff-timer';
            timer.textContent = '5';
            timer.style.zIndex = '2'; // Ensure on top of canvas
            timer.style.position = 'relative';
            icon.appendChild(timer);
            
            buffBar.appendChild(icon);
        }
    }
}