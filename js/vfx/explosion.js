import * as THREE from '../lib/three.module.js';

export class ExplosionManager {
    constructor(scene) {
        this.scene = scene;
        this.particles = [];
    }

    spawn(position, color, count = 8) {
        const geometry = new THREE.BoxGeometry(0.3, 0.3, 0.3);
        const material = new THREE.MeshBasicMaterial({ color: color });

        for (let i = 0; i < count; i++) {
            const mesh = new THREE.Mesh(geometry, material);
            mesh.position.copy(position);
            
            // Random spread
            mesh.position.x += (Math.random() - 0.5) * 0.5;
            mesh.position.y += (Math.random() - 0.5) * 0.5;
            mesh.position.z += (Math.random() - 0.5) * 0.5;

            // Random velocity
            const velocity = new THREE.Vector3(
                (Math.random() - 0.5) * 10,
                (Math.random() * 5) + 2, // Upward bias
                (Math.random() - 0.5) * 10
            );

            this.scene.add(mesh);
            this.particles.push({ mesh, velocity, life: 1.0 });
        }
    }

    update(dt) {
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.life -= dt;

            if (p.life <= 0) {
                this.scene.remove(p.mesh);
                this.particles.splice(i, 1);
                continue;
            }

            // Physics
            p.velocity.y -= 20 * dt; // Gravity
            p.mesh.position.add(p.velocity.clone().multiplyScalar(dt));
            p.mesh.rotation.x += p.velocity.z * dt;
            p.mesh.rotation.z -= p.velocity.x * dt;
            
            // Scale down
            const scale = p.life;
            p.mesh.scale.set(scale, scale, scale);
        }
    }
}
