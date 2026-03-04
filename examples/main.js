import * as THREE from 'three';

import { BoxLineGeometry } from 'three/addons/geometries/BoxLineGeometry.js';
import { VRButton } from 'three/addons/webxr/VRButton.js';
import { XRControllerModelFactory } from 'three/addons/webxr/XRControllerModelFactory.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { initGUILayer } from './initGUILayer.js';
import { initModelLayer } from './initModelLayer.js';
import { TextureHelper } from 'three/addons/helpers/TextureHelperGPU.js';
import { Break, If, vec3, vec4, texture3D, uniform, Fn, Continue, diffuseColor, attribute } from 'three/tsl';
import { GUI } from 'three/addons/libs/lil-gui.module.min.js';
import { loadFBX } from './fbxLoader.js';
import {createGreenBox } from './dvrRendring.js'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { SphericalPlaneControls } from './SphericalPlaneControls.js';
import { setupVRGUI, updateStats, initFBX, createHeartViewUI, setupStats  } from './vrEngine.js';
import { InteractiveGroup } from 'three/addons/interactive/InteractiveGroup.js';
import { addQuad } from './intersectionHelper.js';

let camera, scene, renderer;
let controller1, controller2;
let controllerGrip1, controllerGrip2;
let gModelsFunction;

const heartUIState = {
    threshold: 0.5,
    taskIndex: -1,
    cameraMutable: false
};

let room;

let count = 0;
const PI2 = Math.PI * 2;
const tempMatrix = new THREE.Matrix4();
let raycaster = null;

let quad;
const normal = new THREE.Vector3();
const point  = new THREE.Vector3();
const invCube1Matrix = new THREE.Matrix4();

let gWorldPlane;
let gRefferencePlane;

let gWMatrix1;
let gWMatrix2;

//clipping camera setting
let clippingCamera = null;
let clippingWorldPlane = null;
let clippingViewPlane = null;
let helperVolume;
let sphereControls;
let nextLayerIndex = 0;
let globalRenderOffscreenLayers;

let volMesh = null;


let guiScene = null;
let guiCamera = null;
//let guiGroup = null;

let horseLayer = null;
//let guiLayer = null;


let sphere;
const gui = new GUI();

init();

function getIntersections( controller ) {

    tempMatrix.identity().extractRotation( controller.matrixWorld );

    raycaster.ray.origin.setFromMatrixPosition( controller.matrixWorld );
    raycaster.ray.direction.set( 0, 0, - 1 ).applyMatrix4( tempMatrix );

    return raycaster.intersectObjects( scene.children, false );

}

