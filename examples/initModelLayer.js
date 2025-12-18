import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { GUI } from 'three/addons/libs/lil-gui.module.min.js';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { Break, If, texture3D, uniform, Fn, cameraProjectionMatrix, 
       modelViewMatrix,float, vec3, vec4,positionLocal, mul, cameraPosition, modelWorldMatrixInverse, Loop, max,
       uniformArray, texture} from 'three/tsl';
import { RaymarchingBox } from 'three/addons/tsl/utils/Raymarching.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { loadFBX } from './fbxLoader.js';
import { FontLoader } from 'three/addons/loaders/FontLoader.js';
import { TextGeometry } from 'three/addons/geometries/TextGeometry.js';

// Clipping planes
const worldPlane = new THREE.Plane(new THREE.Vector3(0, 0, -1), 0.0);
const refferencePlane = new THREE.Plane(new THREE.Vector3(0, 0, -1), 0.0);
const viewPlane = worldPlane.clone();
let globalVolumeMesh;

const modelCamera = new THREE.PerspectiveCamera(50, 1, 1, 10000);
modelCamera.position.set(0.0, 2.0, 5.0);

let renderTarget;
let renderModelLayer = true;
const dpr = window.devicePixelRatio;

const invCube1Matrix = new THREE.Matrix4();
let sampleModel;
let copyModel;
const renderOffscreenLayers = [false, false, false, false, false];

let nextLayerIndex = 0;

let wMatrix1;
let wMatrix2;

