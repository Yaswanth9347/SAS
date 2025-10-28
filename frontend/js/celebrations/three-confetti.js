// three-confetti.js
// 3D confetti celebration using three.js, adapted to mount within a given container
// Exports: runThreeConfetti(containerEl: HTMLElement, durationMs: number): Promise<void>

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export function runThreeConfetti(containerEl, durationMs = 4000) {
  return new Promise((resolve) => {
    if (!containerEl) return resolve();

    // Setup sizes
    const getSize = () => {
      const rect = containerEl.getBoundingClientRect();
      return {
        width: Math.max(1, rect.width),
        height: Math.max(1, rect.height),
      };
    };
    let { width, height } = getSize();

    // Scene basics
    const scene = new THREE.Scene();
    const worldRadius = 5;

    const camera = new THREE.PerspectiveCamera(35, width / height, 1, worldRadius * 3);
    camera.position.z = worldRadius * Math.SQRT2;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(width, height);

    // Mount canvas inside the container
    containerEl.appendChild(renderer.domElement);

    // Controls (auto-rotate only)
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.y = 0.5;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 2;
    controls.enableDamping = true;
    controls.enablePan = false;
    controls.enableZoom = false;
    controls.update();

    // Confetti parameters
    const confettiSize = 0.07;
    const confettiNum = 1000; // reduced from 3000 for performance
    const rotateRangeX = Math.PI / 30;
    const rotateRangeY = Math.PI / 50;
    const speedY = 0.01;
    const speedX = 0.003;
    const speedZ = 0.005;

    // Geometry & material (instanced)
    const geo = new THREE.PlaneGeometry(confettiSize / 2, confettiSize);
    const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide });
    const mesh = new THREE.InstancedMesh(geo, mat, confettiNum);
    scene.add(mesh);

    const dummy = new THREE.Object3D();
    const matrix = new THREE.Matrix4();
    const color = new THREE.Color();

    function getRandomColor() {
      const saturation = 100;
      const lightness = 50;
      const colors = [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map(
        (h) => `hsl(${h}, ${saturation}%, ${lightness}%)`
      );
      return colors[(Math.random() * colors.length) | 0];
    }

    // Initialize random transforms/colors
    for (let i = 0; i < confettiNum; i++) {
      matrix.makeRotationFromEuler(
        new THREE.Euler(
          Math.random() * Math.PI,
          Math.random() * Math.PI,
          Math.random() * Math.PI
        )
      );
      matrix.setPosition(
        THREE.MathUtils.randFloat(-worldRadius, worldRadius),
        THREE.MathUtils.randFloat(-worldRadius, worldRadius),
        THREE.MathUtils.randFloat(-worldRadius, worldRadius)
      );
      mesh.setMatrixAt(i, matrix);
      mesh.setColorAt(i, color.set(getRandomColor()));
    }
    mesh.instanceMatrix.needsUpdate = true;

    let rafId;
    const start = performance.now();

    function animate(now) {
      controls.update();

      // Update instances
      for (let i = 0; i < confettiNum; i++) {
        mesh.getMatrixAt(i, matrix);
        matrix.decompose(dummy.position, dummy.quaternion, dummy.scale);

        // Fall speed (vary by index for randomness)
        dummy.position.y -= speedY * ((i % 4) + 1);
        if (dummy.position.y < -worldRadius) {
          dummy.position.y = worldRadius;
          dummy.position.x = THREE.MathUtils.randFloat(-worldRadius, worldRadius);
          dummy.position.z = THREE.MathUtils.randFloat(-worldRadius, worldRadius);
        } else {
          // Horizontal drift
          const idx = i % 4;
          dummy.position.x += idx < 2 ? speedX : -speedX;
          dummy.position.z += idx % 2 === 0 ? speedZ : -speedZ;
        }

        // Rotation wobble
        dummy.rotation.x += THREE.MathUtils.randFloat(0, rotateRangeX);
        dummy.rotation.z += THREE.MathUtils.randFloat(0, rotateRangeY);

        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
      }
      mesh.instanceMatrix.needsUpdate = true;

      renderer.render(scene, camera);

      const elapsed = now - start;
      if (elapsed >= durationMs) {
        cleanup();
        return resolve();
      }
      rafId = requestAnimationFrame(animate);
    }

    function onResize() {
      const size = getSize();
      width = size.width; height = size.height;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    }

    function cleanup() {
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', onResize);
      controls.dispose();
      geo.dispose();
      mat.dispose();
      if (renderer) {
        renderer.dispose?.();
        if (renderer.domElement && renderer.domElement.parentNode === containerEl) {
          containerEl.removeChild(renderer.domElement);
        }
      }
    }

    window.addEventListener('resize', onResize);
    rafId = requestAnimationFrame(animate);
  });
}
