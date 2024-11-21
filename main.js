import * as THREE from 'three';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { EffectComposer, RenderPass, ShaderPass } from 'three/examples/jsm/Addons.js';

const contrastShader = {
  uniforms: {
      tDiffuse: { value: null },
      contrast: { value: 1.5 } // Adjust this value for more contrast
  },
  vertexShader: `
      varying vec2 vUv;
      void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
  `,
  fragmentShader: `
      uniform sampler2D tDiffuse;
      uniform float contrast;
      varying vec2 vUv;
      void main() {
          vec4 color = texture2D(tDiffuse, vUv);
          color.rgb = (color.rgb - 0.5) * contrast + 0.5; // Adjust contrast
          gl_FragColor = color;
      }
  `
};



function addLighting(scene) {
  // Ambient Light
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.5); // Soft white light
  scene.add(ambientLight);

  // Directional Light
  const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
  directionalLight.position.set(5, 10, 7.5); // Position the light
  directionalLight.castShadow = true; // Enable shadows
  directionalLight.shadow.mapSize.width = 1024; // Shadow resolution
  directionalLight.shadow.mapSize.height = 1024;

  scene.add(directionalLight);

  // Optional: Add a helper to visualize the light's direction
  const directionalLightHelper = new THREE.DirectionalLightHelper(directionalLight, 1);
  scene.add(directionalLightHelper);

  // Point Light
  const pointLight = new THREE.PointLight(0xffcc77, 1, 50); // Warm light
  pointLight.position.set(-5, 5, 5); // Position the light
  scene.add(pointLight);

  // Optional: Add a helper to visualize the point light
  const pointLightHelper = new THREE.PointLightHelper(pointLight, 0.5);
  scene.add(pointLightHelper);
}

// Set up the scene
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.z = 5;

// Set up the renderer
const renderer = new THREE.WebGLRenderer({ antialias: true });;
window.renderer = renderer
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.5; // Adjust exposure as needed
renderer.outputEncoding = THREE.sRGBEncoding;
document.body.appendChild(renderer.domElement);

const composer = new EffectComposer(renderer);

const contrastPass = new ShaderPass({
  uniforms: {
      tDiffuse: { value: null },
      contrast: { value: 10 } // Adjust this value
  },
  vertexShader: contrastShader.vertexShader,
  fragmentShader: contrastShader.fragmentShader
});
composer.addPass(contrastPass);
composer.addPass(new RenderPass(scene, camera));
addLighting(scene)

// Add OrbitControls to allow camera rotation around the model
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true; // Smooth the controls
controls.dampingFactor = 0.05;