export function initModelLayer(
  gui,
  renderer, scene, {
  modelUrl,
  volumePath = 'volumes/Frame01/Volume.downsampled.raw',
  volumeDimensions = { x: 240, y: 299, z: 282 },
  position = new THREE.Vector3(-1.5, 1.5, -1.5),
  layerSize = { width: 1, height: 1 },
  guiGroup,
  backgroundColor = 0xf0f0f0,
  onLoad = () => {},
} = {}) {
    const modelScene = new THREE.Scene();
    let helper3D;

    const globalClippingGroup = new THREE.ClippingGroup();
    globalClippingGroup.clippingPlanes = [];

    const knotClippingGroup = new THREE.ClippingGroup();
    knotClippingGroup.clippingPlanes = [worldPlane];
    knotClippingGroup.clipIntersection = true;

    modelScene.add( globalClippingGroup );
    globalClippingGroup.add( knotClippingGroup );
    
    const globalClippingGroup2 = new THREE.ClippingGroup();
    globalClippingGroup2.clippingPlanes = [];
    const knotClippingGroup2 = new THREE.ClippingGroup();
    knotClippingGroup2.clippingPlanes = [ refferencePlane ];
    knotClippingGroup2.clipIntersection = true;

    globalClippingGroup2.add(knotClippingGroup2);
    scene.add(globalClippingGroup2);



    modelScene.background = new THREE.Color(backgroundColor);

    let controls;

    const light1 = new THREE.DirectionalLight(0xefefff, 1.5);
    light1.position.set(1, 1, 1).normalize();
    modelScene.add(light1);

    const light2 = new THREE.DirectionalLight(0xffefef, 1.5);
    light2.position.set(-1, -1, -1).normalize();
    modelScene.add(light2);

    // GUI
    //const gui = new GUI({ width: 250 });

    const camFolder = gui.addFolder('Model Camera');
    camFolder.add(modelCamera.position, 'x', -50, 50, 0.1).name('posX');
    camFolder.add(modelCamera.position, 'y', -50, 50, 0.1).name('posY');
    camFolder.add(modelCamera.position, 'z', -50, 50, 0.1).name('posZ');

    camFolder.add(modelCamera.rotation, 'x', -Math.PI, Math.PI, 0.01).name('rotX');
    camFolder.add(modelCamera.rotation, 'y', -Math.PI, Math.PI, 0.01).name('rotY');
    camFolder.add(modelCamera.rotation, 'z', -Math.PI, Math.PI, 0.01).name('rotZ');

    camFolder.open();

    // GUI folder
    const guiFolder = gui.addFolder('Extra Layers');

    // Button object
    const guiControls = {
        enableNextLayer: () => {
            if (nextLayerIndex >= renderOffscreenLayers.length) {
                console.log('All layers already enabled');
                return;
            }

            renderOffscreenLayers[nextLayerIndex] = true;
            console.log(`Layer ${nextLayerIndex + 1} enabled`);
            nextLayerIndex++;
        }
    };

    // Add button to GUI
    guiFolder.add(guiControls, 'enableNextLayer').name('Enable Next Layer');
    guiFolder.open();    

    const renderingMode = uniform(2);
    const threshold = uniform(0.4);
    addRenderingModeGUIControl(renderingMode, gui);
    addThresholdGUIControl(threshold, gui, "Iso Threshold", 0.0, 1.0, 0.01);

    const rangesFolder = gui.addFolder('Ranges');
    // ranges are stored as pairs [min, max]
    // Initialize ranges: [min, max, color, opacity]
    //let ranges = [{ min: 0, max: 1, color: '#dc143c', opacity: 1.0 }];
    const ranges = [
        { min: 0.0,  max: 0.01, color: '#ffffff', opacity: 0.0 },
        { min: 0.01, max: 0.1,  color: '#f2ddc0', opacity: 0.1 },
        { min: 0.1,  max: 0.3,  color: '#f77878', opacity: 0.3 },
        { min: 0.3,  max: 0.5,  color: '#d11f43', opacity: 0.5 },
        { min: 0.5,  max: 1.0,  color: '#e1667e', opacity: 0.75 }
    ];
    //const maxRanges = 5; // max number of ranges in shader
    const maxRanges = ranges.length;
    let sizeCounter = 5;
    const rangeMins = new Float32Array(maxRanges);
    const rangeMaxs = new Float32Array(maxRanges);
    const rMapping = new Float32Array(maxRanges);
    const gMapping = new Float32Array(maxRanges);

    const colorsMapping = new Array(maxRanges);
    const opacityMapping = new Array(maxRanges);

    for (let i = 0; i < maxRanges; i++) {
        colorsMapping[i] = new THREE.Color(ranges[i].color);
        opacityMapping[i] = ranges[i].opacity;
    }
    /*
    const colorsMapping = new Array(maxRanges).fill(null).map(() => {
        const c = new THREE.Color();
        c.set('#dc143c'); // crimson
        return c;
    })
    const opacityMapping = new Array(maxRanges).fill(1.0);
    */
    const opacityMappingUniform = uniformArray(opacityMapping);
    const colorsMappingUniform = uniformArray(colorsMapping);
    const rangesSizeUniform = uniform(sizeCounter);
    for (let i = 0; i < maxRanges; i++) {
        rangeMins[i] = ranges[i].min;
        rangeMaxs[i] = ranges[i].max;
    }
    const rangeMinsUniform = uniformArray(rangeMins);
    const rangeMaxesUniform = uniformArray(rangeMaxs);
    
    let rangeControllers = [];
    // show current ranges
    function rebuildRangesGUI() {
        rangeControllers.forEach(c => c.destroy());
        rangeControllers = [];

        ranges.forEach((r, i) => {
            const folder = rangesFolder.addFolder(`Range ${i + 1}`);
            const labelObj = { range: `[${r.min.toFixed(3)}, ${r.max.toFixed(3)}]` };
            const ctrl = folder.add(labelObj, 'range').name('Bounds');
            ctrl.disable();
            rangeControllers.push(ctrl);

            // color picker
            const colorCtrl = folder.addColor(r, 'color').name('Color');
            rangeControllers.push(colorCtrl);
            colorCtrl.onChange((hex) => {
                colorsMapping[i].set(hex);
            });

            // opacity slider
            const opacityCtrl = folder.add(r, 'opacity', 0, 1, 0.01).name('Opacity');
            opacityCtrl.onChange(value => {
                opacityMapping[i] = value;
            });
            rangeControllers.push(opacityCtrl);
            if (ranges.length > 1) {
                const delObj = {
                    remove: () => {
                        if (i < ranges.length - 1) {
                            ranges[i + 1].min = r.min;
                        } else {
                            ranges[i - 1].max = r.max;
                        }
                        ranges.splice(i, 1);
                        rebuildRangesGUI();
                        for (let i = 0; i < maxRanges; i++) {
                            if (i < ranges.length) {
                                rangeMins[i] = ranges[i].min;
                                rangeMaxs[i] = ranges[i].max;
                            }
                        }
                        sizeCounter--;
                        rangesSizeUniform.value = sizeCounter;
                        while (rangesFolder.children.length > ranges.length) {
                            rangesFolder.children[0].destroy();
                        }
                    }
                };
                rangeControllers.push(folder.add(delObj, 'remove').name('Delete'));
            }
        });
    }

    function splitAt(value) {
        if (value <= 0 || value >= 1) return;
        for (let i = 0; i < ranges.length; i++) {
            const r = ranges[i];
            if (value > r.min && value < r.max) {
                const first = { min: r.min, max: value, color: r.color, opacity: r.opacity };
                const second = { min: value, max: r.max, color: r.color, opacity: r.opacity };
                ranges.splice(i, 1, first, second);
                rebuildRangesGUI();
            }
        }
        for (let i = 0; i < maxRanges; i++) {
            if (i < ranges.length) {
                    rangeMins[i] = ranges[i].min;
                    rangeMaxs[i] = ranges[i].max;
                }
        }
        sizeCounter++;
        rangesSizeUniform.value = sizeCounter;
        // cleanup extra folders
        while (rangesFolder.children.length > ranges.length) {
            rangesFolder.children[0].destroy();
        }
    }

    // UI to choose split point and add
    const params = { value: 0.5, add: () => splitAt(params.value) };
    gui.add(params, 'value', 0, 1, 0.001).name('Split At');
    gui.add(params, 'add').name('Add Range');

    rebuildRangesGUI();

    function loadModel(modelUrl) {
        return new Promise((resolve, reject) => {
            const loader = new OBJLoader();
            loader.load(
            modelUrl,
            (obj) => {
                const model = obj;
                
                const rowMajor = [
                    0, 1, 0, 0,
                    0, 0, -1, 0,
                    -1, 0, 0, 0,
                    0, 0, 0, 1
                ];
                const m = new THREE.Matrix4();
                m.set(
                    rowMajor[0], rowMajor[4], rowMajor[8],  rowMajor[12],
                    rowMajor[1], rowMajor[5], rowMajor[9],  rowMajor[13],
                    rowMajor[2], rowMajor[6], rowMajor[10], rowMajor[14],
                    rowMajor[3], rowMajor[7], rowMajor[11], rowMajor[15]
                );
                // Extract rotation only
                const quat = new THREE.Quaternion();
                m.extractRotation(m);
                quat.setFromRotationMatrix(m);
                console.log("Rotation", quat);

                // Apply rotation
                //model.scale.set(0.02, 0.02, 0.02);

                //model.applyMatrix4(m);

                // ------------------------------
                // 3) Additional matrix (M2)
                // ------------------------------
                const M2 = new THREE.Matrix4();

                // Example rotation (change this to whatever you need)
                M2.makeRotationX(THREE.MathUtils.degToRad(90));


                // ------------------------------
                // 4) Apply matrices one by one
                // ------------------------------
                model.scale.set(0.02, 0.02, 0.02);

                model.applyMatrix4(m);   // first transformation
                model.applyMatrix4(M2);  // second transformation



                const cherryMaterial = new THREE.MeshPhysicalMaterial({
                    color: new THREE.Color(0xff0055),
                    metalness: 0.5,
                    roughness: 0.05,
                    transmission: 0.2,
                    thickness: 1.0,
                    transparent: true,
                    opacity: 0.55,
                    ior: 1.4,
                    side: THREE.DoubleSide,
                    envMapIntensity: 1.5,
                    reflectivity: 0.9,
                    clearcoat: 1.0,
                    clearcoatRoughness: 0.1,
                    sheen: 1.0,
                    sheenColor: new THREE.Color(1.0, 0.2, 0.5),
                    sheenRoughness: 0.4,
                    clipShadows: true,
                    alphaToCoverage: true,
                    depthWrite: false,
                    renderOrder: 1
                });

                model.traverse((child) => {
                if (child.isMesh) {
                    child.material = cherryMaterial;
                }
                });
                wMatrix1 = model.matrixWorld;
                console.log(wMatrix1);

                resolve(model);
            },
            undefined,
            (error) => {
                reject(error);
            }
            );
        });
        }
        const planeNormal = uniform(worldPlane.normal);
        const planeConstant = uniform(worldPlane.constant);

        addPlaneGUIControl(refferencePlane, gui, modelCamera, controls, 'Local Clipping Plane', planeNormal, planeConstant);
        async function loadVolume(volumePathUrl) {
            const dimX = volumeDimensions.x;
            const dimY = volumeDimensions.y;
            const dimZ = volumeDimensions.z;
            const response = await fetch(volumePathUrl);
            const buffer = await response.arrayBuffer();
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

            const q = new THREE.Quaternion();
            q.setFromEuler(new THREE.Euler(0, 0, Math.PI / 2));

            const volumeMaterial = new THREE.NodeMaterial();
            
            const opaqueRaymarchingTexture = Fn(({ texture, steps}) => {
                //Add in g channel second texture
                let finalColor = vec4().toVar();
                finalColor.a.assign(0);
                
                const clipByPlane = Fn(({ point, n, c }) => {

                    const dist = n.normalize().dot(point).add(c);

                    return dist.lessThan(0.0);

                });
                // DVR accumulators
                let accumColor = vec3(0.0).toVar();
                let accumAlpha = float(0.0).toVar();
                const one = float(1.0);
                //MIP accumulators
                let accum = float(0.3).toVar();
                let opacity = float(0.0).toVar();
                RaymarchingBox(steps, ({ positionRay }) => {
                    let transformedPos = positionRay;
                    transformedPos = transformedPos.add(0.5);
                    const mapValue = texture.sample(transformedPos).r.toVar();
                    const clip = clipByPlane({
                        point: positionRay,
                        n: planeNormal,
                        c: planeConstant
                    });
                    const density = float( 0.0 ).toVar();
                    density.assign(1.0);

                    If(renderingMode.equal(0), () => {
                        If(mapValue.greaterThan(threshold).and(clip.not()), () => {
                            const p = vec3(positionRay).add(0.5);
                            Loop( rangesSizeUniform, ( { i } ) => {
                                const minVal = rangeMinsUniform.element(i);
                                const maxVal = rangeMaxesUniform.element(i);
                                If(mapValue.greaterThanEqual(minVal).and(mapValue.lessThan(maxVal)), () => {
                                    finalColor.assign(colorsMappingUniform.element(i));
                                    finalColor.a.assign(opacityMappingUniform.element(i));
                                }); 
                            } );
                            
                            Break();
                        });
                        

                    })
                    .ElseIf(renderingMode.equal(1), () => {
                        If(mapValue.lessThan(1.0).and(clip.not().and(mapValue.greaterThan(0.05))), () => {                        
                            const p = vec3(positionRay).add(0.5);
                            accum.assign(max(accum, mapValue));
                        });
                    })
                    .Else(() => {
                        If(clip.not(), () => {
                            let sampleColor = vec3(mapValue, 0, 0).toVar();
                            let sampleAlpha = mapValue.toVar();
                            
                            Loop({ start: 1, end: rangesSizeUniform }, ({ i }) => {
                                const minVal = rangeMinsUniform.element(i);
                                const maxVal = rangeMaxesUniform.element(i);

                                If(mapValue.greaterThanEqual(minVal).and(mapValue.lessThan(maxVal)),
                                    () => {
                                        const t = mapValue
                                            .sub(minVal)
                                            .div(maxVal.sub(minVal))
                                            .clamp(0.0, 1.0);
                                            
                                        const c0 = colorsMappingUniform.element(i.sub(1));
                                        const c1 = colorsMappingUniform.element(i);

                                        const a0 = opacityMappingUniform.element(i.sub(1));
                                        const a1 = opacityMappingUniform.element(i);
                                        sampleColor.assign(
                                            c0.mul(float(1.0).sub(t)).add(c1.mul(t))
                                        );

                                        sampleAlpha.assign(
                                            a0.mul(float(1.0).sub(t)).add(a1.mul(t))
                                        );
                                    }
                                );

                                If(mapValue.lessThan(threshold), () => {
                                    sampleAlpha.assign(0.0);
                                });
                            });
                             
                            const oneMinusAlpha = one.sub(accumAlpha);
                            accumColor.assign(accumColor.add(sampleColor.mul(sampleAlpha).mul(oneMinusAlpha)));
                            accumAlpha.assign(accumAlpha.add(sampleAlpha.mul(oneMinusAlpha)));
                            // early exit if almost opaque
                            If(accumAlpha.greaterThan(0.95), () => { Break(); });
                        });

                    });
                    


                });

                
                If(accum.greaterThan(threshold).and(renderingMode.equal(1)), ()=> {
                    Loop( rangesSizeUniform, ( { i } ) => {
                        const minVal = rangeMinsUniform.element(i);
                        const maxVal = rangeMaxesUniform.element(i);
                        If(accum.greaterThanEqual(minVal).and(accum.lessThan(maxVal)), () => {
                            finalColor.assign(colorsMappingUniform.element(i));
                            finalColor.a.assign(opacityMappingUniform.element(i));
                        }); 
                    } );
                });
                If((renderingMode.equal(2)), ()=> {
                    finalColor.rgb.assign(accumColor);
                    finalColor.a.assign(accumAlpha);
                });
                
                return finalColor;


            });
            
            volumeMaterial.colorNode = opaqueRaymarchingTexture({
                texture: texture3D(texture, null, 0),
                steps: 128
            });
            volumeMaterial.side = THREE.BackSide;
            volumeMaterial.transparent = true;
            volumeMaterial.alphaToCoverage = true;
            const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), volumeMaterial);
            
            const deg = THREE.MathUtils.degToRad;
            const pos = new THREE.Vector3(-1.36589, 0, -100);
            const rotDeg = new THREE.Vector3(90, 3.415095e-06, 270);
            const scale = new THREE.Vector3(235.114, 200, 248.996);
            pos.multiplyScalar(1 / 50);
            scale.multiplyScalar(1 / 50);
            mesh.position.copy(pos);
            mesh.rotation.set(deg(rotDeg.x), deg(rotDeg.y), deg(rotDeg.z));
            mesh.scale.copy(scale);

            const M2 = new THREE.Matrix4();
            M2.makeRotationX(THREE.MathUtils.degToRad(90));
            mesh.applyMatrix4(M2);

            globalVolumeMesh = mesh;

            
            updatePlaneForMesh(mesh, worldPlane, planeNormal, planeConstant);

            // ---------- Create SECOND mesh (volumeObserver) ----------
            const volumeObserver = new THREE.Mesh(
                new THREE.BoxGeometry(1, 1, 1),                 // shared geometry (OK)
                volumeMaterial    // CLONED material (important)
            );

            // copy full transform state
            volumeObserver.position.copy(mesh.position);
            volumeObserver.quaternion.copy(mesh.quaternion);
            volumeObserver.scale.copy(mesh.scale);
            volumeObserver.matrix.copy(mesh.matrix);
            volumeObserver.matrixWorld.copy(mesh.matrixWorld);

            // ensure independent updates
            volumeObserver.matrixAutoUpdate = false;
            volumeObserver.updateMatrixWorld(true);
            render();
            function render() {
                renderer.render(modelScene, modelCamera);
                
            }

            return mesh;
        }
        // Usage:
        async function loadAllModels() {
            const modelPromises = [];
            for (let i = 1; i <= 4; i++) {
                const modelUrl = `meshes/Frame0${i}/MeshesZ0.obj`;
                modelPromises.push(loadModel(modelUrl));
            }
            const models = await Promise.all(modelPromises);
            return models;
        }

        let clock = new THREE.Clock();
        let models;
        let frameCount = 4;

        loadAllModels().then(loadedModels => {
            models = loadedModels;
            let handled = false;
            models.forEach(model => {
                console.log("debug", handled);
                //if (handled) return;
                handled = true;
                model.visible = false;
                knotClippingGroup.add(model);
            });
            if (models.length > 0) {

                const model = models[0];
                sampleModel = model;

                model.visible = false;

                copyModel = model.clone(true);
                if (copyModel.geometry) {
                    copyModel.geometry = copyModel.geometry.clone();
                }
                copyModel.visible = true;
                copyModel.scale.x = 0.001;
                copyModel.scale.y = 0.001;
                copyModel.scale.z = 0.001;
                copyModel.position.set(0.69, 0.97, -0.45);
                const deg = THREE.MathUtils.degToRad;
                copyModel.rotation.set(
                    deg(-85),
                    deg(60),
                    deg(19)
                );

                copyModel.userData.ignoreVisibility = true;

                knotClippingGroup2.add(copyModel);

                const copyParams = {
                    // Position
                    x: copyModel.position.x,
                    y: copyModel.position.y,
                    z: copyModel.position.z,

                    // Scale
                    scaleX: copyModel.scale.x,
                    scaleY: copyModel.scale.y,
                    scaleZ: copyModel.scale.z,

                    // Rotation (in degrees for GUI)
                    rotX: THREE.MathUtils.radToDeg(copyModel.rotation.x),
                    rotY: THREE.MathUtils.radToDeg(copyModel.rotation.y),
                    rotZ: THREE.MathUtils.radToDeg(copyModel.rotation.z)
                };

                const copyFolder = gui.addFolder('Copy Model Transform');

                // --- POSITION ---
                copyFolder.add(copyParams, 'x', -5, 5, 0.01).name('X').onChange(() => {
                    copyModel.position.x = copyParams.x;
                });
                copyFolder.add(copyParams, 'y', -5, 5, 0.01).name('Y').onChange(() => {
                    copyModel.position.y = copyParams.y;
                });
                copyFolder.add(copyParams, 'z', -5, 5, 0.01).name('Z').onChange(() => {
                    copyModel.position.z = copyParams.z;
                });

                // --- SCALE ---
                copyFolder.add(copyParams, 'scaleX', 0.0001, 0.1, 0.0001).name('Scale X').onChange(() => {
                    copyModel.scale.x = copyParams.scaleX;
                });
                copyFolder.add(copyParams, 'scaleY', 0.0001, 0.1, 0.0001).name('Scale Y').onChange(() => {
                    copyModel.scale.y = copyParams.scaleY;
                });
                copyFolder.add(copyParams, 'scaleZ', 0.0001, 0.1, 0.0001).name('Scale Z').onChange(() => {
                    copyModel.scale.z = copyParams.scaleZ;
                });

                // --- ROTATION (degrees)
                copyFolder.add(copyParams, 'rotX', -180, 180, 0.1).name('Rot X').onChange(() => {
                    copyModel.rotation.x = THREE.MathUtils.degToRad(copyParams.rotX);
                });
                copyFolder.add(copyParams, 'rotY', -180, 180, 0.1).name('Rot Y').onChange(() => {
                    copyModel.rotation.y = THREE.MathUtils.degToRad(copyParams.rotY);
                });
                copyFolder.add(copyParams, 'rotZ', -180, 180, 0.1).name('Rot Z').onChange(() => {
                    copyModel.rotation.z = THREE.MathUtils.degToRad(copyParams.rotZ);
                });

                copyFolder.open();

                wMatrix2 = copyModel.matrixWorld;
            }

        });
        // In your render/animation loop
        async function loadAllVolumes() {
            const volumePromises = [];

            for (let i = 1; i <= 1; i++) {
                const volumePath = `volumes/Frame${String(i).padStart(2,'0')}/Volume.downsampled.raw`;
                console.log(volumePath);
                volumePromises.push(loadVolume(volumePath));
            }

            const volumes = await Promise.all(volumePromises);

            // Add all volumes to the scene but hide them initially
            volumes.forEach(volume => {
                volume.visible = false;
                modelScene.add(volume);

                
            });

            return volumes;
        }
        let volumes;
        
        loadAllVolumes().then(loadedVolumes => {
            volumes = loadedVolumes;
        });
        
        

        // state
        let playAnimation = true;
        let manualFrame = 0;

        const animParams = {
            frame: 0,
            play: () => { playAnimation = true; }
        };

        // frame slider
        gui.add(animParams, 'frame', 0, frameCount - 1, 1).name('Frame').onChange((value) => {
            manualFrame = value;
            playAnimation = false; // pause on manual frame
        });

        // play button
        gui.add(animParams, 'play').name('Play');

        let frameCounter = 0;
        const MAX_FRAMES = 48;
        animParams.frame = 0;
        function animate(updateCamera = true) {
            scene.updateMatrixWorld(true);
            requestAnimationFrame(animate);
            let currentFrame = animParams.frame;
            if (models) {
                models.forEach((model, i) => {
                    model.visible = (i === currentFrame);
                    copyModel.visible = true;
                    if(copyModel) {
                        invCube1Matrix.copy(copyModel.matrixWorld).invert();
                        worldPlane.copy(refferencePlane);
                        worldPlane.applyMatrix4(invCube1Matrix);
                        worldPlane.applyMatrix4(model.matrixWorld);
                        

                    }        
                });
            }

            if (volumes) {
                volumes.forEach((volume, i) => {
                    /*
                    invCube1Matrix.copy(volume.matrixWorld).invert();
                    worldPlane.copy(refferencePlane);
                    worldPlane.applyMatrix4(invCube1Matrix);
                    worldPlane.applyMatrix4(copyModel.matrixWorld);
                    */
                    volume.visible = (i === currentFrame);
                    planeNormal.value = worldPlane.normal;
                    planeConstant.value = worldPlane.constant;
                    function updatePlaneForMesh(mesh, worldPlane, planeNormal, planeConstant) {
                        mesh.updateMatrixWorld(true);

                        // --- 1. transform normal into local space ---
                        const normalMatrix = new THREE.Matrix3().getNormalMatrix(mesh.matrixWorld).invert();
                        const localNormal = worldPlane.normal.clone().applyMatrix3(normalMatrix).normalize();

                        // --- 2. compute a world point on the plane ---
                        const planePoint = worldPlane.normal.clone().multiplyScalar(-worldPlane.constant);

                        // --- 3. transform into local space ---
                        const localPoint = mesh.worldToLocal(planePoint.clone());

                        // --- 4. recompute constant in local space ---
                        const localConstant = -localNormal.dot(localPoint);
                        // --- 5. push into uniforms ---
                        planeNormal.value = localNormal;
                        planeConstant.value = localConstant;
                    }
                    updatePlaneForMesh(globalVolumeMesh, worldPlane, planeNormal, planeConstant);

                    const n = worldPlane.normal;
                    const wPConst  = worldPlane.constant;

                    const planePoint = n.clone().multiplyScalar(wPConst);

                    // backwards offset (opposite of normal)
                    const back = n.clone().negate().multiplyScalar(10);

                    // 3. Offsets in world X and Y
                    const offsetU = new THREE.Vector3(0, 0, 0); // sideways
                    const offsetV = new THREE.Vector3(0, 2, 0); // height

                    // 4. New camera position
                    const newCamPos = planePoint.clone()
                        .add(back)
                        .add(offsetU)
                        .add(offsetV);

                    if (updateCamera === true){
                        modelCamera.position.copy(newCamPos);
                    }

                    // 5. LookAt target shifted by same offsets
                    const lookTarget = planePoint.clone()
                        .add(offsetU)
                        .add(offsetV);

                    if (updateCamera === true) {
                        modelCamera.lookAt(lookTarget);
                    }
                    /*
                    invCube1Matrix.copy(copyModel.matrixWorld).invert();
                    worldPlane.copy(refferencePlane);
                    worldPlane.applyMatrix4(invCube1Matrix);
                    worldPlane.applyMatrix4(model.matrixWorld);
                    */
                });
            }
        }

        //animate();

    function getModels() {
        return sampleModel, copyModel;
    }

    

    //const layerPosition = new THREE.Vector3(-1.85, 1.7, -2.25);
    const layerPosition = new THREE.Vector3(-0.4, 1.35, -0.7);
    const modelLayer = renderer.xr.createQuadLayer(
        layerSize.width*0.11, layerSize.height*0.12,
        layerPosition,
        new THREE.Quaternion(),
        layerSize.width * 800, layerSize.height * 800,
        () => renderer.render(modelScene, modelCamera)
    );
    modelLayer.position.set(-0.43, 1.36, -0.65);
    modelLayer.scale.set(1.1, 1.1, 1.1);
    const layerParams = {
        posX: modelLayer.position.x,
        posY: modelLayer.position.y,
        posZ: modelLayer.position.z,
        scale: 1.0,
    };

    // dat.GUI setup
    const posFolder = gui.addFolder('Layer Position');
    posFolder.add(layerParams, 'posX', -5, 5, 0.01).onChange(updateLayer);
    posFolder.add(layerParams, 'posY', -5, 5, 0.01).onChange(updateLayer);
    posFolder.add(layerParams, 'posZ', -5, 5, 0.01).onChange(updateLayer);
    posFolder.open();

    const scaleFolder = gui.addFolder('Layer Scale');
    scaleFolder.add(layerParams, 'scale', 0.01, 2, 0.001).name('Width').onChange(updateLayer);
    scaleFolder.open();

    // Update function
    function updateLayer() {
        // Update position
        modelLayer.position.set(layerParams.posX, layerParams.posY, layerParams.posZ);
        modelLayer.scale.set(layerParams.scale, layerParams.scale, layerParams.scale);
    }
    
    scene.add(modelLayer);

    const extraLayers = [];
    const layerWidthWorld = layerSize.width * 0.11;
    const gap = layerWidthWorld * 1; // small spacing between screens
    
    const layout = [
        { row: 0, col: 0 }, // top-left
        { row: 0, col: 1 }, // top-middle
        { row: 0, col: 2 }, // top-right
        { row: 1, col: 1 }, // bottom-left
        { row: 1, col: 2 }  // bottom-right
         
    ];

    const gapX = 0.25 * 4; // horizontal spacing
    const gapY = 0.18 * 4; // vertical spacing
    const startPos = new THREE.Vector3(-1, 2, -1.0);
    const textPos = new THREE.Vector3(-1, 2.35, -1);

    const loader = new FontLoader();

    const labels = ['Long Axis', 'Short Axis', 'Three-Chamber', 'Four-Chamber', 'Two-Chamber'];

    layout.forEach((item, i) => {
        const pos = new THREE.Vector3(
            startPos.x + item.col * gapX,
            startPos.y - item.row * gapY, // move down for second row
            startPos.z
        );
        const posT = new THREE.Vector3(
            textPos.x + item.col * gapX,
            textPos.y - item.row * gapY, // move down for second row
            textPos.z
        );
        loader.load('fonts/helvetiker_regular.typeface.json', font => {

            const text = labels[i];

            const shapes = font.generateShapes(text, 10);
            const geometry = new THREE.ShapeGeometry(shapes);
            geometry.computeBoundingBox();

            // Center the text
            const xMid = -0.5 * (geometry.boundingBox.max.x - geometry.boundingBox.min.x);
            geometry.translate(xMid, 0, 0);

            const material = new THREE.MeshBasicMaterial({ color: 0xffffff });
            const mesh = new THREE.Mesh(geometry, material);
            mesh.scale.set(0.01, 0.01, 0.01);
            mesh.position.set(-0.97 + item.col * gapX, 2.3 - item.row * gapY, -1);

            scene.add(mesh);
        });

        const layer = renderer.xr.createQuadLayer(
            layerSize.width * 0.11 * 2.5,
            layerSize.height * 0.12 * 2.5,
            pos,
            new THREE.Quaternion(),
            layerSize.width * 800,
            layerSize.height * 800,
            () => {
                if (!renderOffscreenLayers[i]) return;
                renderer.render(modelScene, modelCamera);
                renderOffscreenLayers[i] = false;
            }
        );
        //layer.scale.set(2.5, 2.5, 2.5);

        scene.add(layer);
        extraLayers.push(layer);
    });
    
    return {
        getModels,
        wMatrix1,
        wMatrix2,
        worldPlane,
        refferencePlane,
        animate,
        models,
        animParams,
        threshold,
        modelLayer,
        modelScene,
        modelCamera,
        viewPlane,
        helper3D,
        controls,
        renderOffscreenLayers
    };
}

