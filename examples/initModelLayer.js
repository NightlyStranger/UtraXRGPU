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
import { HTMLMesh } from 'three/addons/interactive/HTMLMesh.js';

// Clipping planes
const worldPlane = new THREE.Plane(new THREE.Vector3(0, 0, -1), 0.0);
const refferencePlane = new THREE.Plane(new THREE.Vector3(0, 0, -1), 0.0);
const viewPlane = worldPlane.clone();
let globalVolumeMesh;

const modelCamera = new THREE.PerspectiveCamera(50, 1, 1, 10000);
modelCamera.position.set(0.0, 0.0, 10.0);

let renderTarget;
let renderModelLayer = true;
const dpr = window.devicePixelRatio;

const invCube1Matrix = new THREE.Matrix4();
let copyModel;
const renderOffscreenLayers = [false, false, false, false, false];

let nextLayerIndex = 0;

export function initModelLayer(renderer, scene, {
  modelUrl,
  volumePath = 'volumes/Frame01/Volume.downsampled.raw',
  volumeDimensions = { x: 240, y: 299, z: 282 },
  position = new THREE.Vector3(-1.5, 1.5, -1.5),
  layerSize = { width: 1, height: 1 },
  guiGroup,
  backgroundColor = 0xf0f0f0,
  onLoad = () => {},
} = {}) {
    renderTarget = new THREE.RenderTarget(1024, 1024);

    const quadGeo = new THREE.PlaneGeometry(1, 1);
    const quadMat = new THREE.MeshBasicNodeMaterial();

    quadMat.colorNode = texture(renderTarget.texture);

    const quad = new THREE.Mesh(quadGeo, quadMat);

    // place in VR space
    quad.position.set(0, 1.5, -2);

    scene.add(quad);

    const modelScene = new THREE.Scene();
    let helper3D;

    //addTransformableQuad(scene)

    // Clipping Groups
    //Offscreen clipping plane

    const globalClippingGroup = new THREE.ClippingGroup();
    globalClippingGroup.clippingPlanes = [];

    const knotClippingGroup = new THREE.ClippingGroup();
    knotClippingGroup.clippingPlanes = [worldPlane];
    knotClippingGroup.clipIntersection = true;

    modelScene.add( globalClippingGroup );
    globalClippingGroup.add( knotClippingGroup );
    //Refference clipping plane
    const globalClippingGroup2 = new THREE.ClippingGroup();
    globalClippingGroup2.clippingPlanes = [];

    // Knot group #2
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
    const gui = new GUI({ width: 250 });

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

    const renderingMode = uniform(0);
    const threshold = uniform(0.4);
    addRenderingModeGUIControl(renderingMode, gui);
    addThresholdGUIControl(threshold, gui, "Iso Threshold", 0.0, 1.0, 0.01);

    const rangesFolder = gui.addFolder('Ranges');
    // ranges are stored as pairs [min, max]
    // Initialize ranges: [min, max, color, opacity]
    let ranges = [{ min: 0, max: 1, color: '#dc143c', opacity: 1.0 }];
    const maxRanges = 5; // max number of ranges in shader
    let sizeCounter = 1;
    const rangeMins = new Float32Array(maxRanges);
    const rangeMaxs = new Float32Array(maxRanges);
    const rMapping = new Float32Array(maxRanges);
    const gMapping = new Float32Array(maxRanges);
    const colorsMapping = new Array(maxRanges).fill(null).map(() => {
        const c = new THREE.Color();
        c.set('#dc143c'); // crimson
        return c;
    });
    const opacityMapping = new Array(maxRanges).fill(1.0);
    const opacityMappingUniform = uniformArray(opacityMapping);
    const colorsMappingUniform = uniformArray(colorsMapping);
    const rangesSizeUniform = uniform(sizeCounter);
    for (let i = 0; i < maxRanges; i++) {
        rangeMins[i] = 0.0;
        rangeMaxs[i] = 1.0;
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
                    transmission: 1.0,
                    thickness: 1.0,
                    transparent: true,
                    opacity: 1.0,
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

        addPlaneGUIControl(worldPlane, gui, modelCamera, controls, 'Local Clipping Plane', planeNormal, planeConstant);
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
            function hexToVec3(hex) {
                const c = new THREE.Color(hex);
                return new THREE.Vector3(c.r, c.g, c.b);
            }

            const volumeMaterial = new THREE.NodeMaterial();
            
            const opaqueRaymarchingTexture = Fn(({ texture, steps}) => {
                //Add in g channel second texture
                let finalColor = vec4().toVar();
                finalColor.a.assign(0);
                
                const clipByPlane = Fn(({ point, n, c }) => {

                    const dist = n.normalize().dot(point).add(c);

                    return dist.lessThan(0.0);

                });

                const getASliceFromVolume = Fn(({ point, n, c }) => {

                    const dist = n.normalize().dot(point).add(c);

                    return dist.abs().greaterThan(0.01);

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
                    /*
                    const clip = getASliceFromVolume({
                        point: positionRay,
                        n: planeNormal,
                        c: planeConstant
                    });
                    */
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
                            
                            Loop( rangesSizeUniform, ( { i } ) => {
                                const minVal = rangeMinsUniform.element(i);
                                const maxVal = rangeMaxesUniform.element(i);
                                If(mapValue.greaterThanEqual(minVal).and(mapValue.lessThan(maxVal)), () => {
                                    const k =  sampleColor.assign(colorsMappingUniform.element(i));
                                    //alha linear interpolation
                                    sampleAlpha.assign(opacityMappingUniform.element(i));
                                });
                                If(mapValue.lessThan(threshold), () => {
                                    sampleAlpha.assign(0.0);
                                });  
                                
                            } );
                            
                            /*Loop(rangesSizeUniform, ({ i }) => {

                                const minVal = rangeMinsUniform.element(i);
                                const maxVal = rangeMaxesUniform.element(i);

                                // Only interpolate if mapValue is inside this range
                                If(mapValue.greaterThanEqual(minVal).and(mapValue.lessThan(maxVal)), () => {

                                    // Special case: first range
                                    If(i.equal(0), () => {

                                        const t = mapValue.sub(minVal)
                                            .div(maxVal.sub(minVal))
                                            .clamp(0.0, 1.0);

                                        sampleColor.assign(
                                            vec3(1.0).mix(colorsMappingUniform.element(0), t)
                                        );

                                        sampleAlpha.assign(
                                            float(0.0).mix(opacityMappingUniform.element(0), t)
                                        );

                                    }, () => {

                                        // Normal case: interpolate between previous and current
                                        const prevMin = rangeMinsUniform.element(i - 1);
                                        const prevMax = rangeMaxesUniform.element(i - 1);

                                        const t = mapValue.sub(minVal)
                                            .div(maxVal.sub(minVal))
                                            .clamp(0.0, 1.0);

                                        sampleColor.assign(
                                            colorsMappingUniform.element(i - 1).mix(
                                                colorsMappingUniform.element(i),
                                                t
                                            )
                                        );

                                        sampleAlpha.assign(
                                            opacityMappingUniform.element(i - 1).mix(
                                                opacityMappingUniform.element(i),
                                                t
                                            )
                                        );

                                    });

                                });

                                // Optional: global threshold check
                                If(mapValue.lessThan(threshold), () => {
                                    sampleAlpha.assign(0.0);
                                });

                            });
                            */
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
            
            const m = new THREE.Matrix4();
            /*
            // Fill with your values (column-major)
            const rowMajor = [
                0, 100, 0, 0,
                0, 0, -124.498, 0,
                -117.557, 0, 0, 0,
                0, 100, -1.36589, 1
            ];

            // Convert to column-major for Three.js
            m.set(
                rowMajor[0],  rowMajor[4],  rowMajor[8],  rowMajor[12],
                rowMajor[1],  rowMajor[5],  rowMajor[9],  rowMajor[13],
                rowMajor[2],  rowMajor[6],  rowMajor[10], rowMajor[14],
                rowMajor[3],  rowMajor[7],  rowMajor[11], rowMajor[15]
            );
            const pos = new THREE.Vector3();
            const quat = new THREE.Quaternion();
            const scale = new THREE.Vector3();

            m.decompose(pos, quat, scale);
            
            scale.x /= 50;
            scale.y /= 50;
            scale.z /= 50;

            pos.x = pos.x / 50;
            pos.y = pos.y / 50;
            pos.z = pos.z / 50;

            //mesh.position.set(pos.x, pos.y, pos.z);
            
            mesh.scale.copy(scale);
            //mesh.position.set(pos);
            //const initialRotationDeg = { x: 0, y: 0, z: 90 };
            const euler = new THREE.Euler().setFromQuaternion(quat);
            console.log('rot (deg)', pos);
            */
            /*mesh.rotation.set(
                THREE.MathUtils.degToRad(euler.x),
                THREE.MathUtils.degToRad(euler.y),
                THREE.MathUtils.degToRad(euler.z)
            );*/
            /*
            mesh.quaternion.copy(quat);
            */

            // 1️⃣ Create helper conversion
            const deg = THREE.MathUtils.degToRad;

            // 2️⃣ Define transform parameters
            const pos = new THREE.Vector3(-1.36589, 0, -100);
            const rotDeg = new THREE.Vector3(90, 3.415095e-06, 270);
            const scale = new THREE.Vector3(235.114, 200, 248.996);

            // 3️⃣ Apply global scale factor (1/50)
            pos.multiplyScalar(1 / 50);
            scale.multiplyScalar(1 / 50);

            // 4️⃣ Apply to mesh
            mesh.position.copy(pos);
            mesh.rotation.set(deg(rotDeg.x), deg(rotDeg.y), deg(rotDeg.z));
            mesh.scale.copy(scale);

            const M2 = new THREE.Matrix4();
            M2.makeRotationX(THREE.MathUtils.degToRad(90));
            mesh.applyMatrix4(M2);

            globalVolumeMesh = mesh;

            
            updatePlaneForMesh(mesh, worldPlane, planeNormal, planeConstant);
            /*
            mesh.scale.set(30, 30, 30);
            const initialRotationDeg = { x: 0, y: -180, z: 90 };
            mesh.rotation.set(
                THREE.MathUtils.degToRad(initialRotationDeg.x),
                THREE.MathUtils.degToRad(initialRotationDeg.y),
                THREE.MathUtils.degToRad(initialRotationDeg.z)
            );
            */
            render();
            function render() {
                renderer.render(modelScene, modelCamera);
                
            }

            function takeModelSnapshot() {
                // ensure the modelScene is fully rendered
                renderer.setRenderTarget(renderTarget);
                renderer.clear();
                renderer.render(modelScene, modelCamera);
                renderer.setRenderTarget(null);

                console.log("Snapshot captured:", snapshotTarget.texture);
            }
            return mesh;  // return mesh to the caller
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

                model.visible = false;

                copyModel = model.clone();
                copyModel.visible = true;
                copyModel.scale.x = 0.002;
                copyModel.scale.y = 0.002;
                copyModel.scale.z = 0.002;
                copyModel.position.set(0.2, 1, 1);

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
            }

        });
        // In your render/animation loop
        async function loadAllVolumes() {
            const volumePromises = [];

            for (let i = 1; i <= 4; i++) {
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

        function animate() {

            /*
            if (frameCounter === MAX_FRAMES) {
                renderModelLayer = false; // freeze quad layer
                console.log('Quad layer frozen');
            }
            */

            frameCounter++;
            requestAnimationFrame(animate);

            let currentFrame;
            if (playAnimation) {
                const elapsed = clock.getElapsedTime(); 
                currentFrame = Math.floor(elapsed) % frameCount;
                animParams.frame = currentFrame; // keep slider in sync
            } else {
                currentFrame = manualFrame;
            }

            if (models) {
                models.forEach((model, i) => {
                    model.visible = (i === currentFrame);

                    /*invCube1Matrix.copy(model.matrixWorld).invert();
                    
                    refferencePlane.copy(worldPlane);
                    
                    refferencePlane.applyMatrix4(invCube1Matrix);
                    
                    // --- 3. Convert plane: cube1 local → cube2 local ---
                    if (copyModel) {
                        refferencePlane.applyMatrix4(copyModel.matrixWorld);
                    }
                    */

                    /*invCube1Matrix.copy(copyModel.matrixWorld).invert();
                    worldPlane.copy(refferencePlane);
                    worldPlane.applyMatrix4(invCube1Matrix);
                    worldPlane.applyMatrix4(model.matrixWorld);
                    */
                    
                });
            }

            if (volumes) {
                volumes.forEach((volume, i) => {
                    volume.visible = (i === currentFrame);
                    /*
                    invCube1Matrix.copy(copyModel.matrixWorld).invert();
                    worldPlane.copy(refferencePlane);
                    worldPlane.applyMatrix4(invCube1Matrix);
                    worldPlane.applyMatrix4(model.matrixWorld);
                    */
                });
            }

            //renderer.render(modelScene, modelCamera);

            //renderer.setRenderTarget(null);
        }

        animate();

    

    //const layerPosition = new THREE.Vector3(-1.85, 1.7, -2.25);
    const layerPosition = new THREE.Vector3(-0.4, 1.35, -0.7);
    const modelLayer = renderer.xr.createQuadLayer(
        layerSize.width*0.11, layerSize.height*0.12,
        layerPosition,
        new THREE.Quaternion(),
        layerSize.width * 800, layerSize.height * 800,
        () => renderer.render(modelScene, modelCamera)
    );
    
    scene.add(modelLayer);

    const extraLayers = [];
    const layerWidthWorld = layerSize.width * 0.11;
    const gap = layerWidthWorld * 1; // small spacing between screens
    for (let i = 0; i < 5; i++) {
        const pos = new THREE.Vector3(
            layerPosition.x + (i + 1) * gap, // ⬅️ move right
            layerPosition.y,
            layerPosition.z
        );
        /*
        const layer = renderer.xr.createQuadLayer(
            layerSize.width * 0.11,
            layerSize.height * 0.12,
            pos,
            new THREE.Quaternion(),
            layerSize.width * 800,
            layerSize.height * 800,
            () => {
                const layerIndex = i;
                if (!renderOffscreenLayers[layerIndex]) return;
                renderer.render(modelScene, modelCamera);
                renderOffscreenLayers[layerIndex] = false
            }
        );
        
        scene.add(layer);
        extraLayers.push(layer);
        */
    }

    return {
        modelLayer,
        modelScene,
        modelCamera,
        worldPlane,
        viewPlane,
        helper3D,
        controls,
        renderOffscreenLayers
    };
}

function addPlaneGUIControl(plane, gui, camera, controls, name = 'Clipping Plane', planeNormal, planeConstant) {
  const folder = gui.addFolder(name);
  console.log("here");


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
        updatePlaneForMesh(globalVolumeMesh, worldPlane, planeNormal, planeConstant)
        console.log("here");

        // Check if camera is behind the plane
        const distance = plane.distanceToPoint(camera.position);

        console.log("Dist:", params.constant);
        if (distance > 0) {
            // Flip the plane to face the camera
            //plane.normal.negate();
            //plane.constant *= -1;
        }

        if (plane.helper) plane.helper.update(); // optional

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
  folder.add(params, 'constant', -5, 5, 0.01).onChange(updatePlane);

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

