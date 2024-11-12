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
window.renderer = renderer
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 2.0; // Adjust exposure as needed
renderer.outputEncoding = THREE.sRGBEncoding;
document.body.appendChild(renderer.domElement);

// Add OrbitControls to allow camera rotation around the model
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true; // Smooth the controls
controls.dampingFactor = 0.05;

async function getTextureNamesFromGLB() {
  const textureNames = new Set(); // Use a Set to avoid duplicates

  // Load the GLB file and retrieve texture names
  const gltfLoader = new GLTFLoader();
  await new Promise((resolve, reject) => {
    gltfLoader.load('/tes-light-mapper.glb', (gltf) => {
      gltf.scene.traverse((child) => {
        if (child.isMesh && child.userData.atlasName) {
          textureNames.add(child.userData.atlasName);
        }
      });
      resolve();
    }, undefined, reject);
  });

  return Array.from(textureNames); // Convert Set to Array
}

async function preloadTextures(textureNames) {
  const textureLoader = new RGBELoader(); // If you are loading HDR textures
  const textureMap = new Map();

  const loadPromises = textureNames.map((name) =>
    new Promise((resolve, reject) => {
      const texturePath = `/hdr/${name}_filtered.hdr`;
      console.log('Texture Path:', texturePath); // Log texture path

      textureLoader.load(
        texturePath,
        (texture) => {
          texture.flipY = false;
          texture.channel = 1;
          textureMap.set(name, texture);
          console.log(`Loaded texture: ${name}`); // Log successful texture load
          resolve();
        },
        undefined,
        (error) => {
          console.error(`Failed to load texture: ${texturePath}`, error);
          reject(error); // Reject the promise on error
        }
      );
    })
  );

  try {
    await Promise.all(loadPromises);
  } catch (error) {
    console.error('Some textures failed to load:', error);
  }

  return textureMap;
}

async function loadModelWithTextures() {
  const textureNames = await getTextureNamesFromGLB();
  const textureMap = await preloadTextures(textureNames);

  // Now load the GLB file again to apply textures
  const gltfLoader = new GLTFLoader();
  gltfLoader.load('/tes-light-mapper.glb', (gltf) => {
    const model = gltf.scene;
    model.traverse((child) => {
      if (child.isMesh) {
        const textureName = child.userData.atlasName;
        console.log('Texture Name:', textureName); // Log texture name

        const texture = textureMap.get(textureName);
        if (texture) {
          // If texture exists, apply the texture to the mesh and use white material with lightmap
          console.log(`Applied texture: ${textureName}`); // Log texture application
          const whiteMaterialWithLightmap = new THREE.MeshStandardMaterial({
            color: 0xffffff,  // Set to white color
            lightMap: texture,  // Attach the texture as a lightmap
            lightMapIntensity: 1.0  // Optional: Adjust the intensity of the lightmap
          });

          child.material = whiteMaterialWithLightmap; // Replace material with the new one
        } else {
          // If texture is not found, replace the existing material with a white material
          console.warn(`Texture not found for ${textureName}, replacing with white material.`);
          child.material = new THREE.MeshStandardMaterial({ color: 0xffffff }); // Replace material with white
        }
      }
    });

    scene.add(model);
  });
}

loadModelWithTextures();



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