function addPlaneGUIControl(plane, gui, camera, controls, name = 'Clipping Plane', planeNormal, planeConstant) {
  const folder = gui.addFolder(name);
  console.log("here!!!!!!!!!!!!!!!!!");


  const params = {
    normalX: plane.normal.x,
    normalY: plane.normal.y,
    normalZ: plane.normal.z,
    constant: plane.constant,
    offsetBack: 2.0,
    offsetU: 0.0,
    offsetV: 1.0
  };

  function buildPlaneBasis(n) {
    // Pick direction least aligned with n
    let tangent;

    if (Math.abs(n.x) > Math.abs(n.z)) {
        tangent = new THREE.Vector3(-n.y, n.x, 0);
    } else {
        tangent = new THREE.Vector3(0, -n.z, n.y);
    }

    tangent.normalize();

    const U = tangent;                // first tangent
    const V = new THREE.Vector3().crossVectors(n, U).normalize(); // second tangent

    return { U, V };
  }
  function updatePlane() {

    if (globalVolumeMesh) {
        const n = new THREE.Vector3(params.normalX, params.normalY, params.normalZ);
        if (n.lengthSq() === 0) return; // avoid zero-length normals

        n.normalize();
        plane.normal.copy(n);
        planeNormal.value = n;
        plane.constant = params.constant;
        planeConstant.value = params.constant;
        updatePlaneForMesh(globalVolumeMesh, worldPlane, planeNormal, planeConstant);
        console.log("here");
        // ========== CAMERA POSITIONING ==========

        // point on the plane in world coordinates
        const planePoint = n.clone().multiplyScalar(params.constant);

        // backwards offset (opposite of normal)
        const back = n.clone().multiplyScalar(params.offsetBack);

        // 3. Offsets in world X and Y
        const offsetU = new THREE.Vector3(params.offsetU, 0, 0); // sideways
        const offsetV = new THREE.Vector3(0, params.offsetV, 0); // height

        // 4. New camera position
        const newCamPos = planePoint.clone()
            .add(back)
            .add(offsetU)
            .add(offsetV);

        modelCamera.position.copy(newCamPos);

        // 5. LookAt target shifted by same offsets
        const lookTarget = planePoint.clone()
            .add(offsetU)
            .add(offsetV);

        modelCamera.lookAt(lookTarget);
    }    
    
  }

  folder.add(params, 'normalX', -1, 1, 0.01).onChange(updatePlane);
  folder.add(params, 'normalY', -1, 1, 0.01).onChange(updatePlane);
  folder.add(params, 'normalZ', -1, 1, 0.01).onChange(updatePlane);
  folder.add(params, 'constant', -1, 1, 0.001).onChange(updatePlane);

  folder.add(params, 'offsetBack', 0.1, 10, 0.1).onChange(updatePlane);
  folder.add(params, 'offsetU', -5, 5, 0.1).onChange(updatePlane);
  folder.add(params, 'offsetV', -5, 5, 0.1).onChange(updatePlane);

  folder.open();

  const params2 = {
    enableOrbit: true,
    };

    gui.add(params2, 'enableOrbit').name('Enable Orbit').onChange((value) => {
        //controls.enabled = value;
    });

  return folder;
}

