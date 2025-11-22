import * as THREE from 'three';
import { Player } from './entities/player.js';
import { Minion } from './entities/minion.js';
import { Tower } from './entities/tower.js';
import { Dummy } from './entities/dummy.js';
import { FloatingTextManager } from './ui/floatingText.js';
import { ExplosionManager } from './vfx/explosion.js';
import { SkillIcons } from './ui/skillIcons.js';

export class Game {
    constructor() {
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.player = null;
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        this.plane = null;
        this.clock = new THREE.Clock();
        this.isRunning = false;
        
        this.entities = []; // All game entities (minions, towers, etc)
        this.lastWaveTime = 0;
        
        this.isPaused = false;
        this.awaitingAttackMove = false;

        this.explosionManager = null;
        this.floatingText = new FloatingTextManager();
        this.skillIcons = new SkillIcons();
        this.showCooldownNumbers = true;
        
        // Stats
        this.stats = {
            kills: 0,
            deaths: 0,
            cs: 0,
            towers: 0,
            damageDone: 0,
            damageTaken: 0
        };
        this.isGameOver = false;

        // Expose toggle function
        window.toggleCooldownTimer = () => {
            this.showCooldownNumbers = !this.showCooldownNumbers;
        };
    }

    checkGameOver(losingTeam) {
        if (this.isGameOver) return;
        this.isGameOver = true;
        
        const winningTeam = losingTeam === 'blue' ? 'RED' : 'BLUE';
        const resultText = winningTeam === 'BLUE' ? 'VICTORY' : 'DEFEAT';
        const color = winningTeam === 'BLUE' ? '#00ffff' : '#ff0000';
        
        const screen = document.getElementById('game-over-screen');
        const title = document.getElementById('game-result-title');
        
        // Add class for styling
        screen.classList.remove('victory', 'defeat');
        screen.classList.add(winningTeam === 'BLUE' ? 'victory' : 'defeat');

        title.textContent = resultText;
        title.style.color = color;
        
        document.getElementById('stat-kills').textContent = this.stats.kills;
        document.getElementById('stat-deaths').textContent = this.stats.deaths;
        document.getElementById('stat-cs').textContent = this.stats.cs;
        document.getElementById('stat-towers').textContent = this.stats.towers;
        document.getElementById('stat-dmg-done').textContent = Math.round(this.stats.damageDone);
        document.getElementById('stat-dmg-taken').textContent = Math.round(this.stats.damageTaken);
        
        screen.style.display = 'flex';
        this.isPaused = true;
    }

    start(heroType) {
        console.log("Starting game with hero:", heroType);
        this.initThreeJS();
        this.createMap();
        this.spawnPlayer(heroType);
        this.setupInputs();
        
        // Phase 2 Additions
        // this.spawnDummy(); // Removed by user request
        this.spawnTowers();
        
        this.isRunning = true;
        this.animate();

        // Show HUD
        document.getElementById('game-hud').style.display = 'block';

        // Update Pause Menu Descriptions
        const descQ = document.getElementById('desc-q');
        const descW = document.getElementById('desc-w');
        if (heroType === 'warrior') {
            if (descQ) descQ.textContent = "Dash forward (Cost: 40 MP, Dmg: 0)";
            if (descW) descW.textContent = "Spin Attack AoE (Cost: 60 MP, Dmg: 90, Range: 4)";
            this.skillIcons.generateIcon('warrior_q', 'icon-q');
            this.skillIcons.generateIcon('warrior_w', 'icon-w');
        } else if (heroType === 'mage') {
            if (descQ) descQ.textContent = "Fireball Skillshot (Cost: 40 MP, Dmg: 112, Range: 15)";
            if (descW) descW.textContent = "Frost Nova AoE (Cost: 60 MP, Dmg: 54, Range: 5)";
            this.skillIcons.generateIcon('mage_q', 'icon-q');
            this.skillIcons.generateIcon('mage_w', 'icon-w');
        }
    }

    initThreeJS() {
        const container = document.getElementById('game-container');

        // Scene
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x111111); // Dark background
        this.scene.fog = new THREE.Fog(0x111111, 30, 90);