function init() {

    scene = new THREE.Scene();
    scene.background = new THREE.Color( 0x505050 );

    raycaster = new THREE.Raycaster();

    camera = new THREE.PerspectiveCamera( 50, window.innerWidth / window.innerHeight, 0.1, 10 );
    camera.position.set( 0.0, 1.7, 0.97 );
    // Set position
    /*camera.position.set(0, 3, 1);

    // Set rotation in degrees
    camera.rotation.set(
        THREE.MathUtils.degToRad(-90), // X
        THREE.MathUtils.degToRad(0),   // Y
        THREE.MathUtils.degToRad(0)    // Z
    );
    */
    
    //0 3 1, -90 0 0
    // Camera parameters for GUI
    const cameraParams = {
        posX: camera.position.x,
        posY: camera.position.y,
        posZ: camera.position.z,
        rotX: THREE.MathUtils.radToDeg(camera.rotation.x),
        rotY: THREE.MathUtils.radToDeg(camera.rotation.y),
        rotZ: THREE.MathUtils.radToDeg(camera.rotation.z)
    };

    // Create GUI folder
    const cameraFolder = gui.addFolder('Camera Transform');

    // --- POSITION ---
    cameraFolder.add(cameraParams, 'posX', -1, 3, 0.01).name('X').onChange(() => {
        camera.position.x = cameraParams.posX;
    });
    cameraFolder.add(cameraParams, 'posY', -1, 3, 0.01).name('Y').onChange(() => {
        camera.position.y = cameraParams.posY;
    });
    cameraFolder.add(cameraParams, 'posZ', -1, 3, 0.01).name('Z').onChange(() => {
        camera.position.z = cameraParams.posZ;
    });

    // --- ROTATION (degrees)
    cameraFolder.add(cameraParams, 'rotX', -180, 180, 0.1).name('Rot X').onChange(() => {
        camera.rotation.x = THREE.MathUtils.degToRad(cameraParams.rotX);
    });
    cameraFolder.add(cameraParams, 'rotY', -180, 180, 0.1).name('Rot Y').onChange(() => {
        camera.rotation.y = THREE.MathUtils.degToRad(cameraParams.rotY);
    });
    cameraFolder.add(cameraParams, 'rotZ', -180, 180, 0.1).name('Rot Z').onChange(() => {
        camera.rotation.z = THREE.MathUtils.degToRad(cameraParams.rotZ);
    });

    cameraFolder.open();

    //camera.position.set( 0, 0, 3 );

    
    

    room = new THREE.LineSegments(
        new BoxLineGeometry( 6, 6, 6, 10, 10, 10 ),
        new THREE.LineBasicMaterial( { color: 0x808080 } )
    );
    room.geometry.translate( 0, 3, 0 );
    //scene.add( room );
    //fbx room
    async function initFBX() {
        try {
            const { object } = await loadFBX(
                scene,
                gui,
                'meshes/fbx/reduced_ultrasound_machine_transparent.fbx'
            );

            console.log('FBX loaded:', object);
            
            const params = {
            showMesh: object.visible
        };

        const meshFolder = gui.addFolder('FBX Model');
        
        meshFolder.add(params, 'showMesh')
            .name('Display Model')
            .onChange((value) => {
                object.visible = value;
            });

        meshFolder.open();

        } catch (err) {
            console.error('Error loading FBX:', err);
        }
    }

    initFBX();

    const sphereGeometry = new THREE.SphereGeometry(0.2, 32, 32);
    const sphereMaterial = new THREE.MeshStandardMaterial({ color: 'red' });
    sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
    sphere.position.set(0.5, 1.0, -0.5);
    //scene.add(sphere);

    const sphereFolder = gui.addFolder('Sphere Position');

    sphereFolder.add(sphere.position, 'x', -10, 10, 0.01).name('X');
    sphereFolder.add(sphere.position, 'y', -10, 10, 0.01).name('Y');
    sphereFolder.add(sphere.position, 'z', -10, 10, 0.01).name('Z');

    sphereFolder.open();


    scene.add( new THREE.HemisphereLight( 0x606060, 0x404040 ) );

    const light = new THREE.DirectionalLight( 0xffffff );
    light.position.set( 1, 1, 1 ).normalize();
    scene.add( light );

    //

    renderer = new THREE.WebGPURenderer( { antialias: true, forceWebGL: true, colorBufferType: THREE.UnsignedByteType, multiview: true } );
    renderer.setPixelRatio( 0.5  * window.devicePixelRatio );
    renderer.setSize( window.innerWidth, window.innerHeight );
    renderer.setAnimationLoop( render );
    renderer.xr.enabled = true;
    document.body.appendChild( renderer.domElement );
    //renderer.inspector = new Inspector(); 

    //

    createGreenBox(renderer, scene, camera);

    document.body.appendChild( VRButton.createButton( renderer ) );

    // ✅ OrbitControls
    //const orbitControls = new OrbitControls(camera, renderer.domElement);
    //orbitControls.update();

    // controllers

    function onSqueezeStart( ) {

        this.userData.isSelecting = true;

    }

    function onSqueezeEnd() {

        this.userData.isSelecting = false;

    }

    function onSelectStart( event ) {

        const controller = event.target;

        const intersections = getIntersections( controller );
        let hadSelection = false;

        for ( let x = 0; x < intersections.length; x ++ ) {
            /*
            if ( intersections[ x ].object == horseLayer ) {

                horseLayer.visible = false;
                hadSelection = true;

            }
            */

            /*
            if ( intersections[ x ].object == guiLayer ) {

                const uv = intersections[ x ].uv;
                guiGroup.children[ 0 ].dispatchEvent( { type: 'mousedown', data: { x: uv.x, y: 1 - uv.y }, target: guiGroup } );
                hadSelection = true;

            }
            */

        }

        this.userData.isSelecting = hadSelection === false;

    }

    function onSelectEnd( ) {

        //horseLayer.visible = true;
        //guiGroup.children[ 0 ].dispatchEvent( { type: 'mouseup', data: { x: 0, y: 0 }, target: guiGroup } );
        this.userData.isSelecting = false;

    }
    const scanWidth  = 0.08;
    const scanHeight = 0.12;
    const quadGeometry = new THREE.PlaneGeometry(scanWidth, scanHeight);

    // Simple unlit material (good for XR controllers)
    const quadMaterial = new THREE.MeshBasicMaterial({
        color: 0x66ffcc,
        transparent: true,
        opacity: 0.25,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide
    });

    quad = new THREE.Mesh(quadGeometry, quadMaterial);

    // Optional: move it forward so it’s visible
    quad.position.z = -0.08;
    quad.position.y = -scanHeight * 0.5;
    quad.rotation.set(-Math.PI / 2, 0, 0);

    controller1 = renderer.xr.getController( 0 );
    // Quad geometry (width, height)
    
    //controller1.add( quad );
    /*
    controller1.addEventListener( 'selectstart', onSelectStart );
    controller1.addEventListener( 'selectend', onSelectEnd );
    controller1.addEventListener( 'squeezestart', onSqueezeStart );
    controller1.addEventListener( 'squeezeend', onSqueezeEnd );
    */
    controller1.addEventListener( 'connected', function ( event ) {

        this.add( buildController( event.data ) );

    } );
    controller1.addEventListener( 'disconnected', function () {

        this.remove( this.children[ 0 ] );

    } );
    scene.add( controller1 );

    controller2 = renderer.xr.getController( 1 );
    controller2.add(quad);
    /*
    controller2.addEventListener( 'selectstart', onSelectStart );
    controller2.addEventListener( 'selectend', onSelectEnd );
    controller2.addEventListener( 'squeezestart', onSqueezeStart );
    controller2.addEventListener( 'squeezeend', onSqueezeEnd );
    */
    controller2.addEventListener( 'connected', function ( event ) {

        this.add( buildController( event.data ) );

    } );
    controller2.addEventListener( 'disconnected', function () {

        this.remove( this.children[ 0 ] );

    } );
    scene.add( controller2 );

    // The XRControllerModelFactory will automatically fetch controller models
    // that match what the user is holding as closely as possible. The models
    // should be attached to the object returned from getControllerGrip in
    // order to match the orientation of the held device.

    const controllerModelFactory = new XRControllerModelFactory();

    controllerGrip1 = renderer.xr.getControllerGrip( 0 );
    controllerGrip1.add( controllerModelFactory.createControllerModel( controllerGrip1 ) );
    scene.add( controllerGrip1 );

    controllerGrip2 = renderer.xr.getControllerGrip( 1 );
    controllerGrip2.add( controllerModelFactory.createControllerModel( controllerGrip2 ) );
    scene.add( controllerGrip2 );

    //  

    window.addEventListener( 'resize', onWindowResize );

    

    // set up horse animation
    //Adding interactive group
    const intGroup = new InteractiveGroup();
    intGroup.listenToPointerEvents(renderer, camera);
    intGroup.listenToXRControllerEvents(controller1);
    intGroup.listenToXRControllerEvents(controller2);
    scene.add(intGroup);

    const { 
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
        guiGroup, 
        renderOffscreenLayers
    } = initModelLayer(
        gui,
        renderer, scene, {
        modelUrl: 'meshes/Frame01/MeshesZ0.obj',
        position: new THREE.Vector3(-1.5, 1.5, -1.5),
        layerSize: { width: 3, height: 2 },
        guiGroup: intGroup,
        onLoad: (model) => {
            console.log('Model loaded:', model);
        }
    });
    gModelsFunction = animate;
    gWMatrix1 = new THREE.Matrix4();

    gWMatrix1.set(
        4.440892098500626e-18,  1.224646799147353e-18,  0.02,  0,
    -1.232595164407831e-34,  0.02, -1.224646799147353e-18,  0,
    -0.02,                  1.232595164407831e-34,  4.440892098500626e-18,  0,
        0,                      0,                      0,  1
    );
    gWMatrix2 = new THREE.Matrix4();
    const m = new THREE.Matrix4().set(
        2.220446049250313e-19,  6.123233995736765e-20,  0.001,  0,
    -6.162975822039155e-36,  0.001,                -6.123233995736765e-20,  0,
    -0.001,                 6.162975822039155e-36,  2.220446049250313e-19,  0,
        0.5,                   1.2,                  -0.55,                 1
    );
    gWorldPlane = worldPlane;
    gRefferencePlane = refferencePlane;
    const planeParams = {
        nx: gRefferencePlane.normal.x,
        ny: gRefferencePlane.normal.y,
        nz: gRefferencePlane.normal.z,
        constant: gRefferencePlane.constant,
    };

    function updatePlaneFromGUI() {
        gRefferencePlane.normal.set(
            planeParams.nx,
            planeParams.ny,
            planeParams.nz
        );

        // Always normalize normals
        gRefferencePlane.normal.normalize();

        gRefferencePlane.constant = planeParams.constant;

        console.log('Plane updated:', gRefferencePlane);
    }

    const planeFolder = gui.addFolder('Reference Plane');

    // Normal
    planeFolder.add(planeParams, 'nx', -1, 1, 0.001)
        .name('Normal X')
        .onChange(updatePlaneFromGUI);

    planeFolder.add(planeParams, 'ny', -1, 1, 0.001)
        .name('Normal Y')
        .onChange(updatePlaneFromGUI);

    planeFolder.add(planeParams, 'nz', -1, 1, 0.001)
        .name('Normal Z')
        .onChange(updatePlaneFromGUI);

    // Constant
    planeFolder.add(planeParams, 'constant', -1, 1, 0.001)
        .name('Constant')
        .onChange(updatePlaneFromGUI);

    planeFolder.open();


    animParams.frame = 0;
    animate(false);
    setupStats(intGroup);
    createHeartViewUI(scene, intGroup, heartUIState, threshold, animParams, animate);

    //addQuad(scene);
    clippingCamera = modelCamera;
    clippingWorldPlane = worldPlane;
    clippingViewPlane = viewPlane;
    helperVolume = helper3D;
    globalRenderOffscreenLayers = renderOffscreenLayers;


    /*sphereControls = new SphericalPlaneControls(worldPlane, {
        center: new THREE.Vector3(0, 0, 0),
        radius: 3,
        speed: 0.03,
        radiusStep: 0.1
    });
    */

    //offscreenLayer = modelLayer;
    // Offscreen Layer Transform folder
    /*
    const offscreenFolder = gui.addFolder("Offscreen Layer Transform");

    // Position folder with unique names
    const offscreenPosFolder = offscreenFolder.addFolder("Layer Translation (Offscreen)");
    offscreenPosFolder.add(modelLayer.position, "x").name("Offscreen X").min(-5).max(5).step(0.1);
    offscreenPosFolder.add(modelLayer.position, "y").name("Offscreen Y").min(-5).max(5).step(0.1);
    offscreenPosFolder.add(modelLayer.position, "z").name("Offscreen Z").min(-5).max(5).step(0.1);

    // Size folder with unique names
    const offscreenSizeParams = {
        offscreenWidth: modelLayer.scale.x,
        offscreenHeight: modelLayer.scale.y
    };
    const offscreenSizeFolder = offscreenFolder.addFolder("Layer Dimensions (Offscreen)");
    offscreenSizeFolder.add(offscreenSizeParams, "offscreenWidth").name("Width Scale").min(0.1).max(10).step(0.1).onChange(v => {
        modelLayer.scale.x = v;
    });
    offscreenSizeFolder.add(offscreenSizeParams, "offscreenHeight").name("Height Scale").min(0.1).max(10).step(0.1).onChange(v => {
        modelLayer.scale.y = v;
    });
    */

    function onChange() { }

    function onThicknessChange() { }

    // set up ui
    //Lambda-functions can be passed
    

    //const guiObj = initGUILayer(renderer, scene, parameters, onChange, onThicknessChange);
    /*setupVRGUI(
					scene,
					renderer,
					camera,
					controller1,
					controller2,
					parameters,
					onChange,
					onThicknessChange
	);
    */
    
    
}