function updatePlaneForMesh(mesh, worldPlane, planeNormal, planeConstant) {
   mesh.updateMatrixWorld(true);

  // --- 1. transform normal into local space ---
  const normalMatrix = new THREE.Matrix3().getNormalMatrix(mesh.matrixWorld).invert();
  const localNormal = worldPlane.normal.clone().applyMatrix3(normalMatrix).normalize();

  // --- 2. compute a world point on the plane ---
  const planePoint = worldPlane.normal.clone().multiplyScalar(-worldPlane.constant);

  // --- 3. transform into local space ---
  const localPoint = mesh.worldToLocal(planePoint.clone());

  // --- 4. recompute constant in local space ---
  const localConstant = -localNormal.dot(localPoint);
  // --- 5. push into uniforms ---
  planeNormal.value = localNormal;
  planeConstant.value = localConstant;
}

function addRenderingModeGUIControl(renderingMode, gui, name = 'Rendering Mode') {
    const folder = gui.addFolder(name);

    const params = {
        mode: renderingMode.value, // initial value
    };

    // Add a dropdown or slider with discrete options: 0 = Iso, 1 = MIP, 2 = DVR
    folder.add(params, 'mode', { Iso: 0, MIP: 1, DVR: 2 }).name('Mode').onChange((val) => {
        renderingMode.value = val; // update the uniform
        console.log("Rendering Mode set to", val);
    });

    folder.open();
}
function addThresholdGUIControl(thresholdUniform, gui, name = 'Threshold', min = 0.0, max = 1.0, step = 0.01) {
    const folder = gui.addFolder(name);

    const params = {
        threshold: thresholdUniform.value, // initial value
    };

    folder.add(params, 'threshold', min, max, step).name('Threshold').onChange((val) => {
        thresholdUniform.value = val; // update the uniform
        console.log("Threshold set to", val);
    });

    folder.open();
}

