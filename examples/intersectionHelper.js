import * as THREE from 'three';
import { GUI } from 'three/addons/libs/lil-gui.module.min.js';
import { Break, If, texture3D, uniform, Fn, cameraProjectionMatrix, 
       modelViewMatrix,float, vec3, vec4,positionLocal, mul, cameraPosition, modelWorldMatrixInverse, Loop, max,
       uniformArray} from 'three/tsl';

/**
 * Adds two 1×1 quads (side-by-side) and a cube to the scene at position (0, 0, 0),
 * each with GUI controls for position, rotation, and scale.
 * @param {THREE.Scene} scene
 * @returns {{quad1: THREE.Mesh, quad2: THREE.Mesh, cube: THREE.Mesh, gui: GUI}}
 */
export function addQuad(scene) {
  const greenFragment = Fn(() => vec4(vec3(0, 1, 0), 1)); // equivalent to GLSL: vec4(0,1,0,1)

  const greenMaterial = new THREE.NodeMaterial();
  greenMaterial.colorNode = greenFragment();



  // --- MATERIALS ---
  const quad1Material = new THREE.MeshBasicMaterial({ color: 0x00ffff, side: THREE.DoubleSide });
  const quad2Material = greenMaterial;//new THREE.MeshBasicMaterial({ color: 0xff00ff, side: THREE.DoubleSide });
  const cubeMaterial = new THREE.MeshNormalMaterial();

  // --- GEOMETRIES ---
  const quadGeometry = new THREE.PlaneGeometry(1, 1);
  const cubeGeometry = new THREE.BoxGeometry(1, 1, 1);

  // --- MESHES ---
  const quad1 = new THREE.Mesh(quadGeometry, quad1Material);

  // --- save original vertices by reference ---
  const quad1Vertices = [];
  const posAttr = quad1.geometry.attributes.position;
  for (let i = 0; i < posAttr.count; i++) {
    // create a Vector3 for each vertex and store
    quad1Vertices.push(new THREE.Vector3().fromBufferAttribute(posAttr, i));
  }


  const quad2 = new THREE.Mesh(quadGeometry, quad2Material);
  const cube = new THREE.Mesh(cubeGeometry, cubeMaterial);

  // --- POSITIONS ---
  quad1.position.set(0, 0, 0);
  quad2.position.set(-1.2, 0, 0); // new quad to the left
  cube.position.set(0, 0.0, 0);

  scene.add(quad1);
  scene.add(quad2);
  scene.add(cube);

  // --- GUI ---
  const gui = new GUI();

  // First Quad Controls
  const quad1Folder = gui.addFolder('Quad 1 Controls');
  quad1Folder.add(quad1.position, 'x', -3, 3).name('Position X').onChange(() => logQuad1Vertices());
  quad1Folder.add(quad1.position, 'y', -3, 3).name('Position Y').onChange(() => logQuad1Vertices());
  quad1Folder.add(quad1.rotation, 'z', 0, Math.PI * 2).name('Rotation Z').onChange(() => logQuad1Vertices());
  quad1Folder.add(quad1.scale, 'x', 0.1, 3).name('Scale X').onChange(() => logQuad1Vertices());
  quad1Folder.open();

    // --- helper function ---
  function logQuad1Vertices() {
      quad1.updateMatrixWorld(true);
      const posAttr = quad1.geometry.attributes.position;
      for (let i = 0; i < posAttr.count; i++) {
          const v = new THREE.Vector3().fromBufferAttribute(posAttr, i).applyMatrix4(quad1.matrixWorld);
          console.log(`Quad1 vertex ${i}:`, v);
      }
  }

  // Second Quad Controls
  const quad2Folder = gui.addFolder('Quad 2 Controls');
  quad2Folder.add(quad2.position, 'x', -3, 3).name('Position X');
  quad2Folder.add(quad2.position, 'y', -3, 3).name('Position Y');
  quad2Folder.add(quad2.rotation, 'z', 0, Math.PI * 2).name('Rotation Z');
  quad2Folder.add(quad2.scale, 'x', 0.1, 3).name('Scale X');
  quad2Folder.open();

  // Cube Controls
  const cubeFolder = gui.addFolder('Cube Controls');
  cubeFolder.add(cube.position, 'x', -3, 3).name('Position X');
  cubeFolder.add(cube.position, 'y', -3, 3).name('Position Y');
  cubeFolder.add(cube.position, 'z', -3, 3).name('Position Z');
  cubeFolder.add(cube.rotation, 'y', 0, Math.PI * 2).name('Rotation Y');
  cubeFolder.add(cube.scale, 'x', 0.1, 3).name('Scale X');
  cubeFolder.add(cube.scale, 'y', 0.1, 3).name('Scale Y');
  cubeFolder.add(cube.scale, 'z', 0.1, 3).name('Scale Z');
  cubeFolder.open();

  return { quad1, quad2, cube, gui };
}
