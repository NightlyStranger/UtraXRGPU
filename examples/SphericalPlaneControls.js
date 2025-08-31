// SphericalPlaneControls.js
import * as THREE from 'three';

export class SphericalPlaneControls {
    constructor(plane, options = {}) {
        this.plane = plane; // THREE.Plane
        this.center = options.center || new THREE.Vector3(0, 0, 0);
        this.radius = options.radius || 3;
        this.phi = options.phi || Math.PI / 4;     // vertical angle
        this.theta = options.theta || Math.PI / 4; // horizontal angle

        this.speed = options.speed || 0.02;       // angular speed
        this.radiusStep = options.radiusStep || 0.1;

        this.keys = {};
        window.addEventListener("keydown", e => this.keys[e.code] = true);
        window.addEventListener("keyup", e => this.keys[e.code] = false);

        this.updatePlane();
    }

    update(delta = 1) {
        // Move along sphere
        if (this.keys["KeyW"]) this.phi -= this.speed * delta;
        if (this.keys["KeyS"]) this.phi += this.speed * delta;
        if (this.keys["KeyA"]) this.theta -= this.speed * delta;
        if (this.keys["KeyD"]) this.theta += this.speed * delta;

        // Wrap theta to allow continuous rotation
        this.theta = this.theta % (Math.PI * 2);

        // Optional epsilon to prevent exact singularities at poles
        const epsilon = 0.0001;
        this.phi = Math.max(epsilon, Math.min(Math.PI - epsilon, this.phi));

        // Change radius
        if (this.keys["KeyF"]) this.radius += this.radiusStep * delta;
        if (this.keys["KeyG"]) this.radius = Math.max(0, this.radius - this.radiusStep * delta); // min 0

        this.updatePlane();
    }

    updatePlane() {
        // Spherical to Cartesian
        const sinPhi = Math.sin(this.phi);
        const pos = new THREE.Vector3(
            this.center.x + this.radius * sinPhi * Math.sin(this.theta),
            this.center.y + this.radius * Math.cos(this.phi),
            this.center.z + this.radius * sinPhi * Math.cos(this.theta)
        );

        // Plane normal points away from sphere center
        const normal = new THREE.Vector3().subVectors(pos, this.center).normalize();
        this.plane.normal.copy(normal);
        this.plane.constant = -normal.dot(pos);
    }

    getPosition() {
        // Return current position of the plane in 3D space
        return new THREE.Vector3().copy(this.plane.normal).multiplyScalar(this.radius).add(this.center);
    }
}
