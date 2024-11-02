import * as THREE from 'three';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';

// Set up the scene
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.z = 5;

// Set up the renderer
const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0; // Adjust exposure as needed
renderer.outputEncoding = THREE.sRGBEncoding;
document.body.appendChild(renderer.domElement);

// Add OrbitControls to allow camera rotation around the model
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true; // Smooth the controls
controls.dampingFactor = 0.05;

// Load HDR lightmap
const rgbeLoader = new RGBELoader();
rgbeLoader.load('/hdr/Collection_filtered.hdr', (texture) => {
  texture.flipY = false,
  texture.channel = 1
  const gltfLoader = new GLTFLoader();
  gltfLoader.load('/tes-light-mapper.glb', (gltf) => {
    const model = gltf.scene;
    model.traverse((child) => {
      if (child.isMesh) {
          child.material.lightMap = texture; 
          child.material.lightMapIntensity = 1.0;
      }
    });

    scene.add(model);
  });
});

// Render loop
function animate() {
  requestAnimationFrame(animate);
  controls.update(); // Update the orbit controls
  renderer.render(scene, camera);
}
animate();

// Handle window resize
window.addEventListener('resize', () => {
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
});
