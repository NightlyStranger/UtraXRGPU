// dvrRendering.js
import * as THREE from 'three';
import {  cameraProjectionMatrix, 
       modelViewMatrix,float, vec3, vec4,positionLocal, Fn, mul, cameraPosition, modelWorldMatrixInverse, texture3D} from 'three/tsl';
import { ImprovedNoise } from 'three/addons/math/ImprovedNoise.js';

export function createGreenBox(renderer, scene, camera) {
  // box geometry
  const volumePath = 'volumes/Frame01/Volume.downsampled.raw';
  const geometry = new THREE.BoxGeometry(1, 1, 1);
  //geometry.position = THREE.Vector3(0.5, 1.0, -0.5);

  // node material using TSL
  const material = new THREE.MeshBasicNodeMaterial();
  // Vertex Node Approach
  const volumeTex = generatePerlinVolume();
  //const volumeSampler = uniform(volumeTex);
  //const posVarying = varying(positionLocal);
  const customVertexNode = Fn(() => {
        let pos = positionLocal;
        let rayOrigin = mul(modelWorldMatrixInverse, vec4(cameraPosition, 1.0)).xyz;
        let rayDir = pos.sub(rayOrigin);
        
        material.vOrigin = rayOrigin.toVarying('varPos');
        material.vDirection = rayDir.toVarying('vDirection');
        
        return cameraProjectionMatrix.mul(modelViewMatrix.mul(vec4(positionLocal, 1.0)));
	})()


    const customFragmentNode = Fn(({ tex }) => {
        const rayOrigin = material.vOrigin;      // passed from vertex
        const rayDir    = material.vDirection;   // passed from vertex

        let alphaScale = 1.0
        // Axis-aligned box in local space
        const boxMin = vec3(-0.5);
        const boxMax = vec3(0.5);

        // --- intersect ray with AABB ---
        const tMin = boxMin.sub(rayOrigin).div(rayDir);
        const tMax = boxMax.sub(rayOrigin).div(rayDir);
        const t1 = tMin.min(tMax);
        const t2 = tMin.max(tMax);
        let tNear = t1.max(t1.y).max(t1.z);
        let tFar  = t2.min(t2.y).min(t2.z);
        
        // only proceed if intersection exists
        if (tNear <= tFar) {
            tNear = tNear.max(0.0); // clamp near to avoid sampling behind camera
            

            const entryPoint = rayOrigin.add(rayDir.mul(tNear));
            const exitPoint  = rayOrigin.add(rayDir.mul(tFar));
            
            const rayLength = exitPoint.sub(entryPoint).length();

            // sampling parameters
            
            let samples = 128;
            const steps = float(samples);          // number of steps along ray
            const tIncr = rayLength.div(steps); // step size
            let accum = float(0.0);             // accumulated max intensity

            let t = float(0.0);

            let accumColor = vec4(0.0, 0.0, 0.0, 0.0);
            let sampleColor;
            for (let i = 0; i < samples; i ++) {
                const p = entryPoint.add(rayDir.mul(t));
                const uvw = p.sub(boxMin).div(boxMax.sub(boxMin)); // texture coords [0..1]
                const density = tex.sample(uvw).r;
                // --- simple 3-range transfer function ---
                if (density >= 0.48) {
                    // Optional: compute normal for shading here
                    return vec4(0.0, 1.0, 0.0, 1.0); // green surface
                }
                // front-to-back alpha compositing
                /*
                accumColor = vec4(
                    accumColor.x.add((float(1.0).sub(accumColor.w)).mul(sampleColor.x)),
                    accumColor.y.add((float(1.0).sub(accumColor.w)).mul(sampleColor.y)),
                    accumColor.z.add((float(1.0).sub(accumColor.w)).mul(sampleColor.z)),
                    accumColor.w.add((float(1.0).sub(accumColor.w)).mul(sampleColor.w))
                );

                // early exit if fully opaque
                if (accumColor.w >= 0.95) break;
                */
                accum = accum.max(density);
                
                t = t.add(tIncr);
            }
                
            
            //return sampleColor;;
            if(accum < 0.1) return vec4(0.0, 0.0, 0.0, 0.0);
            return vec4(0.0, accum, 0.0, 1.0); // green = max intensity
            
        }
        return vec4(0.0, 0.0, 0.0, 0.0);
    });
  material.vertexNode = customVertexNode;
  material.fragmentNode = customFragmentNode({
    tex: texture3D(volumeTex, null, 0)
  });
  material.needsUpdate = true;

  // mesh
  const cube = new THREE.Mesh(geometry, material);
  cube.scale.set(2,2,2);
  cube.position.set(0.5, 1.0, -0.5);
  //scene.add(cube);

  function animate() {
    requestAnimationFrame(animate);
    //cube.rotation.x += 0.01;
    cube.rotation.y += 0.01;
    renderer.renderAsync(scene, camera);
  }
  animate();
  

  return cube;
}

function generatePerlinVolume(size = 128, scale = 6.5) {
  const data = new Uint8Array(size * size * size);
  const perlin = new ImprovedNoise();
  const vector = new THREE.Vector3();

  let i = 0;
  for (let z = 0; z < size; z++) {
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        vector.set(x, y, z).divideScalar(size);
        const d = perlin.noise(vector.x * scale, vector.y * scale, vector.z * scale);
        data[i++] = d * 128 + 128; // map [-1,1] → [0,255]
      }
    }
  }

  const texture = new THREE.Data3DTexture(data, size, size, size);
  texture.format = THREE.RedFormat;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.unpackAlignment = 1;
  texture.needsUpdate = true;

  return texture;
}

export async function loadVolumeTexture(volumePathUrl, volumeDimensions) {
    const dimX = volumeDimensions.x;
    const dimY = volumeDimensions.y;
    const dimZ = volumeDimensions.z;

    // Fetch the raw volume data
    const response = await fetch(volumePathUrl);
    const buffer = await response.arrayBuffer();

    const expectedSize = dimX * dimY * dimZ;
    const byteArray = new Uint8Array(buffer);

    if (byteArray.length !== expectedSize) {
        console.warn(`Expected ${expectedSize} bytes, got ${byteArray.length}`);
    }

    // Create the 3D texture
    const texture = new THREE.Data3DTexture(byteArray, dimX, dimY, dimZ);
    texture.format = THREE.RedFormat;
    texture.type = THREE.UnsignedByteType;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.unpackAlignment = 1;
    texture.needsUpdate = true;

    return texture;
}