import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { GUI } from 'three/addons/libs/lil-gui.module.min.js';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { Break, If, vec3, vec4, texture3D, uniform, Fn } from 'three/tsl';
import { RaymarchingBox } from 'three/addons/tsl/utils/Raymarching.js';


export function initModelLayer(renderer, scene, {
  modelUrl,
  volumePath = 'volumes/Frame01/Volume.raw',
  volumeDimensions = { x: 480, y: 598, z: 564 },
  position = new THREE.Vector3(-1.5, 1.5, -1.5),
  layerSize = { width: 1, height: 1 },
  cameraY = 300,
  backgroundColor = 0xf0f0f0,
  onLoad = () => {}
} = {}) {

    const modelScene = new THREE.Scene();
    modelScene.background = new THREE.Color(backgroundColor);

    const modelCamera = new THREE.PerspectiveCamera(50, 1, 1, 10000);
    modelCamera.position.y = cameraY;

    const light1 = new THREE.DirectionalLight(0xefefff, 1.5);
    light1.position.set(1, 1, 1).normalize();
    modelScene.add(light1);

    const light2 = new THREE.DirectionalLight(0xffefef, 1.5);
    light2.position.set(-1, -1, -1).normalize();
    modelScene.add(light2);

    // GUI
    const gui = new GUI({ width: 250 });
    const loader = new OBJLoader();
    loader.load(modelUrl, (obj) => {
        const model = obj;
        model.scale.set(0.15, 0.15, 0.15);
        model.position.set(-10.0, 285.0, -60.0);
        const cherryMaterial = new THREE.MeshPhysicalMaterial({
            color: new THREE.Color(0xff0055),
            metalness: 0.5,
            roughness: 0.05,
            transmission: 1.0, // for glass-like effect
            thickness: 1.0,
            transparent: true,
            opacity: 0.6,
            ior: 1.4, // Index of refraction
            side: THREE.DoubleSide,
            envMapIntensity: 1.5,
            reflectivity: 0.9,
            clearcoat: 1.0,
            clearcoatRoughness: 0.1,
            sheen: 1.0,
            sheenColor: new THREE.Color(1.0, 0.2, 0.5),
            sheenRoughness: 0.4,
            clipShadows: true,
            alphaToCoverage: true
        });
        model.traverse((child) => {
            if (child.isMesh) {
                child.material = cherryMaterial;
            }
        });
        modelScene.add(model);
        onLoad(model);
    

        // Position folder
        const posFolder = gui.addFolder('Model Position');
        posFolder.add(model.position, 'x', -300, 300, 0.1).onChange(render);
        posFolder.add(model.position, 'y', -300, 300, 0.1).onChange(render);
        posFolder.add(model.position, 'z', -300, 300, 0.1).onChange(render);
        posFolder.open();

        // Scale folder
        const scaleFolder = gui.addFolder('Model Scale');
        scaleFolder.add(model.scale, 'x', 0.001, 2, 0.001).onChange(render);
        scaleFolder.add(model.scale, 'y', 0.001, 2, 0.001).onChange(render);
        scaleFolder.add(model.scale, 'z', 0.001, 2, 0.001).onChange(render);
        scaleFolder.open();

        // Rotation folder (in degrees)
        const rotFolder = gui.addFolder('Model Rotation');
        const rot = model.rotation;

        // Display degrees instead of radians in GUI
        const rotDegrees = { 
            x: THREE.MathUtils.radToDeg(rot.x), 
            y: THREE.MathUtils.radToDeg(rot.y), 
            z: THREE.MathUtils.radToDeg(rot.z) 
        };

        rotFolder.add(rotDegrees, 'x', -180, 180, 1).onChange((v) => {
            rot.x = THREE.MathUtils.degToRad(v); 
            render();
        });
        rotFolder.add(rotDegrees, 'y', -180, 180, 1).onChange((v) => {
            rot.y = THREE.MathUtils.degToRad(v); 
            render();
        });
        rotFolder.add(rotDegrees, 'z', -180, 180, 1).onChange((v) => {
            rot.z = THREE.MathUtils.degToRad(v); 
            render();
        });
        rotFolder.open();

        

        function render() {
            renderer.render(modelScene, modelCamera);
        }
    });

    /*
    // 🟦 Load and add volume in same scene
    const dimX = volumeDimensions.x;
    const dimY = volumeDimensions.y;
    const dimZ = volumeDimensions.z;
    const threshold = uniform(0.3);
    const steps = uniform(200);

    fetch(volumePath).then(response => response.arrayBuffer()).then(buffer => {
        const expectedSize = dimX * dimY * dimZ;
        const byteArray = new Uint8Array(buffer);
        if (byteArray.length !== expectedSize) {
            console.warn(`Expected ${expectedSize} bytes, got ${byteArray.length}`);
        }

        const texture = new THREE.Data3DTexture(byteArray, dimX, dimY, dimZ);
        texture.format = THREE.RedFormat;
        texture.type = THREE.UnsignedByteType;
        texture.minFilter = THREE.LinearFilter;
        texture.magFilter = THREE.LinearFilter;
        texture.unpackAlignment = 1;
        texture.needsUpdate = true;

        const opaqueRaymarchingTexture = Fn(({ texture, steps, threshold }) => {
            const finalColor = vec4(0).toVar();
            RaymarchingBox(steps, ({ positionRay }) => {
            const mapValue = texture.sample(positionRay.add(0.5)).r.toVar();
            If(mapValue.greaterThan(threshold), () => {
                const p = vec3(positionRay).add(0.5);
                finalColor.rgb.assign(texture.normal(p).mul(0.5).add(positionRay.mul(1.5).add(0.25)));
                finalColor.a.assign(1);
                Break();
            });
            });
            return finalColor;
        });

        const material = new THREE.NodeMaterial();
        material.colorNode = opaqueRaymarchingTexture({
            texture: texture3D(texture, null, 0),
            steps,
            threshold
        });
        material.side = THREE.BackSide;
        material.transparent = true;

        const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), material);
        mesh.position.set(10, 295, -60); 
        mesh.scale.set(30, 30, 30);
        const initialRotationDeg = { x: 0, y: -180, z: 90 };

        // Convert to radians and set mesh.rotation
        mesh.rotation.set(
            THREE.MathUtils.degToRad(initialRotationDeg.x),
            THREE.MathUtils.degToRad(initialRotationDeg.y),
            THREE.MathUtils.degToRad(initialRotationDeg.z)
        );
        modelScene.add(mesh);

        gui.add(threshold, 'value', 0, 1, 0.01).name('Volume Threshold');
        gui.add(steps, 'value', 0, 300, 1).name('Raymarch Steps');

        // Position controls for volume
        const volPosFolder = gui.addFolder('Volume Position');
        volPosFolder.add(mesh.position, 'x', -300, 300, 0.1).name('X').onChange(render);
        volPosFolder.add(mesh.position, 'y', -300, 300, 0.1).name('Y').onChange(render);
        volPosFolder.add(mesh.position, 'z', -300, 300, 0.1).name('Z').onChange(render);
        volPosFolder.open();

        // Rotation controls (degrees)
        const volRotFolder = gui.addFolder('Volume Rotation');
        const volRot = mesh.rotation;

        const volRotDegrees = {
            x: THREE.MathUtils.radToDeg(volRot.x),
            y: THREE.MathUtils.radToDeg(volRot.y),
            z: THREE.MathUtils.radToDeg(volRot.z)
        };

        volRotFolder.add(volRotDegrees, 'x', -180, 180, 1).name('X').onChange(v => {
            volRot.x = THREE.MathUtils.degToRad(v);
            render();
        });
        volRotFolder.add(volRotDegrees, 'y', -180, 180, 1).name('Y').onChange(v => {
            volRot.y = THREE.MathUtils.degToRad(v);
            render();
        });
        volRotFolder.add(volRotDegrees, 'z', -180, 180, 1).name('Z').onChange(v => {
            volRot.z = THREE.MathUtils.degToRad(v);
            render();
        });
        volRotFolder.open();

        const volFolder = gui.addFolder('Volume Scale');
        volFolder.add(mesh.scale, 'x', 0.1, 300, 0.1).name('X').onChange(render);
        volFolder.add(mesh.scale, 'y', 0.1, 300, 0.1).name('Y').onChange(render);
        volFolder.add(mesh.scale, 'z', 0.1, 300, 0.1).name('Z').onChange(render);
        volFolder.open();

        render();

        function render() {
            renderer.render(modelScene, modelCamera);
        }
    });
    */

    const modelLayer = renderer.xr.createQuadLayer(
        layerSize.width, layerSize.height,
        position,
        new THREE.Quaternion(),
        layerSize.width * 800, layerSize.height * 800,
        () => renderer.render(modelScene, modelCamera)
    );

    scene.add(modelLayer);

    return {
        modelLayer,
        modelScene,
        modelCamera
    };
}
