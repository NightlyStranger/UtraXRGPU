import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { GUI } from 'three/addons/libs/lil-gui.module.min.js';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { Break, If, vec3, vec4, texture3D, uniform, Fn } from 'three/tsl';
import { RaymarchingBox } from 'three/addons/tsl/utils/Raymarching.js';


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

    // Clipping planes
    const worldPlane = new THREE.Plane(new THREE.Vector3(0, -1, 0), 18.0);
    const viewPlane = worldPlane.clone();
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
    modelCamera.position.set(0.0, 10.0, 50.0);

    const light1 = new THREE.DirectionalLight(0xefefff, 1.5);
    light1.position.set(1, 1, 1).normalize();
    modelScene.add(light1);

    const light2 = new THREE.DirectionalLight(0xffefef, 1.5);
    light2.position.set(-1, -1, -1).normalize();
    modelScene.add(light2);

    // GUI
    const gui = new GUI({ width: 250 });

    addPlaneGUIControl(worldPlane, gui, modelCamera, 'Local Clipping Plane');
    console.log("haha");
    /*
    const loader = new OBJLoader();
    loader.load(modelUrl, (obj) => {
        const model = obj;
        model.scale.set(0.15, 0.15, 0.15);
        model.position.set(0.0, 0.0, 0.0);
        
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
        
        //modelScene.add(model);
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
        
       

        function render() {
            renderer.render(modelScene, modelCamera);
        }
    });
    */

    function loadModel(modelUrl) {
        return new Promise((resolve, reject) => {
            const loader = new OBJLoader();
            loader.load(
            modelUrl,
            (obj) => {
                const model = obj;
                model.scale.set(0.15, 0.15, 0.15);
                model.position.set(0, 0, 0);

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

        // Usage:
        loadModel(modelUrl).then(model => {
            console.log("Model loaded", model);
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
            
        

            function render() {
                renderer.render(modelScene, modelCamera);
            }
            // Add your GUI setup or anything else here
        });

    
    // 🟦 Load and add volume in same scene
    /*
    let mesh;
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
                    //to add params
                    //gain and ramp transformation
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
        material.alphaToCoverage = true;
        mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), material);

        mesh.position.set(0, 0, 0); 
        mesh.scale.set(30, 30, 30);
        const initialRotationDeg = { x: 0, y: -180, z: 90 };

        // Convert to radians and set mesh.rotation
        mesh.rotation.set(
            THREE.MathUtils.degToRad(initialRotationDeg.x),
            THREE.MathUtils.degToRad(initialRotationDeg.y),
            THREE.MathUtils.degToRad(initialRotationDeg.z)
        );
        //modelScene.add(mesh);

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

        knotClippingGroup.add(mesh);

        render();

        function render() {
            renderer.render(modelScene, modelCamera);
        }
    });*/

    async function loadVolume() {
        const dimX = volumeDimensions.x;
        const dimY = volumeDimensions.y;
        const dimZ = volumeDimensions.z;
        const threshold = uniform(0.3);
        const steps = uniform(200);

        const response = await fetch(volumePath);
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

        const opaqueRaymarchingTexture = Fn(({ texture, steps, threshold }) => {
            const finalColor = vec4(1, 0, 0, 1).toVar();
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
        material.alphaToCoverage = true;

        const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), material);
        mesh.position.set(0, 0, 0);
        mesh.scale.set(30, 30, 30);
        const initialRotationDeg = { x: 0, y: -180, z: 90 };
        mesh.rotation.set(
            THREE.MathUtils.degToRad(initialRotationDeg.x),
            THREE.MathUtils.degToRad(initialRotationDeg.y),
            THREE.MathUtils.degToRad(initialRotationDeg.z)
        );

        // Add GUI and controls here (same as your code)
        // Add mesh to your scene:

        render();

        function render() {
            renderer.render(modelScene, modelCamera);
        }

        return mesh;  // return mesh to the caller
    }

    // Call the async loader function and then do something with the mesh
    
    loadVolume().then(mesh => {
        console.log("Volume mesh loaded", mesh);
        knotClippingGroup.add(mesh);
        // You can now safely do things with `mesh` here
    });
    

    //knotClippingGroup.add(mesh);


    
    

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
        viewPlane
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

function addPlaneGUIControl(plane, gui, camera, name = 'Clipping Plane') {
  const folder = gui.addFolder(name);
  console.log("here");


  const params = {
    normalX: plane.normal.x,
    normalY: plane.normal.y,
    normalZ: plane.normal.z,
    constant: plane.constant,
  };

  function updatePlane() {
    const n = new THREE.Vector3(params.normalX, params.normalY, params.normalZ);
    if (n.lengthSq() === 0) return; // avoid zero-length normals

    n.normalize();
    plane.normal.copy(n);
    plane.constant = params.constant;
    console.log("here");

    if (plane.helper) plane.helper.update(); // optional

    updateCameraToPlane(camera, plane);
  }

  folder.add(params, 'normalX', -1, 1, 0.01).onChange(updatePlane);
  folder.add(params, 'normalY', -1, 1, 0.01).onChange(updatePlane);
  folder.add(params, 'normalZ', -1, 1, 0.01).onChange(updatePlane);
  folder.add(params, 'constant', -50, 50, 0.01).onChange(updatePlane);

  folder.open();

  const params2 = {
    resetCameraPosition: false,
    };

    gui.add(params2, 'resetCameraPosition').name('Set Camera to (0,10,50)').onChange((value) => {
    if (value) {
        camera.position.set(0, 10, 50);
        camera.lookAt(0, 0, 0);
    }
    });

  return folder;
}

function updateCameraToPlane(camera, plane) {
    const cameraDistance = 30;
    const camPos = plane.normal.clone().multiplyScalar(cameraDistance);
    camera.position.copy(camPos);
    camera.lookAt(0, 0, 0);

    // Optional: update camera projection matrix if needed
    camera.updateProjectionMatrix();
}
