import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { GUI } from 'three/addons/libs/lil-gui.module.min.js';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';

const vertexShader = `
  varying vec3 vNormal;
  varying vec3 vViewDir;

  void main() {
    vNormal = normalize(normalMatrix * normal);
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    vViewDir = normalize(-mvPosition.xyz);
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const fragmentShader = `
  varying vec3 vNormal;
  varying vec3 vViewDir;

  void main() {
    float fresnel = pow(1.0 - dot(vNormal, vViewDir), 3.0);
    vec3 baseColor = vec3(0.8, 0.1, 0.3); // cherry red
    vec3 glowColor = vec3(1.0, 0.3, 0.5); // glowing tint

    vec3 color = mix(baseColor, glowColor, fresnel);
    float alpha = 0.6 + 0.4 * fresnel;  // semi-transparent with fresnel

    gl_FragColor = vec4(color, alpha);
  }
`;


export function initModelLayer(renderer, scene, {
  modelFolder = 'meshes',
  position = new THREE.Vector3(-1.5, 1.5, -1.5),
  layerSize = { width: 1, height: 1 },
  cameraY = 300,
  backgroundColor = 0xf0f0f0,
  frameCount = 4,
  frameDuration = 2000,
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

    const objLoader = new OBJLoader();
    let currentFrame = 0;
    const frames = [];

    const gui = new GUI({ width: 250 });

    function loadAllFrames() {
        let loaded = 0;
        console.log('debug frame count', frameCount);
        for (let i = 1; i <= frameCount; i++) {
            const padded = String(i).padStart(2, '0');
            const url = `${modelFolder}/Frame${padded}/MeshesZ0.obj`;

            objLoader.load(url, (obj) => {
                obj.traverse((child) => {
                    if (child.isMesh) {
                        child.material = new THREE.ShaderMaterial({
                            vertexShader,
                            fragmentShader,
                            transparent: true,
                            depthWrite: false,
                            blending: THREE.AdditiveBlending,
                            side: THREE.DoubleSide,
                        });
                    }
                });
                obj.visible = false;
                obj.scale.set(0.2, 0.2, 0.2);
                obj.position.set(0.0, 275.0, -50.0);
                modelScene.add(obj);
                frames[i - 1] = obj;

                loaded++;
                console.log('Happens?', loaded);
                if (loaded === frameCount) {
                    frames[0].visible = true;
                    setupGUI(frames[0]);
                    animateFrames();
                    onLoad(frames[0]);
                }
            });
        }
    }

    function setupGUI(model) {
        const posFolder = gui.addFolder('Model Position');
        posFolder.add(model.position, 'x', -300, 300, 0.1).onChange(render);
        posFolder.add(model.position, 'y', -300, 300, 0.1).onChange(render);
        posFolder.add(model.position, 'z', -300, 300, 0.1).onChange(render);
        posFolder.open();

        const scaleFolder = gui.addFolder('Model Scale');
        scaleFolder.add(model.scale, 'x', 0.001, 2, 0.001).onChange(render);
        scaleFolder.add(model.scale, 'y', 0.001, 2, 0.001).onChange(render);
        scaleFolder.add(model.scale, 'z', 0.001, 2, 0.001).onChange(render);
        scaleFolder.open();

        const rotFolder = gui.addFolder('Model Rotation');
        const rot = model.rotation;
        const rotDegrees = {
        x: THREE.MathUtils.radToDeg(rot.x),
        y: THREE.MathUtils.radToDeg(rot.y),
        z: THREE.MathUtils.radToDeg(rot.z),
        };
        rotFolder.add(rotDegrees, 'x', -180, 180, 1).onChange((v) => { rot.x = THREE.MathUtils.degToRad(v); render(); });
        rotFolder.add(rotDegrees, 'y', -180, 180, 1).onChange((v) => { rot.y = THREE.MathUtils.degToRad(v); render(); });
        rotFolder.add(rotDegrees, 'z', -180, 180, 1).onChange((v) => { rot.z = THREE.MathUtils.degToRad(v); render(); });
        rotFolder.open();
    }

    function animateFrames() {
        setInterval(() => {
        frames[currentFrame].visible = false;
        currentFrame = (currentFrame + 1) % frameCount;
        frames[currentFrame].visible = true;
        render();
        }, frameDuration);
    }

    function render() {
        renderer.render(modelScene, modelCamera);
    }

    loadAllFrames();

    /*
    const loader = new OBJLoader();
    loader.load(modelUrl, (obj) => {
        const model = obj;
        model.scale.set(0.2, 0.2, 0.2);
        model.position.set(0.0, 275.0, -50.0);
        modelScene.add(model);
        onLoad(model);

        // GUI
        const gui = new GUI({ width: 250 });

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
