// fbxLoader.js
import * as THREE from 'three';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';

export async function loadFBX(scene, gui, assetPath) {
    return new Promise((resolve, reject) => {
        const manager = new THREE.LoadingManager();
        const loader = new FBXLoader(manager);

        loader.load(
            assetPath,
            function (group) {
                // Enable shadows on meshes
                group.traverse(function (child) {
                    if (child.isMesh) {
                        child.castShadow = true;
                        child.receiveShadow = true;
                    }
                });
                group.position.set(-1, -1, -1);
                group.scale.set(0.02, 0.02, 0.02);
                scene.add(group);
                if (gui) {
                    const folder = gui.addFolder(assetPath);

                    const posFolder = folder.addFolder('Position');
                    posFolder.add(group.position, 'x', -10, 10, 0.1);
                    posFolder.add(group.position, 'y', -10, 10, 0.1);
                    posFolder.add(group.position, 'z', -10, 10, 0.1);

                    const scaleFolder = folder.addFolder('Scale');
                    scaleFolder.add(group.scale, 'x', 0.01, 10, 0.01);
                    scaleFolder.add(group.scale, 'y', 0.01, 10, 0.01);
                    scaleFolder.add(group.scale, 'z', 0.01, 10, 0.01);
                }

                resolve({ object: group });
            },
            undefined,
            function (error) {
                reject(error);
            }
        );
    });
}
