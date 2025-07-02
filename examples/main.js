import * as THREE from 'three';

import { BoxLineGeometry } from 'three/addons/geometries/BoxLineGeometry.js';
import { VRButton } from 'three/addons/webxr/VRButton.js';
import { XRControllerModelFactory } from 'three/addons/webxr/XRControllerModelFactory.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { initGUILayer } from './initGUILayer.js';
import { initModelLayer } from './initModelLayer.js';

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

let guiScene = null;
let guiCamera = null;
let guiGroup = null;

let horseLayer = null;
let guiLayer = null;

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
    scene.add( room );

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

    document.body.appendChild( VRButton.createButton( renderer ) );

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

            if ( intersections[ x ].object == horseLayer ) {

                horseLayer.visible = false;
                hadSelection = true;

            }

            if ( intersections[ x ].object == guiLayer ) {

                const uv = intersections[ x ].uv;
                guiGroup.children[ 0 ].dispatchEvent( { type: 'mousedown', data: { x: uv.x, y: 1 - uv.y }, target: guiGroup } );
                hadSelection = true;

            }

        }

        this.userData.isSelecting = hadSelection === false;

    }

    function onSelectEnd( ) {

        horseLayer.visible = true;
        guiGroup.children[ 0 ].dispatchEvent( { type: 'mouseup', data: { x: 0, y: 0 }, target: guiGroup } );
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
    const { modelLayer } = initModelLayer(renderer, scene, {
        modelFolder: 'meshes',
        position: new THREE.Vector3(-1.5, 1.5, -1.5),
        layerSize: { width: 3, height: 2 },
        frameCount: 4,
        frameDuration: 1000,
        onLoad: (model) => {
            console.log('Model loaded:', model);
        }
    });

    function onChange() { }

    function onThicknessChange() { }

    // set up ui
    //Lambda-functions can be passed
    const guiObj = initGUILayer(renderer, scene, parameters, onChange, onThicknessChange);
    
    
}


function renderQuad() {

    horseTheta += 0.1;
    horseCamera.position.x = horseRadius * Math.sin( THREE.MathUtils.degToRad( horseTheta ) );
    horseCamera.position.z = horseRadius * Math.cos( THREE.MathUtils.degToRad( horseTheta ) );

    horseCamera.lookAt( 0, 150, 0 );
    renderer.render( horseScene, horseCamera );

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


}

//

function render() {

    renderer.xr.renderLayers( );

    handleController( controller1 );
    handleController( controller2 );
    renderer.render( scene, camera );

}