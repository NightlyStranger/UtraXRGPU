import { GUI } from 'three/addons/libs/lil-gui.module.min.js';
import Stats from 'three/addons/libs/stats.module.js';
import { InteractiveGroup } from 'three/addons/interactive/InteractiveGroup.js';
import { HTMLMesh } from 'three/addons/interactive/HTMLMesh.js';
import { TransformControls } from 'three/addons/controls/TransformControls.js';

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
  gui.add(parameters, 'radius', 0.0, 1.0).onChange(onChange);
  gui.add(parameters, 'tube', 0.0, 1.0).onChange(onChange);
  gui.add(parameters, 'tubularSegments', 10, 150, 1).onChange(onChange);
  gui.add(parameters, 'radialSegments', 2, 20, 1).onChange(onChange);
  gui.add(parameters, 'p', 1, 10, 1).onChange(onChange);
  gui.add(parameters, 'q', 0, 10, 1).onChange(onChange);
  gui.add(parameters, 'thickness', 0, 1).onChange(onThicknessChange);
  gui.domElement.style.visibility = 'hidden';

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
export async function initFBX(renderer, scene, camera, path) {
  
  try {
    const { object } = await loadFBX(scene, null, path); // pass gui if needed
    
    console.log(object);
    // TransformControls
    const transformControls = new TransformControls(camera, renderer.domElement);
    transformControls.attach(object);     // attach to cube
    scene.add(transformControls);
    console.log('FBX loaded:', object);
    return object;
  } catch (err) {
    console.error('Error loading FBX:', err);
    throw err;
  }
}