function buildController( data ) {

    let geometry, material;

    switch ( data.targetRayMode ) {

        case 'tracked-pointer':

            geometry = new THREE.BufferGeometry();
            geometry.setAttribute( 'position', new THREE.Float32BufferAttribute( [ 0, 0, 0, 0, 0, - 1 ], 3 ) );
            geometry.setAttribute( 'color', new THREE.Float32BufferAttribute( [ 0.5, 0.5, 0.5, 0, 0, 0 ], 3 ) );

            material = new THREE.LineBasicMaterial( { vertexColors: true, blending: THREE.AdditiveBlending } );

            return new THREE.Line( geometry, material );

        case 'gaze':

            geometry = new THREE.RingGeometry( 0.02, 0.04, 32 ).translate( 0, 0, - 1 );
            material = new THREE.MeshBasicMaterial( { opacity: 0.5, transparent: true } );
            return new THREE.Mesh( geometry, material );

    }

}

function onWindowResize() {

    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();

    renderer.setSize( window.innerWidth, window.innerHeight );

}

function handleController( controller ) {

    /*
    if ( controller.userData.isSelecting ) {

        const object = room.children[ count ++ ];

        object.position.copy( controller.position );
        object.userData.velocity.x = ( Math.random() - 0.5 ) * 3;
        object.userData.velocity.y = ( Math.random() - 0.5 ) * 3;
        object.userData.velocity.z = ( Math.random() - 9 );
        object.userData.velocity.applyQuaternion( controller.quaternion );

        if ( count === room.children.length ) count = 0;

    }
    

    const intersections = getIntersections( controller );
    for ( let x = 0; x < intersections.length; x ++ ) {
        
        if ( intersections[ x ].object == guiLayer ) {

            const uv = intersections[ x ].uv;
            guiGroup.children[ 0 ].dispatchEvent( { type: 'mousemove', data: { x: uv.x, y: 1 - uv.y }, target: guiGroup } );

        }
        


    }
    */

    //===Sphere intersection

    //
    const controllerPos = controller.position.clone();

    const spherePos = sphere.position;
    const radius = 0.2;
    const d1 = controllerPos.distanceTo(spherePos);
    const d2 = controllerPos.distanceTo(spherePos);
    // 🔺 Vector from sphere center to controller
    const intersected = d1 < radius || d2 < radius;

    if (intersected) {
        // Inside or touching
        sphere.material.color.set('green');

        const offset = new THREE.Vector3().subVectors(controllerPos, sphereCenter);
        const radius = offset.length(); // distance from center to controller

        // Avoid division by zero
        if (radius > 0) {
            const theta = Math.atan2(offset.x, offset.z);       // horizontal angle
            const phi = Math.acos(offset.y / radius);           // vertical angle

            console.log("θ (azimuthal):", THREE.MathUtils.radToDeg(theta));
            console.log("φ (polar):", THREE.MathUtils.radToDeg(phi));
            if (controls != null) {
                //controls.setAzimuthalAngle(theta);
                //controls.setPolarAngle(phi);
            }

            controls.update();
        }
        //controls
    } else {
        // Outside
        sphere.material.color.set('red');
    }
        


}

