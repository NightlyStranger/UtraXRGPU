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
import { setupVRGUI, updateStats, initFBX  } from './vrEngine.js';
import { InteractiveGroup } from 'three/addons/interactive/InteractiveGroup.js';

let camera, scene, renderer;
let controller1, controller2;
let controllerGrip1, controllerGrip2;

let room;

let count = 0;
const PI2 = Math.PI * 2;
const tempMatrix = new THREE.Matrix4();
let raycaster = null;

let horseCamera = null;
let horseScene = null;
let horseMixer = null;
let horseTheta = 0;
let horseMesh = null;
const horseRadius = 600;

//clipping camera setting
let clippingCamera = null;
let clippingWorldPlane = null;
let clippingViewPlane = null;
let helperVolume;
let sphereControls;

let volMesh = null;


let guiScene = null;
let guiCamera = null;
//let guiGroup = null;

let horseLayer = null;
//let guiLayer = null;

const parameters = {
    radius: 0.6,
    tube: 0.2,
    tubularSegments: 150,
    radialSegments: 20,
    p: 2,
    q: 3,
    thickness: 0.5,
    parhaha: 0.5
};
let sphere;
const gui = new GUI();
let globalControls;
let offscreenLayer;

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
    camera.position.set( 0, 1.6, 3 );

    
    

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
                'meshes/fbx/reduced221.fbx'
            );

            console.log('FBX loaded:', object);

        } catch (err) {
            console.error('Error loading FBX:', err);
        }
    }

    //initFBX();

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
    renderer.setPixelRatio( window.devicePixelRatio );
    renderer.setSize( window.innerWidth, window.innerHeight );
    renderer.setAnimationLoop( render );
    renderer.xr.enabled = true;
    document.body.appendChild( renderer.domElement );

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

    controller1 = renderer.xr.getController( 0 );
    controller1.addEventListener( 'selectstart', onSelectStart );
    controller1.addEventListener( 'selectend', onSelectEnd );
    controller1.addEventListener( 'squeezestart', onSqueezeStart );
    controller1.addEventListener( 'squeezeend', onSqueezeEnd );
    controller1.addEventListener( 'connected', function ( event ) {

        this.add( buildController( event.data ) );

    } );
    controller1.addEventListener( 'disconnected', function () {

        this.remove( this.children[ 0 ] );

    } );
    scene.add( controller1 );

    controller2 = renderer.xr.getController( 1 );
    controller2.addEventListener( 'selectstart', onSelectStart );
    controller2.addEventListener( 'selectend', onSelectEnd );
    controller2.addEventListener( 'squeezestart', onSqueezeStart );
    controller2.addEventListener( 'squeezeend', onSqueezeEnd );
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

    const { modelLayer, modelScene, modelCamera, worldPlane, viewPlane, helper3D, controls, guiGroup} = initModelLayer(renderer, scene, {
        modelUrl: 'meshes/Frame01/MeshesZ0.obj',
        position: new THREE.Vector3(-1.5, 1.5, -1.5),
        layerSize: { width: 3, height: 2 },
        guiGroup: intGroup,
        onLoad: (model) => {
            console.log('Model loaded:', model);
        }
    });
    clippingCamera = modelCamera;
    clippingWorldPlane = worldPlane;
    clippingViewPlane = viewPlane;
    helperVolume = helper3D;
    globalControls = controls;

    /*sphereControls = new SphericalPlaneControls(worldPlane, {
        center: new THREE.Vector3(0, 0, 0),
        radius: 3,
        speed: 0.03,
        radiusStep: 0.1
    });
    */

    offscreenLayer = modelLayer;
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
    

    const guiObj = initGUILayer(renderer, scene, parameters, onChange, onThicknessChange);
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
    const currentPos = new THREE.Vector3();
    controller1.getWorldPosition(currentPos);

    if (hasPrev) {
        const delta = new THREE.Vector3().subVectors(currentPos, prevControllerPos);

        // Apply sensitivity scale
        const sensitivity = 10.0;

        if (globalControls) {
            globalControls._rotateLeft(delta.x * sensitivity);
            globalControls._rotateUp(delta.y * sensitivity);
            globalControls.update();
        }
    }

    // Always update previous position
    prevControllerPos.copy(currentPos);
    hasPrev = true;

    //==controllers handle
    // === Handle A/B button presses on controller1 ===
    const session = renderer.xr.getSession();
    if (session) {
        for (const source of session.inputSources) {
            const gp = source.gamepad;
            if (gp) {
                const aPressed = gp.buttons[4]?.pressed;
                const bPressed = gp.buttons[5]?.pressed;

                if (aPressed) {
                    console.log("🅰️ A button is pressed");
                    sphere.material.color.set('blue');
                    clippingWorldPlane.constant -= 0.01; // Decrease clipping plane
                } else if (bPressed) {
                    console.log("🅱️ B button is pressed");
                    sphere.material.color.set('yellow');
                    clippingWorldPlane.constant += 0.01; // Increase clipping plane
                } else {
                    sphere.material.color.set('red');
                }
            }
        }
    }

    //handleController( controller1 );
    //handleController( controller2 );
    
    //sphereControls.update();

    renderer.render( scene, camera );

}