        this.explosionManager = new ExplosionManager(this.scene);

        // Camera (Isometric-ish)
        const aspect = window.innerWidth / window.innerHeight;
        const d = 20;
        // Orthographic camera is better for MOBA/RTS usually, but Perspective is fine too.
        // Let's use Perspective for now for a more modern look.
        this.camera = new THREE.PerspectiveCamera(45, aspect, 0.1, 1000);
        this.camera.position.set(20, 30, 20); // High up and angled
        this.camera.lookAt(0, 0, 0);

        // Renderer
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.shadowMap.enabled = true;
        container.appendChild(this.renderer.domElement);

        // Lights
        const ambientLight = new THREE.AmbientLight(0x404040); // Soft white light
        this.scene.add(ambientLight);

        const dirLight = new THREE.DirectionalLight(0xffffff, 1);
        dirLight.position.set(10, 20, 10);
        dirLight.castShadow = true;
        dirLight.shadow.camera.top = 20;
        dirLight.shadow.camera.bottom = -20;
        dirLight.shadow.camera.left = -20;
        dirLight.shadow.camera.right = 20;
        this.scene.add(dirLight);

        // Handle resize
        window.addEventListener('resize', () => {
            this.camera.aspect = window.innerWidth / window.innerHeight;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(window.innerWidth, window.innerHeight);
        });
    }

    createMap() {
        // Simple ground plane
        const geometry = new THREE.PlaneGeometry(100, 100);
        const material = new THREE.MeshStandardMaterial({ 
            color: 0x050505, // Almost black
            roughness: 0.9 
        });
        this.plane = new THREE.Mesh(geometry, material);
        this.plane.rotation.x = -Math.PI / 2; // Rotate to be flat
        this.plane.receiveShadow = true;
        this.scene.add(this.plane);

        // Grid helper
        const gridHelper = new THREE.GridHelper(100, 50, 0x444444, 0x222222);
        this.scene.add(gridHelper);

        // Simple Lane Visuals (Grey path)
        // Widen lane 1.5x (10 -> 15) -> Now 25 per user request
        const laneGeo = new THREE.PlaneGeometry(25, 80);
        const laneMat = new THREE.MeshStandardMaterial({ color: 0x7f8c8d });
        const lane = new THREE.Mesh(laneGeo, laneMat);
        lane.rotation.x = -Math.PI / 2;
        lane.position.y = 0.01; // Just above grass
        this.scene.add(lane);

        // Add Trees
        this.createTrees();
    }

    createTrees() {
        const treeGeo = new THREE.BoxGeometry(1, 4, 1);
        const treeMat = new THREE.MeshStandardMaterial({ color: 0x2ecc71 }); // Green
        const trunkGeo = new THREE.BoxGeometry(0.5, 1, 0.5);
        const trunkMat = new THREE.MeshStandardMaterial({ color: 0x8B4513 }); // Brown

        // Create a few trees along the sides
        // Adjusted for wider lane (25 width -> +/- 12.5)
        for (let z = -40; z <= 40; z += 10) {
            // Left side
            this.spawnTree(-15, z, treeGeo, treeMat, trunkGeo, trunkMat);
            this.spawnTree(-18, z + 5, treeGeo, treeMat, trunkGeo, trunkMat);
            
            // Right side
            this.spawnTree(15, z, treeGeo, treeMat, trunkGeo, trunkMat);
            this.spawnTree(18, z + 5, treeGeo, treeMat, trunkGeo, trunkMat);
        }
    }

    spawnTree(x, z, leafGeo, leafMat, trunkGeo, trunkMat) {
        const group = new THREE.Group();
        group.position.set(x, 0, z);
        
        const trunk = new THREE.Mesh(trunkGeo, trunkMat);
        trunk.position.y = 0.5;
        group.add(trunk);

        const leaves = new THREE.Mesh(leafGeo, leafMat);
        leaves.position.y = 2.5;
        group.add(leaves);

        this.scene.add(group);
    }

    spawnPlayer(heroType) {
        this.player = new Player(this.scene, heroType, this);
        // Start player at bottom of lane
        this.player.mesh.position.set(0, 1, 40);
        // Add to entities so enemies can target player
        this.entities.push(this.player);
    }

    spawnDummy() {
        const dummy = new Dummy(this.scene, new THREE.Vector3(0, 0, 0), this); // Center
        this.entities.push(dummy);
    }

    spawnTowers() {
        // Enemy Tower
        const enemyTower = new Tower(this.scene, 'red', new THREE.Vector3(0, 0, -30), this);
        this.entities.push(enemyTower);

        // Ally Tower
        const allyTower = new Tower(this.scene, 'blue', new THREE.Vector3(0, 0, 30), this);
        this.entities.push(allyTower);
    }

    spawnMinionWave() {
        // Spawn Blue Minions
        for (let i = 0; i < 3; i++) {
            const offset = (i - 1) * 2;
            const minion = new Minion(
                this.scene, 
                'blue', 
                new THREE.Vector3(offset, 0, 35), // Spawn near ally tower
                [new THREE.Vector3(offset, 0, -40)], // Move to enemy base
                this
            );
            this.entities.push(minion);
        }
        // Add Blue Mage
        const blueMage = new Minion(
            this.scene,
            'blue',
            new THREE.Vector3(0, 0, 37), // Slightly behind
            [new THREE.Vector3(0, 0, -40)],
            this,
            'mage'
        );
        this.entities.push(blueMage);

        // Spawn Red Minions
        for (let i = 0; i < 3; i++) {
            const offset = (i - 1) * 2;
            const minion = new Minion(
                this.scene, 
                'red', 
                new THREE.Vector3(offset, 0, -35), // Spawn near enemy tower
                [new THREE.Vector3(offset, 0, 40)], // Move to ally base
                this
            );
            this.entities.push(minion);
        }
        // Add Red Mage
        const redMage = new Minion(
            this.scene,
            'red',
            new THREE.Vector3(0, 0, -37), // Slightly behind
            [new THREE.Vector3(0, 0, 40)],
            this,
            'mage'
        );
        this.entities.push(redMage);
    }

    setupInputs() {
        window.addEventListener('pointerdown', (event) => this.onMouseClick(event));
        window.addEventListener('pointermove', (event) => this.onMouseMove(event));
        // Prevent context menu on right click
        window.addEventListener('contextmenu', (e) => e.preventDefault());
        
        // Keyboard
        window.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.togglePause();
            }
            if (e.key.toLowerCase() === 'a') {
                if (!this.isPaused && this.player) {
                    this.awaitingAttackMove = true;
                    document.body.style.cursor = 'crosshair'; // Visual indicator
                    if (this.player.rangeIndicator) this.player.rangeIndicator.visible = true;
                }
            }
            if (e.key.toLowerCase() === 'q') {
                if (!this.isPaused && this.player) {
                    this.player.castAbility('q', this.getMouseWorldPosition());
                }
            }
            if (e.key.toLowerCase() === 'w') {
                if (!this.isPaused && this.player) {
                    this.player.castAbility('w', this.getMouseWorldPosition());
                }
            }
            if (e.key.toLowerCase() === 'f') {
                if (!this.isPaused && this.player) {
                    this.player.startRecall();
                }
            }
            if (e.key.toLowerCase() === 'v') {
                // Debug: Instant Victory
                this.checkGameOver('red');
            }
        });

        this.setupMobileControls();
    }

    setupMobileControls() {
        // Joystick logic
        const joystick = document.getElementById('joystick-thumb');
        const base = document.getElementById('joystick-base');
        let dragging = false;
        let startX = 0, startY = 0, moveX = 0, moveY = 0;
        let joyVec = { x: 0, y: 0 };

        function getRelative(e, base) {
            const rect = base.getBoundingClientRect();
            let x, y;
            if (e.touches) {
                x = e.touches[0].clientX - rect.left;
                y = e.touches[0].clientY - rect.top;
            } else {
                x = e.clientX - rect.left;
                y = e.clientY - rect.top;
            }
            return { x, y };
        }

        base.addEventListener('touchstart', function(e) {
            dragging = true;
            const pos = getRelative(e, base);
            startX = pos.x;
            startY = pos.y;
            moveX = startX;
            moveY = startY;
            joystick.style.left = `${(moveX / base.offsetWidth) * 100}%`;
            joystick.style.top = `${(moveY / base.offsetHeight) * 100}%`;
            joystick.style.transition = 'none';
            e.preventDefault();
        }, { passive: false });
        base.addEventListener('touchmove', function(e) {
            if (!dragging) return;
            const pos = getRelative(e, base);
            moveX = pos.x;
            moveY = pos.y;
            // Clamp to circle
            const dx = moveX - startX;
            const dy = moveY - startY;
            const maxDist = base.offsetWidth * 0.45;
            let dist = Math.sqrt(dx*dx + dy*dy);
            if (dist > maxDist) {
                moveX = startX + dx * (maxDist / dist);
                moveY = startY + dy * (maxDist / dist);
                dist = maxDist;
            }
            joystick.style.left = `${(moveX / base.offsetWidth) * 100}%`;
            joystick.style.top = `${(moveY / base.offsetHeight) * 100}%`;
            // Normalize to [-1,1]
            joyVec.x = (moveX - startX) / maxDist;
            joyVec.y = (moveY - startY) / maxDist;
            e.preventDefault();
        }, { passive: false });
        base.addEventListener('touchend', function(e) {
            dragging = false;
            joystick.style.left = '50%';
            joystick.style.top = '50%';
            joystick.style.transition = '0.2s';
            joyVec.x = 0;
            joyVec.y = 0;
            e.preventDefault();
        }, { passive: false });

        // Fire button logic
        const fireBtn = document.getElementById('fire-btn');
        fireBtn.addEventListener('touchstart', () => {
            this.input.isMouseDown = true;
        });
        fireBtn.addEventListener('touchend', () => {
            this.input.isMouseDown = false;
        });

        // Skill buttons logic
        const skillBtn1 = document.getElementById('skill-btn-1');
        const skillBtn2 = document.getElementById('skill-btn-2');
        if (skillBtn1) {
            skillBtn1.addEventListener('touchstart', () => {
                this.input.isSkill1Down = true;
            });
            skillBtn1.addEventListener('touchend', () => {
                this.input.isSkill1Down = false;
            });
        }
        if (skillBtn2) {
            skillBtn2.addEventListener('touchstart', () => {
                this.input.isSkill2Down = true;
            });
            skillBtn2.addEventListener('touchend', () => {
                this.input.isSkill2Down = false;
            });
        }

        // Ensure input object exists
        if (!this.input) this.input = {};
        if (typeof this.input.getMoveDirection !== 'function') {
            this.input.getMoveDirection = () => ({x:0, y:0});
        }

        // Override getMoveDirection for mobile
        const origGetMove = typeof this.input.getMoveDirection === 'function' ? this.input.getMoveDirection.bind(this.input) : () => ({x:0,y:0});
        this.input.getMoveDirection = () => {
            if (window.innerWidth < 900 && (dragging || joyVec.x !== 0 || joyVec.y !== 0)) {
                // Use joystick
                return { x: joyVec.x, y: joyVec.y };
            }
            return origGetMove();
        };
    }

    onMouseMove(event) {
        // Keep mouse vector updated
        this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    }

    getMouseWorldPosition() {
        this.raycaster.setFromCamera(this.mouse, this.camera);
        const intersects = this.raycaster.intersectObject(this.plane);
        if (intersects.length > 0) {
            return intersects[0].point;
        }
        return null;
    }

    togglePause() {
        this.isPaused = !this.isPaused;
        const menu = document.getElementById('pause-menu');
        if (this.isPaused) {
            menu.style.display = 'flex';
            this.clock.stop(); // Stop time
            
            // Update Pause Stats
            if (this.stats) {
                document.getElementById('pause-stat-kills').textContent = this.stats.kills;
                document.getElementById('pause-stat-deaths').textContent = this.stats.deaths;
                document.getElementById('pause-stat-cs').textContent = this.stats.cs;
                document.getElementById('pause-stat-towers').textContent = this.stats.towers;
                document.getElementById('pause-stat-dmg-done').textContent = Math.round(this.stats.damageDone);
                document.getElementById('pause-stat-dmg-taken').textContent = Math.round(this.stats.damageTaken);
            }
            if (this.player) {
                document.getElementById('pause-stat-gold').textContent = this.player.gold;
            }
        } else {
            menu.style.display = 'none';
            this.clock.start(); // Resume time
        }
    }

    onMouseClick(event) {
        if (!this.player || this.isPaused) return;

        // Calculate mouse position in normalized device coordinates (-1 to +1)
        this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

        this.raycaster.setFromCamera(this.mouse, this.camera);

        // Check for entity clicks first
        const interactableObjects = this.entities.map(e => e.mesh).filter(m => m);
        const entityIntersects = this.raycaster.intersectObjects(interactableObjects);

        // Handle Attack Move (Left Click)
        if (this.awaitingAttackMove && event.button === 0) {
            this.awaitingAttackMove = false;
            document.body.style.cursor = 'default';
            if (this.player.rangeIndicator) this.player.rangeIndicator.visible = false;

            // If we clicked an entity, attack it directly
            if (entityIntersects.length > 0) {
                const targetMesh = entityIntersects[0].object;
                let current = targetMesh;
                while(current && !current.userData.entity) current = current.parent;
                
                if (current && current.userData.entity) {
                    const target = current.userData.entity;
                    // Prevent attacking friendly units
                    if (target.team === this.player.team) {
                        console.log("Cannot attack friendly unit!");
                        return;
                    }
                    this.player.attack(target);
                    this.createClickEffect(current.position, 0xff0000);
                    return;
                }
            }

            // Otherwise, Attack Move to ground
            const intersects = this.raycaster.intersectObject(this.plane);
            if (intersects.length > 0) {
                const point = intersects[0].point;
                this.player.attackMove(point);
                this.createClickEffect(point, 0xff4500); // Orange for Attack Move
            }
            return;
        }
        
        // Cancel Attack Move if we do something else (like Right Click)
        if (this.awaitingAttackMove) {
            this.awaitingAttackMove = false;
            document.body.style.cursor = 'default';
            if (this.player.rangeIndicator) this.player.rangeIndicator.visible = false;
        }

        if (entityIntersects.length > 0) {
            const targetMesh = entityIntersects[0].object;
            // Traverse up to find the mesh with userData (in case we hit a child part)
            let current = targetMesh;
            while(current && !current.userData.entity) {
                current = current.parent;
            }

            if (current && current.userData.entity) {
                const targetEntity = current.userData.entity;
                if (event.button === 2) { // Right click
                    // Prevent attacking friendly units
                    if (targetEntity.team === this.player.team) {
                        console.log("Cannot attack friendly unit!");
                        // If friendly, maybe just move there?
                        // For now, just return to prevent attack.
                        // Or better: treat as move command to that location
                        const point = current.position.clone();
                        point.y = 0;
                        this.player.moveTo(point);
                        this.createClickEffect(point, 0x00ff00);
                        return;
                    }

                    console.log("Attacking target:", targetEntity);
                    this.player.attack(targetEntity);
                    // Visual feedback
                    this.createClickEffect(current.position, 0xff0000);
                    return; // Don't move to ground if we clicked an entity
                }
            }
        }

        // Ground click
        const intersects = this.raycaster.intersectObject(this.plane);

        if (intersects.length > 0) {
            const point = intersects[0].point;
            // Right click to move (standard MOBA)
            if (event.button === 2) {
                this.player.moveTo(point);
                this.createClickEffect(point, 0x00ff00);
            }
        }
    }

    createClickEffect(point, color) {
        // Simple visual marker for click
        const geometry = new THREE.RingGeometry(0.2, 0.3, 32);
        const material = new THREE.MeshBasicMaterial({ color: color, side: THREE.DoubleSide, transparent: true });
        const ring = new THREE.Mesh(geometry, material);
        ring.position.copy(point);
        ring.position.y += 0.05; // Slightly above ground
        ring.rotation.x = -Math.PI / 2;
        this.scene.add(ring);

        // Animate and remove
        let scale = 1;
        const animateRing = () => {
            scale -= 0.05;
            ring.scale.set(scale, scale, scale);
            if (scale <= 0) {
                this.scene.remove(ring);
            } else {
                requestAnimationFrame(animateRing);
            }
        };
        animateRing();
    }

    animate() {
        if (!this.isRunning) return;

        requestAnimationFrame(() => this.animate());

        if (this.isPaused) return;

        let dt = this.clock.getDelta();
        // Cap dt to prevent huge jumps after pause/lag
        if (dt > 0.1) dt = 0.1;

        const elapsedTime = this.clock.getElapsedTime();

        // Spawn Minions every 30s (or 10s for testing)
        if (elapsedTime - this.lastWaveTime > 10) {
            this.spawnMinionWave();
            this.lastWaveTime = elapsedTime;
            console.log("Minion Wave Spawned!");
        }

        if (this.player) {
            // Pass entities to player for Attack Move scanning
            // Note: Player is now in entities list, so we don't need to update it manually if we iterate entities.
            // BUT, we need camera follow logic.
            // Let's just update player manually and skip it in the loop below to ensure order/camera sync.
            this.player.update(dt, this.entities);
            
            // Camera follow player
            this.camera.position.x = this.player.mesh.position.x + 20;
            this.camera.position.z = this.player.mesh.position.z + 20;
            this.camera.lookAt(this.player.mesh.position);

            // Update Skill UI
            if (this.player.abilities) {
                const q = this.player.abilities.q;
                const w = this.player.abilities.w;
                
                const qOverlay = document.querySelector('#skill-q .skill-cooldown-overlay');
                const qTimer = document.getElementById('timer-q');
                if (qOverlay) {
                    const pct = (q.cooldown / q.maxCooldown) * 100;
                    qOverlay.style.height = `${pct}%`;
                }
                if (qTimer) {
                    qTimer.textContent = (this.showCooldownNumbers && q.cooldown > 0) ? Math.ceil(q.cooldown) : '';
                }

                const wOverlay = document.querySelector('#skill-w .skill-cooldown-overlay');
                const wTimer = document.getElementById('timer-w');
                if (wOverlay) {
                    const pct = (w.cooldown / w.maxCooldown) * 100;
                    wOverlay.style.height = `${pct}%`;
                }
                if (wTimer) {
                    wTimer.textContent = (this.showCooldownNumbers && w.cooldown > 0) ? Math.ceil(w.cooldown) : '';
                }

                // Low Mana Indicators
                const qLowMana = document.querySelector('#skill-q .skill-low-mana');
                if (qLowMana) {
                    qLowMana.style.display = (this.player.mana < q.manaCost) ? 'block' : 'none';
                }
                const wLowMana = document.querySelector('#skill-w .skill-low-mana');
                if (wLowMana) {
                    wLowMana.style.display = (this.player.mana < w.manaCost) ? 'block' : 'none';
                }
            }
        }

        // Update Entities
        for (let i = 0; i < this.entities.length; i++) {
            const entity = this.entities[i];
            if (entity.isDead) {
                // Create explosion effect
                if (entity.mesh) {
                    let color = 0xffffff; // Default white
                    if (entity.mesh.material && entity.mesh.material.color) {
                        color = entity.mesh.material.color;
                    } else if (entity.team === 'blue') {
                        color = 0x4444ff;
                    } else if (entity.team === 'red') {
                        color = 0xff4444;
                    }
                    this.explosionManager.spawn(entity.mesh.position, color);
                }
                // Clean up dead entities from array
                this.entities.splice(i, 1);
                i--;
            } else {
                // Skip player update here since we did it above
                if (entity === this.player) continue;

                // Pass enemies list to towers/minions if they need it
                // For now, just pass all entities, they can filter
                if (entity.update) entity.update(dt, this.entities);
            }
        }

        this.floatingText.update(dt, this.camera);
        this.explosionManager.update(dt);

        this.renderer.render(this.scene, this.camera);
    }
}