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
  cameraY = 300,
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

    const colorsMappingUniform = uniformArray(colorsMapping);
    const rangesSizeUniform = uniform(sizeCounter);
    for (let i = 0; i < maxRanges; i++) {
        rangeMins[i] = 0.0;
        rangeMaxs[i] = 1.0;
    }
    const rangeMinsUniform = uniformArray(rangeMins);
    const rangeMaxesUniform = uniformArray(rangeMaxs);
    const rangeColor = [];
    const rangeOpacity = [];
    

    // Keep references to controllers so we can destroy them on rebuild
    let rangeControllers = [];

    // show current ranges
    function rebuildRangesGUI() {
        // destroy old controllers
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
                // convert hex to THREE.Color and update your array
                colorsMapping[i].set(hex); // i is the index of the current range
            });

            // opacity slider
            const opacityCtrl = folder.add(r, 'opacity', 0, 1, 0.01).name('Opacity');
            rangeControllers.push(opacityCtrl);

            // delete button (if more than 1 range)
            if (ranges.length > 1) {
                const delObj = {
                    remove: () => {
                        if (i < ranges.length - 1) {
                            // merge into next range
                            ranges[i + 1].min = r.min;
                        } else {
                            // merge into previous if it was the last one
                            ranges[i - 1].max = r.max;
                        }
                        ranges.splice(i, 1);
                        rebuildRangesGUI();
                        // cleanup extra folders
                        for (let i = 0; i < maxRanges; i++) {
                            if (i < ranges.length) {
                                rangeMins[i] = ranges[i].min;
                                rangeMaxs[i] = ranges[i].max;
                            }
                            sizeCounter--;
                            rangesSizeUniform.value = sizeCounter;
                        }
                        while (rangesFolder.children.length > ranges.length) {
                            rangesFolder.children[0].destroy();
                        }
                    }
                };
                rangeControllers.push(folder.add(delObj, 'remove').name('Delete'));
            }
        });
    }

    // split the range that contains `value` (0 < value < 1)
    function splitAt(value) {
        if (value <= 0 || value >= 1) return; // must be strictly inside (0,1)
        for (let i = 0; i < ranges.length; i++) {
            const r = ranges[i];
            if (value > r.min && value < r.max) {
                // replace the found range with two, copying color/opacity
                const first = { min: r.min, max: value, color: r.color, opacity: r.opacity };
                const second = { min: value, max: r.max, color: r.color, opacity: r.opacity };
                ranges.splice(i, 1, first, second);
                rebuildRangesGUI();
                // return; // keep looping if needed
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
        console.log(rangeMins);
        console.log(rangeMaxs);
        console.log(sizeCounter);
    }

    // UI to choose split point and add
    const params = { value: 0.5, add: () => splitAt(params.value) };
    gui.add(params, 'value', 0, 1, 0.001).name('Split At');
    gui.add(params, 'add').name('Add Range');

    rebuildRangesGUI();
    // --- create uniforms for shader ---
    
    console.log(rangeMaxs);

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
        const size = {
            width: 240,
            height: 299,
            depth: 282
		};

        const planeNormal = uniform(worldPlane.normal);
        const planeConstant = uniform(worldPlane.constant);
        
        const cameraBoolean = uniform(0);

        
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

            //const rotatedPlane = worldPlane; // copy original
            //rotatedPlane.normal.applyQuaternion(q);  // rotate normal
            // Convert hex to THREE.Vector3 for RGB
            function hexToVec3(hex) {
                const c = new THREE.Color(hex);
                return new THREE.Vector3(c.r, c.g, c.b);
            }

            
            const volumeMaterial = new THREE.NodeMaterial();
            
            const opaqueRaymarchingTexture = Fn(({ texture, steps}) => {
                //const planeNormal = uniform(vec3(), "planeNormal");
                //const planeConstant = uniform(0, "planeConstant");
                let finalColor = vec4().toVar();;
                If(cameraBoolean.equal(0), ()=>{
                    finalColor.assign(vec4(0).toVar());
                })
                .Else(() =>{
                    finalColor.assign(vec4(1, 0, 0, 1).toVar());
                })
                
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
                    If(renderingMode.equal(0), () => {
                        If(mapValue.greaterThan(threshold).and(clip.not()), () => {
                            const p = vec3(positionRay).add(0.5);
                            //finalColor.assign(colorsMappingUniform.element(2));
                            //finalColor.r.assign(texture.normal(p).mul(0.5).add(positionRay.mul(1.5).add(0.25)));
                            Loop( rangesSizeUniform, ( { i } ) => {
                                const minVal = rangeMinsUniform.element(i);
                                const maxVal = rangeMaxesUniform.element(i);
                                If(mapValue.greaterThanEqual(minVal).and(mapValue.lessThan(maxVal)), () => {
                                    finalColor.assign(colorsMappingUniform.element(i));
                                }); 
                            } );
                            finalColor.a.assign(1)
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
                            const sampleColor = vec3(mapValue, 0, 0);
                            const sampleAlpha = mapValue;
                            const oneMinusAlpha = one.sub(accumAlpha);

                            // front-to-back compositing
                            accumColor.assign(accumColor.add(sampleColor.mul(sampleAlpha).mul(oneMinusAlpha)));
                            accumAlpha.assign(accumAlpha.add(sampleAlpha.mul(oneMinusAlpha)));

                            // early exit if almost opaque
                            If(accumAlpha.greaterThan(0.95), () => { Break(); });
                        });

                    });
                    


                });

                If((renderingMode.equal(0)), ()=> {
                    
                });

                
                If(accum.greaterThan(threshold).and(renderingMode.equal(1)), ()=> {
                    opacity.assign(1.0);
                    finalColor.r.assign(accum);
                    finalColor.a.assign(opacity);
                });
                If((renderingMode.equal(2)), ()=> {
                    finalColor.r.assign(accumColor);
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





            // Add GUI and controls here (same as your code)


            // Add mesh to your scene:





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

            // Wait for all models to load
            const models = await Promise.all(modelPromises);

            // Now models[0] is Frame01, models[1] is Frame02, etc.
            return models;
        }

        let clock = new THREE.Clock();
        let models;
        let frameCount = 4;

        loadAllModels().then(loadedModels => {
            models = loadedModels;
            // Add all models to the scene but hide them initially
            models.forEach(model => {
                model.visible = false;
                //modelScene.add(model);
                //knotClippingGroup.add(model);
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

        function animate() {
            requestAnimationFrame(animate);

            if (models) {
                const elapsed = clock.getElapsedTime(); 
                const currentFrame = Math.floor(elapsed) % frameCount;

                models.forEach((model, i) => {
                    model.visible = (i === currentFrame);
                });
            }
            
            if (volumes) {
                const elapsed = clock.getElapsedTime(); // seconds
                const currentFrame = Math.floor(elapsed) % frameCount;

                volumes.forEach((volume, i) => {
                    volume.visible = (i === currentFrame);
                });
            }

            renderer.renderAsync(modelScene, modelCamera);
        }

        animate();


        /*
        loadModel(modelUrl).then(model => {
            console.log("Model loaded", model);
            // Position folder
            
            const posFolder = gui.addFolder('Model Position');
            posFolder.add(model.position, 'x', -5, 5, 0.1).onChange(render);
            posFolder.add(model.position, 'y', -5, 5, 0.1).onChange(render);
            posFolder.add(model.position, 'z', -5, 5, 0.1).onChange(render);
            posFolder.open();

            // Scale folder
            const scaleFolder = gui.addFolder('Model Scale');
            scaleFolder.add(model.scale, 'x', 0.001, 2, 0.0005).onChange(render);
            scaleFolder.add(model.scale, 'y', 0.001, 2, 0.0005).onChange(render);
            scaleFolder.add(model.scale, 'z', 0.001, 2, 0.0005).onChange(render);
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

            //Camera gui
            // Position folder
            const camPosFolder = gui.addFolder('Camera Position');
            camPosFolder.add(modelCamera.position, 'x', -1000, 1000, 0.1).name('X');
            camPosFolder.add(modelCamera.position, 'y', -1000, 1000, 0.1).name('Y');
            camPosFolder.add(modelCamera.position, 'z', -1000, 1000, 0.1).name('Z');
            camPosFolder.open();

            // Rotation folder (in degrees)
            const camRotDegrees = {
                x: THREE.MathUtils.radToDeg(modelCamera.rotation.x),
                y: THREE.MathUtils.radToDeg(modelCamera.rotation.y),
                z: THREE.MathUtils.radToDeg(modelCamera.rotation.z)
            };

            const camRotFolder = gui.addFolder('Camera Rotation');
            camRotFolder.add(camRotDegrees, 'x', -180, 180, 1).name('X (°)').onChange(v => {
                modelCamera.rotation.x = THREE.MathUtils.degToRad(v);
            });
            camRotFolder.add(camRotDegrees, 'y', -180, 180, 1).name('Y (°)').onChange(v => {
                modelCamera.rotation.y = THREE.MathUtils.degToRad(v);
            });
            camRotFolder.add(camRotDegrees, 'z', -180, 180, 1).name('Z (°)').onChange(v => {
                modelCamera.rotation.z = THREE.MathUtils.degToRad(v);
            });
            camRotFolder.open();
            

            
            knotClippingGroup.add(model);
            





            // Call the async loader function and then do something with the mesh


            


            loadVolume(volumePath).then(mesh => {


                console.log("Volume mesh loaded", mesh);


                //knotClippingGroup.add(mesh);
                modelScene.add(mesh)


                // You can now safely do things with `mesh` here


            });
                    
                     
            
        

            function render() {
                renderer.render(modelScene, modelCamera);

            }
            // Add your GUI setup or anything else here
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
        modelCamera,
        worldPlane,
        viewPlane,
        helper3D,
        controls
    };
}

function addPlaneMeshWithClipping({ name = 'Plane', scene, gui, clippingGroup }) {
  if (!scene || !gui || !clippingGroup) {
    console.error('scene, gui, and clippingGroup are required');
    return;
  }

  // Create plane mesh
  const geometry = new THREE.PlaneGeometry(2, 2);
  const material = new THREE.MeshBasicMaterial({
    color: 0x00ff00,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.5,
  });
  const planeMesh = new THREE.Mesh(geometry, material);

  planeMesh.scale.set(10, 10, 10);
  planeMesh.rotation.x = Math.PI / 2; // rotated along X as you said

  scene.add(planeMesh);

  // Create a clipping plane with a default normal and constant (will update)
  const clippingPlane = new THREE.Plane(new THREE.Vector3(1, 0, 0), 0);

  // Add to the clipping group
  clippingGroup.clippingPlanes.push(clippingPlane);

  // GUI params initialized from mesh
  const folder = gui.addFolder(name);
  const params = {
    posX: planeMesh.position.x,
    posY: planeMesh.position.y,
    posZ: planeMesh.position.z,
    rotX: planeMesh.rotation.x,
    rotY: planeMesh.rotation.y,
    rotZ: planeMesh.rotation.z,
  };

  // Position controls
  folder.add(params, 'posX', -10, 10, 0.01).onChange(v => planeMesh.position.x = v);
  folder.add(params, 'posY', -10, 10, 0.01).onChange(v => planeMesh.position.y = v);
  folder.add(params, 'posZ', -10, 10, 0.01).onChange(v => planeMesh.position.z = v);

  // Rotation controls (radians)
  folder.add(params, 'rotX', -Math.PI, Math.PI, 0.01).onChange(v => planeMesh.rotation.x = v);
  folder.add(params, 'rotY', -Math.PI, Math.PI, 0.01).onChange(v => planeMesh.rotation.y = v);
  folder.add(params, 'rotZ', -Math.PI, Math.PI, 0.01).onChange(v => planeMesh.rotation.z = v);

  folder.open();

  // Update clipping plane each frame or on change
  function updateClippingPlane() {
    // Update world matrix
    planeMesh.updateWorldMatrix(true, false);

    // Plane normal in world space: local plane normal is (0,0,1) for PlaneGeometry by default
    const normal = new THREE.Vector3(0, 0, 1);
    normal.applyQuaternion(planeMesh.getWorldQuaternion(new THREE.Quaternion())).normalize();

    // Plane constant = -normal.dot(point on plane)
    const worldPosition = new THREE.Vector3();
    planeMesh.getWorldPosition(worldPosition);
    const constant = -normal.dot(worldPosition);

    clippingPlane.normal.copy(normal);
    clippingPlane.constant = constant;
  }

  // Call once initially
  updateClippingPlane();

  // Whenever params change, update plane
  folder.onChange(updateClippingPlane);

  // Also update on animation loop for smooth updates if you move plane dynamically
  return { planeMesh, clippingPlane, updateClippingPlane };
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

function updateCameraToPlane(camera, plane) {
    const cameraDistance = 30;
    const camPos = plane.normal.clone().multiplyScalar(cameraDistance);
    camera.position.copy(camPos);
    camera.lookAt(0, 0, 0);
    //to do orbit
    //change sign of normal + const when camera is in negative half-space
    //camera of pos of controller, plane on joystick - a/b - const, rotation

    // Optional: update camera projection matrix if needed
    camera.updateProjectionMatrix();
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