async function getTextureNamesFromGLB() {
  const textureNames = new Set(); // Use a Set to avoid duplicates

  // Load the GLB file and retrieve texture names
  const gltfLoader = new GLTFLoader();
  await new Promise((resolve, reject) => {
    gltfLoader.load('/tes-light-mapper4.glb', (gltf) => {
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

let envMap = null
const rgbeLoader = new RGBELoader();
rgbeLoader.load(
  '/env.hdr', // Replace with your HDRI file path
  (texture) => {
    texture.mapping = THREE.EquirectangularReflectionMapping;

    // Rotate HDRI by 90 degrees along the Y-axis
    const rotationMatrix = new THREE.Matrix4().makeRotationY(THREE.MathUtils.degToRad(90));
    texture.matrixAutoUpdate = false; // Disable automatic updates to preserve the transformation
    texture.matrix = rotationMatrix;

    // Apply HDRI as environment and optionally as background
    // scene.environment = texture;
    envMap = texture
    scene.background = texture;

    console.log('HDRI applied successfully with 90° Y-axis rotation');
  }
)

async function preloadTextures(textureNames) {
  const textureLoader = new RGBELoader(); // If you are loading HDR textures
  const textureMap = new Map();

  const loadPromises = textureNames.map((name) =>
    new Promise((resolve, reject) => {
      const texturePath = `/Lightmaps/${name}`;
      console.log('Texture Path:', texturePath); // Log texture path

      textureLoader.load(
        texturePath,
        (texture) => {
          texture.flipY = false;
          texture.channel = 2;
          textureMap.set(name, texture);
          console.log(`Loaded texture: ${name}`); // Log successful texture load
          updateCubeCamera()
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
    await Promise.all(loadPromises); // Wait for all textures to load in parallel
  } catch (error) {
    console.error('Some textures failed to load:', error);
  }

  return textureMap;
}

async function loadModelWithTextures() {
  const textureNames = await getTextureNamesFromGLB();
  const textureMap = await preloadTextures(textureNames);

  // Load the GLB file to apply textures
  const gltfLoader = new GLTFLoader();
  gltfLoader.load('/tes-light-mapper4.glb', (gltf) => {
    const model = gltf.scene;
    model.traverse((child) => {
      if (child.isMesh) {
        const textureName = child.userData.atlasName;
        console.log('Texture Name:', textureName); // Log texture name

        const texture = textureMap.get(textureName);
        if (texture) {
          // If texture exists, apply it as a diffuse map
          console.log(`Applied texture: ${textureName}`); // Log texture application
          child.material.map = texture;
          child.material.lightMap = texture;
          child.material.envMapIntensity = 0

        } else {
          // If texture is not found, use a default diffuse material
          console.warn(`Texture not found for ${textureName}, applying default white diffuse material.`);
          // child.material = new THREE.MeshStandardMaterial({
          //   // color: 0xffffff,
          //   roughness: 1.0,
          //   metalness: 0.0,
          // });
        }
      }
    });
    
    scene.add(model); // Add the model to the scene
  });
}
loadModelWithTextures();

let cubeCamera = null;

const envmapParsFragmentReplace = /* glsl */ `

    #ifdef USE_ENVMAP

    uniform float reflectivity;

    #if defined( USE_BUMPMAP ) || defined( USE_NORMALMAP ) || defined( PHONG )

        #define ENV_WORLDPOS

    #endif

    #ifdef ENV_WORLDPOS

        varying vec3 vWorldPosition;

        uniform float refractionRatio;

    #else

        varying vec3 vReflect;

    #endif

    #define BOX_PROJECTED_ENV_MAP

    #ifdef BOX_PROJECTED_ENV_MAP

    uniform vec3 cubeMapSize;

    uniform vec3 cubeMapPos;

    vec3 parallaxCorrectNormal( vec3 v, vec3 cubeSize, vec3 cubePos ) {

    vec3 nDir = normalize( v );

    vec3 rbmax = ( .5 * cubeSize + cubePos - vWorldPosition ) / nDir;

    vec3 rbmin = ( -.5 * cubeSize + cubePos - vWorldPosition ) / nDir;

    vec3 rbminmax;

    rbminmax.x = ( nDir.x > 0. ) ? rbmax.x : rbmin.x;

    rbminmax.y = ( nDir.y > 0. ) ? rbmax.y : rbmin.y;

    rbminmax.z = ( nDir.z > 0. ) ? rbmax.z : rbmin.z;

    float correction = min( min( rbminmax.x, rbminmax.y ), rbminmax.z );

    vec3 boxIntersection = vWorldPosition + nDir * correction;

    return boxIntersection - cubePos;

    }

    #endif

    #endif

`;



const envmapFragmentReplace = /* glsl */ `

    #ifdef USE_ENVMAP

    #ifdef ENV_WORLDPOS

        vec3 cameraToFrag;

        if ( isOrthographic ) {

            cameraToFrag = normalize( vec3( - viewMatrix[ 0 ][ 2 ], - viewMatrix[ 1 ][ 2 ], - viewMatrix[ 2 ][ 2 ] ) );

        } else {

            cameraToFrag = normalize( vWorldPosition - cameraPosition );

        }

        // Transforming Normal Vectors with the Inverse Transformation

        vec3 worldNormal = inverseTransformDirection( normal, viewMatrix );

        #ifdef ENVMAP_MODE_REFLECTION

            vec3 reflectVec = reflect( cameraToFrag, worldNormal );

        #else

            vec3 reflectVec = refract( cameraToFrag, worldNormal, refractionRatio );

        #endif

    #else

        vec3 reflectVec = vReflect;

    #endif

    #ifdef BOX_PROJECTED_ENV_MAP

    reflectVec = parallaxCorrectNormal( reflectVec, cubeMapSize, cubeMapPos );

    #endif

    #ifdef ENVMAP_TYPE_CUBE

        

        vec4 envColor = textureCube( envMap, vec3( flipEnvMap * reflectVec.x, reflectVec.yz ) );

        

    #elif defined( ENVMAP_TYPE_CUBE_UV )

        vec4 envColor = textureCubeUV( envMap, reflectVec, 0.0 );

    #else

        vec4 envColor = vec4( 0.0 );

    #endif

    #ifdef ENVMAP_BLENDING_MULTIPLY

      

      outgoingLight = mix( outgoingLight, outgoingLight * envColor.xyz, specularStrength * reflectivity );

    #elif defined( ENVMAP_BLENDING_MIX )

        

        outgoingLight = mix( outgoingLight, envColor.xyz, specularStrength * reflectivity );

    #elif defined( ENVMAP_BLENDING_ADD )

        

        outgoingLight += envColor.xyz * specularStrength * reflectivity;

    #endif

    #endif

`;

function updateCubeCamera() {

  cubeCamera.update(renderer, scene);

}

function addReflectionOnFloorUsingCubeCamera(floorMesh) {

  const cubeRenderTarget = new THREE.WebGLCubeRenderTarget(512, {

      generateMipmaps: true,

      minFilter: THREE.LinearMipMapLinearFilter,

  });

  cubeCamera = new THREE.CubeCamera(1, 1000, cubeRenderTarget);

  scene.add(cubeCamera);


  const boxProjectedMat = new THREE.MeshPhongMaterial({

      envMap: cubeRenderTarget.texture,

      reflectivity: 0.5,

      bumpScale: 0.1,

  });

  boxProjectedMat.onBeforeCompile = function (shader) {

      //these parameters are for the cubeCamera texture

      shader.uniforms.cubeMapSize = { value: new THREE.Vector3(5,5,5) };

      shader.uniforms.cubeMapPos = { value: new THREE.Vector3(-23, 7.5, 6) };

    

      shader.fragmentShader = shader.fragmentShader.replace(

        "#include <envmap_pars_fragment>",

        envmapParsFragmentReplace

      );

    

      shader.fragmentShader = shader.fragmentShader.replace(

        "#include <envmap_fragment>",

        envmapFragmentReplace

      );

  };

  boxProjectedMat.map = floorMesh.material.map;

  boxProjectedMat.lightMap = floorMesh.material.lightMap;

  floorMesh.material = boxProjectedMat;

  cubeCamera.position.set(-23, 7.5, 6);

  cubeCamera.updateMatrixWorld();

  updateCubeCamera();

}

const loader = new GLTFLoader();
loader.load(
  '/non_bake.glb', // Replace with your file path
  function (gltf) {
    // Successfully loaded
    const model = gltf.scene;
    scene.add(model);
    model.traverse((node) => {
      if (node.isMesh) {
        node.material.envMap = envMap;
        node.material.envMapIntensity = 0.01 ; // Adjust intensity as needed

      }
    });

    console.log('Model loaded successfully');
  },)

// loader.load(
//   '/floor.glb', // Replace with your file path
//   function (gltf) {
//     // Successfully loaded
//     const model = gltf.scene;
//     scene.add(model);
//     model.traverse((node) => {
//       if (node.isMesh) {
//         node.material.envMap = scene.environment;
//         node.material.envMapIntensity = 0.1 ;

//       }
//     });

//     console.log('Model loaded successfully');
//   },)
// Create the directional light
// const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
// directionalLight.position.set(5, 10, 7.5); // Position the light
// directionalLight.castShadow = true; // Enable shadows
// directionalLight.shadow.mapSize.width = 1024; // Shadow resolution
// directionalLight.shadow.mapSize.height = 1024;
// scene.add(directionalLight);

// // Create a red cube at the same position as the directional light
// const cubeGeometry = new THREE.BoxGeometry(1, 1, 1); // 1x1x1 cube size
// const cubeMaterial = new THREE.MeshStandardMaterial({ color: 0xff0000 }); // Red material
// const redCube = new THREE.Mesh(cubeGeometry, cubeMaterial);
// redCube.position.copy(directionalLight.position); // Set cube position to match the light
// scene.add(redCube);

// const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
// directionalLight.position.set(-23, 7.5, 6);
// const directionalLightHelper = new THREE.DirectionalLightHelper(directionalLight, 1);
// scene.add(directionalLightHelper);

const planeGeometry = new THREE.PlaneGeometry(10, 10); // Adjust size if needed
const mat = new THREE.MeshStandardMaterial({
  color: 0xffffff, // White base color
  roughness: 1.0, // Diffuse surface, adjust if needed
  metalness: 0.0, // Non-metallic material
});
const reflectivePlane = new THREE.Mesh(planeGeometry, mat);
addReflectionOnFloorUsingCubeCamera(reflectivePlane)
reflectivePlane.rotation.x = -Math.PI / 2;
scene.add(reflectivePlane)

// Render loop
function animate() {
  requestAnimationFrame(animate);
  controls.update(); // Update the orbit controls
  composer.render();
  renderer.render(scene, camera);
}
animate();

// Handle window resize
window.addEventListener('resize', () => {
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
});