//

let prevControllerPos = new THREE.Vector3();
let hasPrev = false;

function render() {

    renderer.xr.renderLayers( );

   // Get current controller position
   // Get current position of controller1 in world space
    //gModelsFunction();
    const currentPos = new THREE.Vector3();
    controller1.getWorldPosition(currentPos);
    const session = renderer.xr.getSession();
    if (session) {
        for (const source of session.inputSources) {
            const gp = source.gamepad;
            if (gp) {
                const aPressed = gp.buttons[4]?.pressed ?? false;
                const bPressed = gp.buttons[5]?.pressed;
                if (!aPressed ) {
                    // A not pressed → disable all layers
                    for (let i = 0; i < globalRenderOffscreenLayers.length; i++) {
                        globalRenderOffscreenLayers[i] = false;
                    }
                } else if (aPressed){
                    // A pressed → enable only selected task
                    if (heartUIState.taskIndex >= 0) {
                        for (let i = 0; i < globalRenderOffscreenLayers.length; i++) {
                            globalRenderOffscreenLayers[i] = (i === heartUIState.taskIndex);
                        }

                        console.log(`Layer ${heartUIState.taskIndex} enabled`);
                    }
                }
                if (bPressed) {    
                    scene.updateMatrixWorld(true);                
                    quad.getWorldPosition(point);
                    quad.getWorldDirection(normal);
                    normal.normalize();
                    normal.negate();
                    gRefferencePlane.setFromNormalAndCoplanarPoint(normal, point);
                    gModelsFunction(heartUIState.cameraMutable);
                } 

                /*
                if (aPressed) {
                        globalRenderOffscreenLayers[heartUIState.taskIndex] = true;
                        console.log(`Layer ${heartUIState.taskIndex} enabled`);
                    } else if (bPressed) {
                    console.log("🅱️ B button is pressed");
                    sphere.material.color.set('yellow');
                    clippingWorldPlane.constant += 0.01; // Increase clipping plane
                } else {
                    sphere.material.color.set('red');
                }
                prevAPressed = aPressed;
                */

            }
        }
    }

    window.addEventListener('keydown', (e) => {
                    if (e.repeat) return; // prevent auto-repeat spam

                    if (e.code === 'KeyN') {
                            if (nextLayerIndex >= globalRenderOffscreenLayers.length) {
                            console.log('All layers already enabled');
                            return;
                        }

                        globalRenderOffscreenLayers[nextLayerIndex] = true;
                        console.log(`Layer ${nextLayerIndex + 1} enabled`);
                        nextLayerIndex++;
                    }
                });

    //handleController( controller1 );
    //handleController( controller2 );
    
    //sphereControls.update();

    renderer.render( scene, camera );
    updateStats();

}