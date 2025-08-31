// volumeHelper.js
import * as THREE from 'three';
import { TextureHelper } from 'three/addons/helpers/TextureHelperGPU.js';
import { vec3, vec4, diffuseColor, attribute, float, abs, sin, cos } from 'three/tsl';
const size = {
            width: 240,
            height: 299,
            depth: 282
        };

export function createVolumeHelper(mode, mapArray, scene, gui, knotClippingGroup, render) {
    const helperArray = new TextureHelper(mapArray, 10, 10, 10, mode);
    
    helperArray.material.needsUpdate = true;
    helperArray.material.side = THREE.DoubleSide;
    helperArray.material.transparent = true;
    helperArray.material.depthWrite = false;
    helperArray.material.blending = THREE.NormalBlending;

    const value = diffuseColor.r;
    const depthFactor = attribute('uvw').z.div(size.depth);
    const threshold = float(0.5);
    const mask = value.step(threshold);

    let red   = float(0.5).add(value.mul(0.5));
    let green = value.mul(3.1415).sin().abs();
    let blue  = value.mul(6.283).cos().mul(0.6).add(0.6);

    const rgb = vec3(red, green, blue).mul(depthFactor).mul(mask);
    const alpha = value.mul(diffuseColor.a).mul(mask);

    helperArray.material.outputNode = vec4(rgb, alpha);

    helperArray.position.set(0, 0, 0);
    helperArray.scale.set(1.5, 1.5, 1.5);

    /*
    helperArray.rotation.set(
        THREE.MathUtils.degToRad(0),
        THREE.MathUtils.degToRad(-180),
        THREE.MathUtils.degToRad(90)
    );
    */
    const rot = getInitialRotationForMode(mode);
    helperArray.rotation.set(
        THREE.MathUtils.degToRad(rot.x),
        THREE.MathUtils.degToRad(rot.y),
        THREE.MathUtils.degToRad(rot.z)
    );

    scene.add(helperArray);

    // Optional: GUI sliders
    /*
    if (gui) {
        const folder = gui.addFolder(`Volume ${mode}`);
        folder.add(helperArray.position, 'x', -15, 15, 0.01).name('X');
        folder.add(helperArray.position, 'y', -15, 15, 0.01).name('Y');
        folder.add(helperArray.position, 'z', -15, 15, 0.01).name('Z');
        folder.open();
    }
    */

    knotClippingGroup.add(helperArray);
                        
    // === 1. Settings Object ===
    const volumeSettings = {
        threshold: 0.1
    };
    // === 2. Transfer Function Update ===
    function updateTransferFunction() {
        const value = diffuseColor.r;
        const depthFactor = attribute('uvw').z.div(size.depth);
        const threshold = float(volumeSettings.threshold); // Must be float node
        console.log(volumeSettings.threshold);
        const mask = value.step(threshold); // 0 if value < threshold

        // Blood-red transfer gradient: from dark to bright red
        console.log("Value", value.get());
        const baseRed = float(0.3);
        const brightRed = float(1.0);
        /*
        const red = baseRed.add(value.mul(brightRed.sub(baseRed)));

        const green = float(0.0);
        const blue = float(0.0);
        */
        const red   = float(0.5).add(value.mul(0.5));

        //const green = float(0.0);
        //const blue = float(0.0);
        const green = abs(sin(value.mul(3.1415)));          // wave from 0 → 1
        const blue  = cos(value.mul(6.283)).mul(0.6).add(0.6); 

        // RGB fades with depth and applies mask
        const rgb = vec3(red, green, blue).mul(depthFactor).mul(mask);
        const alpha = value.mul(diffuseColor.a).mul(mask);

        // Update material output
        helperArray.material.outputNode = vec4(rgb, alpha);
        //helperArray.material.needsUpdate = true;        // force recompilation
        helperArray.material.dispose();                 // optional but clears cached shaders
    }

    // === 3. GUI Setup ===
    const thresholdFolder = gui.addFolder('Transfer Function');
    thresholdFolder
        .add(volumeSettings, 'threshold', 0.0, 1.0, 0.01)
        .name('Threshold')
        .onChange(updateTransferFunction);
    thresholdFolder.open();

    // === 4. Initial Call ===
    updateTransferFunction();
    // Position controls for volume
    const volPosFolder = gui.addFolder(`Volume Position ${mode}`);
    volPosFolder.add(helperArray.position, 'x', -15, 15, 0.01).name('X').onChange(render);
    volPosFolder.add(helperArray.position, 'y', -15, 15, 0.01).name('Y').onChange(render);
    volPosFolder.add(helperArray.position, 'z', -15, 15, 0.01).name('Z').onChange(render);
    volPosFolder.open();

    // Rotation controls (degrees)
    const volRotFolder = gui.addFolder(`Volume Rotation ${mode}`);
    const volRot = helperArray.rotation;

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

    return helperArray;
}


function getInitialRotationForMode(mode) {
    switch (mode) {
        case 1: return { x: 0,    y: -180, z: 90 };
        case 2: return { x: -90,  y: -180, z: 0 };
        case 3: return { x: 0,    y: -90,  z: 90 };
        default: return { x: 0,   y: 0,    z: 0 };
    }
}