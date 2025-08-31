import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { GUI } from 'three/addons/libs/lil-gui.module.min.js';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { Break, If, vec3, vec4, texture3D, uniform, Fn, Continue, diffuseColor, attribute, float, abs, sin, cos,
    lessThan, mat3, mat4, mul, bool, sub, rotate} from 'three/tsl';
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
    //orthocamera
    //threshold
    const modelCamera = new THREE.PerspectiveCamera(50, 1, 1, 10000);
    //const cameraUniform = 

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


            const threshold = uniform(0.4);
            const steps = uniform(200);
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

            
            
            
            const opaqueRaymarchingTexture = Fn(({ texture, steps, threshold}) => {
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



                RaymarchingBox(steps, ({ positionRay }) => {

                    let transformedPos = positionRay; // move origin to center of box
                    //transformedPos = rotate(transformedPos, vec3(0, 0, Math.PI / 2));
                    transformedPos = transformedPos.add(0.5); // move back
                    const mapValue = texture.sample(transformedPos).r.toVar();

                    const clip = clipByPlane({
                        point: positionRay, // or your worldPos if you have it
                        n: planeNormal,
                        c: planeConstant
                    });


                    If(mapValue.greaterThan(threshold).and(clip.not()), () => {

                        
                        const p = vec3(positionRay).add(0.5);


                        finalColor.rgb.assign(texture.normal(p).mul(0.5).add(positionRay.mul(1.5).add(0.25)));


                        finalColor.a.assign(1);
                        
                       // Map value to intensity between 0.2–1.0
                        // Shades of red (crimson-like)
                        /*
                        finalColor.rgb.assign(vec3(
                            mapValue,                  // red intensity from value
                            0,         // a little green for crimson tint
                            0         // a little blue for crimson tint
                        ));

                        // Opacity follows intensity
                        finalColor.a.assign(1);
                        */


                        Break();


                    });


                });


                return finalColor;


            });





            const volumeMaterial = new THREE.NodeMaterial();

            volumeMaterial.colorNode = opaqueRaymarchingTexture({


                texture: texture3D(texture, null, 0),


                steps,


                threshold



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