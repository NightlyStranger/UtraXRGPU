import * as THREE from 'three';
import { GUI } from 'three/addons/libs/lil-gui.module.min.js';
import { InteractiveGroup } from 'three/addons/interactive/InteractiveGroup.js';
import { HTMLMesh } from 'three/addons/interactive/HTMLMesh.js';

export function initGUILayer(renderer, scene, parameters, onChange, onThicknessChange) {
  const guiScene = new THREE.Scene();
  guiScene.background = new THREE.Color(0x000000);

  const guiCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  guiScene.add(guiCamera);

  const gui = new GUI({ width: 300 });
  gui.add(parameters, 'radius', 0.0, 1.0).onChange(onChange);
  gui.add(parameters, 'tube', 0.0, 1.0).onChange(onChange);
  gui.add(parameters, 'tubularSegments', 10, 150, 1).onChange(onChange);
  gui.add(parameters, 'radialSegments', 2, 20, 1).onChange(onChange);
  gui.add(parameters, 'p', 1, 10, 1).onChange(onChange);
  gui.add(parameters, 'q', 0, 10, 1).onChange(onChange);
  gui.add(parameters, 'thickness', 0, 1).onChange(onThicknessChange);
  gui.add(parameters, 'parhaha', 0, 1).onChange(onChange);
  gui.domElement.style.visibility = 'hidden';

  const guiGroup = new InteractiveGroup(renderer, guiCamera);
  guiScene.add(guiGroup);

  const htmlMesh = new HTMLMesh(gui.domElement);
  guiGroup.add(htmlMesh);

  const bbox = new THREE.Box3().setFromObject(guiScene);
  guiCamera.left = bbox.min.x;
  guiCamera.right = bbox.max.x;
  guiCamera.top = bbox.max.y;
  guiCamera.bottom = bbox.min.y;
  guiCamera.updateProjectionMatrix();

  const guiLayer = renderer.xr.createQuadLayer(
    1.2, 0.8,
    new THREE.Vector3(1.5, 1.5, -1.5),
    new THREE.Quaternion(),
    1280, 800,
    () => renderer.render(guiScene, guiCamera)
  );
  scene.add(guiLayer);

  return {
    gui,
    guiLayer,
    update: () => {
      // optional update logic if needed
    }
  };
}
