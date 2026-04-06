// static/js/three-bg.js
document.addEventListener("DOMContentLoaded", () => {
    const container = document.getElementById('three-container');
    if (!container || typeof THREE === 'undefined') return;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.z = 200;

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);

    const getWidth = () => container.clientWidth || window.innerWidth;
    const getHeight = () => container.clientHeight || 600;

    renderer.setSize(getWidth(), getHeight());
    container.appendChild(renderer.domElement);

    // Particles - Cyan tech vibe
    const particleCount = window.innerWidth < 768 ? 120 : 300;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const velocities = [];
    const range = 400;

    for (let i = 0; i < particleCount; i++) {
        positions[i * 3] = (Math.random() - 0.5) * range;
        positions[i * 3 + 1] = (Math.random() - 0.5) * range;
        positions[i * 3 + 2] = (Math.random() - 0.5) * range;

        velocities.push({
            x: (Math.random() - 0.5) * 0.15,
            y: (Math.random() - 0.5) * 0.15,
            z: (Math.random() - 0.5) * 0.15
        });
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    // Cyan particle material
    const material = new THREE.PointsMaterial({
        color: 0x00d4ff,
        size: 2,
        transparent: true,
        opacity: 0.6
    });

    const particles = new THREE.Points(geometry, material);
    scene.add(particles);

    // Connection lines - subtle cyan
    const lineMaterial = new THREE.LineBasicMaterial({
        color: 0x00d4ff,
        transparent: true,
        opacity: 0.12
    });

    const lineGeometry = new THREE.BufferGeometry();
    const lineMesh = new THREE.LineSegments(lineGeometry, lineMaterial);
    scene.add(lineMesh);

    // Mouse interaction
    let mouseX = 0;
    let mouseY = 0;

    const windowHalfX = window.innerWidth / 2;
    const windowHalfY = window.innerHeight / 2;

    document.addEventListener('mousemove', (event) => {
        mouseX = (event.clientX - windowHalfX) * 0.03;
        mouseY = (event.clientY - windowHalfY) * 0.03;
    });

    function animate() {
        requestAnimationFrame(animate);

        const positions = particles.geometry.attributes.position.array;
        let linePositions = [];

        for (let i = 0; i < particleCount; i++) {
            positions[i * 3] += velocities[i].x;
            positions[i * 3 + 1] += velocities[i].y;
            positions[i * 3 + 2] += velocities[i].z;

            if (Math.abs(positions[i * 3]) > range / 2) velocities[i].x *= -1;
            if (Math.abs(positions[i * 3 + 1]) > range / 2) velocities[i].y *= -1;
            if (Math.abs(positions[i * 3 + 2]) > range / 2) velocities[i].z *= -1;

            for (let j = i + 1; j < particleCount; j++) {
                const dx = positions[i * 3] - positions[j * 3];
                const dy = positions[i * 3 + 1] - positions[j * 3 + 1];
                const dz = positions[i * 3 + 2] - positions[j * 3 + 2];
                const distSq = dx * dx + dy * dy + dz * dz;

                if (distSq < 2000) {
                    linePositions.push(
                        positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2],
                        positions[j * 3], positions[j * 3 + 1], positions[j * 3 + 2]
                    );
                }
            }
        }

        particles.geometry.attributes.position.needsUpdate = true;
        lineMesh.geometry.setAttribute('position', new THREE.Float32BufferAttribute(linePositions, 3));

        camera.position.x += (mouseX - camera.position.x) * 0.02;
        camera.position.y += (-mouseY - camera.position.y) * 0.02;
        camera.lookAt(scene.position);

        renderer.render(scene, camera);
    }

    animate();

    window.addEventListener('resize', () => {
        camera.aspect = getWidth() / getHeight();
        camera.updateProjectionMatrix();
        renderer.setSize(getWidth(), getHeight());
    });
});
