import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { GUI } from 'three/addons/libs/lil-gui.module.min.js';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { Break, If, texture3D, uniform, Fn, cameraProjectionMatrix, 
       modelViewMatrix,float, vec3, vec4,positionLocal, mul, cameraPosition, modelWorldMatrixInverse, Loop, max,
       uniformArray} from 'three/tsl';
import { RaymarchingBox } from 'three/addons/tsl/utils/Raymarching.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { loadFBX } from './fbxLoader.js';
import { HTMLMesh } from 'three/addons/interactive/HTMLMesh.js';

// Clipping planes
const worldPlane = new THREE.Plane(new THREE.Vector3(1, -0.15, 0), 0.0);
const viewPlane = worldPlane.clone();
let globalVolumeMesh;

export function initModelLayer(renderer, scene, {
  modelUrl,
  volumePath = 'volumes/Frame01/Volume.downsampled.raw',
  volumeDimensions = { x: 240, y: 299, z: 282 },
  position = new THREE.Vector3(-1.5, 1.5, -1.5),
  layerSize = { width: 1, height: 1 },
  guiGroup,
  backgroundColor = 0xf0f0f0,
  onLoad = () => {}
} = {}) {

    const modelScene = new THREE.Scene();
    let helper3D;

    // Clipping Groups

    const globalClippingGroup = new THREE.ClippingGroup();
    globalClippingGroup.clippingPlanes = [];

    const knotClippingGroup = new THREE.ClippingGroup();
    knotClippingGroup.clippingPlanes = [worldPlane];
    knotClippingGroup.clipIntersection = true;

    modelScene.add( globalClippingGroup );
    globalClippingGroup.add( knotClippingGroup );


    modelScene.background = new THREE.Color(backgroundColor);
    const modelCamera = new THREE.PerspectiveCamera(50, 1, 1, 10000);

    modelCamera.position.set(0.0, 0.0, 3.0);
    const controls = new OrbitControls(modelCamera, renderer.domElement);
    controls.target.set(0, 0, 0);
    controls.update();
    controls.addEventListener('change', () => {
                
    });
    //controls.enabled = false;

    const light1 = new THREE.DirectionalLight(0xefefff, 1.5);
    light1.position.set(1, 1, 1).normalize();
    modelScene.add(light1);

    const light2 = new THREE.DirectionalLight(0xffefef, 1.5);
    light2.position.set(-1, -1, -1).normalize();
    modelScene.add(light2);

    // GUI
    const gui = new GUI({ width: 250 });
    

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
                model.scale.set(0.007, 0.007, 0.007);
                model.position.set(0, -0.5, 0);

                const cherryMaterial = new THREE.MeshPhysicalMaterial({
                    color: new THREE.Color(0xff0055),
                    metalness: 0.5,
                    roughness: 0.05,
                    transmission: 1.0,
                    thickness: 1.0,
                    transparent: true,
                    opacity: 0.6,
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
                            
                            Loop( rangesSizeUniform, ( { i } ) => {
                                const minVal = rangeMinsUniform.element(i);
                                const maxVal = rangeMaxesUniform.element(i);
                                If(mapValue.greaterThanEqual(minVal).and(mapValue.lessThan(maxVal)), () => {
                                    sampleColor.assign(colorsMappingUniform.element(i));
                                    sampleAlpha.assign(opacityMappingUniform.element(i));
                                }); 
                            } );
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
            mesh.position.set(0, 0, 0);
            mesh.scale.set(2, 2, 2);
            const initialRotationDeg = { x: 0, y: 0, z: 90 };
            mesh.rotation.set(
                THREE.MathUtils.degToRad(initialRotationDeg.x),
                THREE.MathUtils.degToRad(initialRotationDeg.y),
                THREE.MathUtils.degToRad(initialRotationDeg.z)
            );
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
                renderer.renderAsync(modelScene, modelCamera);
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
            models.forEach(model => {
                model.visible = false;
                //modelScene.add(model);
                knotClippingGroup.add(model);
            });
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

        function animate() {
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
                });
            }

            if (volumes) {
                volumes.forEach((volume, i) => {
                    volume.visible = (i === currentFrame);
                });
            }


            renderer.renderAsync(modelScene, modelCamera);
        }

        animate();

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
        modelCamera,
        worldPlane,
        viewPlane,
        helper3D,
        controls
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
  };

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
    }

    //updateCameraToPlane(camera, plane);
  }

  folder.add(params, 'normalX', -1, 1, 0.01).onChange(updatePlane);
  folder.add(params, 'normalY', -1, 1, 0.01).onChange(updatePlane);
  folder.add(params, 'normalZ', -1, 1, 0.01).onChange(updatePlane);
  folder.add(params, 'constant', -5, 5, 0.01).onChange(updatePlane);

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