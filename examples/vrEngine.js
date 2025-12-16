import { GUI } from 'three/addons/libs/lil-gui.module.min.js';
import Stats from 'three/addons/libs/stats.module.js';
import { InteractiveGroup } from 'three/addons/interactive/InteractiveGroup.js';
import { HTMLMesh } from 'three/addons/interactive/HTMLMesh.js';

let stats;
let statsMesh;

/**
 * Sets up GUI controls and stats panel inside a VR-capable interactive group.
 * @param {THREE.Scene} scene - Your Three.js scene.
 * @param {THREE.WebGLRenderer} renderer - Renderer used for XR.
 * @param {THREE.Camera} camera - Active camera.
 * @param {THREE.XRController} controller1 - First VR controller.
 * @param {THREE.XRController} controller2 - Second VR controller.
 * @param {Object} parameters - Parameters object with fields for GUI binding.
 * @param {Function} onChange - Callback for geometry change updates.
 * @param {Function} onThicknessChange - Callback for thickness updates.
 */
export function setupVRGUI(scene, renderer, camera, controller1, controller2, parameters, onChange, onThicknessChange) {
  
  // GUI setup
  const gui = new GUI({ width: 300 });

  // Interactive group for VR controllers
  const group = new InteractiveGroup();
  group.listenToPointerEvents(renderer, camera);
  group.listenToXRControllerEvents(controller1);
  group.listenToXRControllerEvents(controller2);
  scene.add(group);

  // GUI mesh inside VR
  const mesh = new HTMLMesh(gui.domElement);
  mesh.position.set(-0.75, 1.5, -0.5);
  mesh.rotation.y = Math.PI / 4;
  mesh.scale.setScalar(2);
  group.add(mesh);

  // Stats setup
  stats = new Stats();
  stats.dom.style.width = '80px';
  stats.dom.style.height = '48px';
  document.body.appendChild(stats.dom);

  statsMesh = new HTMLMesh(stats.dom);
  statsMesh.position.set(-0.75, 2, -0.6);
  statsMesh.rotation.y = Math.PI / 4;
  statsMesh.scale.setScalar(2.5);
  group.add(statsMesh);

  return { gui, stats, statsMesh, group };
}

/**
 * Call this inside your render loop to update stats.
 */
export function updateStats() {
  if (stats) stats.update();
  statsMesh.material.map.update();
}

import { loadFBX } from './fbxLoader.js';

/**
 * Initialize and load FBX into the scene.
 * @param {THREE.Scene} scene - The Three.js scene.
 * @param {string} path - Path to the FBX file.
 * @returns {Promise<THREE.Object3D>} - The loaded FBX object.
 */
export async function initFBX(scene, path) {
  
  try {
    const { object } = await loadFBX(scene, null, path); // pass gui if needed
    console.log('FBX loaded:', object);
    // Optional: scale down initially
    
    object.scale.set(0.01, 0.01, 0.01);
    object.position.set(0, 0, 0);
    // Parameters for GUI
    const params = {
        posX: object.position.x,
        posY: object.position.y,
        posZ: object.position.z,
        scale: object.scale.x
    };

    // Create GUI
    
    const gui = new GUI({ width: 250 });
    gui.domElement.style.position = 'absolute';
    gui.domElement.style.top = '10px';
    gui.domElement.style.right = '10px';
    gui.title = 'FBX Transform';

    gui.add(params, 'posX', -10, 10, 0.01).name('Position X').onChange(v => object.position.x = v);
    gui.add(params, 'posY', -10, 10, 0.01).name('Position Y').onChange(v => object.position.y = v);
    gui.add(params, 'posZ', -10, 10, 0.01).name('Position Z').onChange(v => object.position.z = v);

    gui.add(params, 'scale', 0.001, 2, 0.001).name('Scale').onChange(v => object.scale.set(v, v, v));
    
    
    return object;
  } catch (err) {
    console.error('Error loading FBX:', err);
    throw err;
  }
}