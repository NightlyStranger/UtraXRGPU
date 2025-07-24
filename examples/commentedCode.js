

            /*loadVolume().then(mesh => {
                console.log("Volume mesh loaded", mesh);
                knotClippingGroup.add(mesh);
                // You can now safely do things with `mesh` here
            });*/
            /*
            new THREE.FileLoader()
					.setResponseType( 'arraybuffer' )
					.load( 'textures/3d/vessels240x299x282.zip', function ( data ) {

						const zip = unzipSync( new Uint8Array( data ) );
						const array = new Uint8Array( zip[ 'vessels240x299x282' ].buffer );
                        const depth = size.depth / 20;
                        console.log("Depth", depth);



						// 2D Array

						const mapArray = new THREE.DataArrayTexture( array, size.width, size.height, size.depth );
						mapArray.name = 'DataArrayTexture';
						mapArray.format = THREE.RedFormat;
						mapArray.minFilter = THREE.LinearFilter;
						mapArray.magFilter = THREE.LinearFilter;
						mapArray.unpackAlignment = 1;
						mapArray.needsUpdate = true;

						const helperArray = new TextureHelper( mapArray, 10, 10, depth );
                        helperArray.material.needsUpdate = true;
                        helperArray.material.side = THREE.DoubleSide;
                        helperArray.material.transparent = true;
                        helperArray.material.depthWrite = false;
                        helperArray.material.blending = THREE.NormalBlending;
                        
						//helperArray.material.outputNode = vec4(
						//	vec3( diffuseColor.r.mul( attribute( 'uvw' ).z.div( size.depth ).mul( diffuseColor.r ) ) ),
						//	diffuseColor.r.mul( diffuseColor.a )
						//);
                        
                        
                        let value = diffuseColor.r;
                        let depthFactor = attribute( 'uvw' ).z.div( size.depth );
                        let threshold = 0.5;
                        let mask = value.step( threshold ); // 0 if value < threshold

                        // Blood red color gradient: from 0.3 to 1.0 based on value
                        const baseRed = float(0.3);
                        const brightRed = float(1.0);
                        const red = baseRed.add(value.mul(brightRed.sub(baseRed)));

                        const green = float(0.0);
                        const blue = float(0.0);

                        // RGB with fading by depth
                        let rgb = vec3(red, green, blue).mul(depthFactor).mul(mask);
                        let alpha = value.mul( diffuseColor.a ).mul( mask );
                        

                        helperArray.material.outputNode = vec4( vec3( rgb ), alpha );

                        console.log("Geom", helperArray.scale);
                        helperArray.position.set(0, 0, 0);
                        
                        helperArray.scale.set(1.5, 1.5, 1.5);
                        
                        const initialRotationDeg = { x: 0, y: -180, z: 90 };
                        helperArray.rotation.set(
                            THREE.MathUtils.degToRad(initialRotationDeg.x),
                            THREE.MathUtils.degToRad(initialRotationDeg.y),
                            THREE.MathUtils.degToRad(initialRotationDeg.z)
                        );
                        

                        // Add GUI and cont
						//modelScene.add( helperArray );
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
                            const baseRed = float(0.3);
                            const brightRed = float(1.0);
                            const red = baseRed.add(value.mul(brightRed.sub(baseRed)));

                            const green = float(0.0);
                            const blue = float(0.0);

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
                        const volPosFolder = gui.addFolder('Volume Position');
                        volPosFolder.add(helperArray.position, 'x', -15, 15, 0.01).name('X').onChange(render);
                        volPosFolder.add(helperArray.position, 'y', -15, 15, 0.01).name('Y').onChange(render);
                        volPosFolder.add(helperArray.position, 'z', -15, 15, 0.01).name('Z').onChange(render);
                        volPosFolder.open();
                        
                        //knotClippingGroup.add(helper3D);


                        

                        // Rotation controls (degrees)
                        const volRotFolder = gui.addFolder('Volume Rotation');
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
                        
                        
                        const map3D = new THREE.Data3DTexture( array, size.width, size.height, size.depth );
						map3D.name = 'Data3DTexture';
						map3D.format = THREE.RedFormat;
						map3D.minFilter = THREE.LinearFilter;
						map3D.magFilter = THREE.LinearFilter;
						map3D.unpackAlignment = 1;
						map3D.needsUpdate = true;

                        helper3D = new TextureHelper( map3D, 10, 10, depth );
                        helper3D.material.needsUpdate = true;
                        helper3D.material.side = THREE.DoubleSide;
                        helper3D.material.transparent = true;
                        helper3D.material.depthWrite = false;
                        helper3D.material.blending = THREE.NormalBlending;

                        value = diffuseColor.r;
                        depthFactor = attribute( 'uvw' ).z.div( size.depth );
                        threshold = 0.2;
                        mask = value.step( threshold ); // 0 if value < threshold

                        rgb = value.mul( depthFactor ).mul( value ).mul( mask );
                        alpha = value.mul( diffuseColor.a ).mul( mask );

                        //helper3D.material.outputNode = vec4(vec3(1.0), alpha);
                        helperArray.material.outputNode = vec4( vec3( rgb ), alpha );
						helper3D.material.outputNode = vec4(
							vec3( diffuseColor.r.mul( attribute( 'uvw' ).y.mul( diffuseColor.r ) ) ),
							diffuseColor.r.mul( diffuseColor.a )
						);
                        
                        helper3D.position.set(0, 0, 0);
                        
                        helper3D.scale.set(1.5, 1.5, 1.5);
                        
                        helper3D.rotation.set(
                            THREE.MathUtils.degToRad(0),
                            THREE.MathUtils.degToRad(-180),
                            THREE.MathUtils.degToRad(90)
                        );
                        // Create an object to hold threshold
                        const params = {
                            threshold: 0.5,  // initial value
                        };

                        // Add a separate folder or add it anywhere in GUI (separate from position)
                        const thresholdFolder = gui.addFolder('Volume Threshold');
                        thresholdFolder.add(params, 'threshold', 0, 1, 0.01).name('Threshold').onChange(value => {
                            // Use this value as needed, e.g. pass to shader or update helper3D
                            console.log("Threshold changed:", value);
                            render();
                        });
                        thresholdFolder.open();
                        // Position controls for volume
                        const volPosFolder = gui.addFolder('Volume Position');
                        volPosFolder.add(helper3D.position, 'x', -300, 300, 0.1).name('X').onChange(render);
                        volPosFolder.add(helper3D.position, 'y', -300, 300, 0.1).name('Y').onChange(render);
                        volPosFolder.add(helper3D.position, 'z', -300, 300, 0.1).name('Z').onChange(render);
                        volPosFolder.open();
                        
                        //knotClippingGroup.add(helper3D);


                        

                        // Rotation controls (degrees)
                        const volRotFolder = gui.addFolder('Volume Rotation');
                        const volRot = helper3D.rotation;

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
                        volFolder.add(helper3D.scale, 'x', 0.1, 300, 0.1).name('X').onChange(render);
                        volFolder.add(helper3D.scale, 'y', 0.1, 300, 0.1).name('Y').onChange(render);
                        volFolder.add(helper3D.scale, 'z', 0.1, 300, 0.1).name('Z').onChange(render);
                        volFolder.open();
                        
                        //modelScene.add(helper3D)
                        


					} );
                     */
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

    

    // Call the async loader function and then do something with the mesh
    
    
    

    //knotClippingGroup.add(mesh);
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
                let finalColor = vec4(1, 0, 0, 1).toVar();
                const planeNormal = vec3(0.0, 1.0, -1.0);  
                const planeConstant = 0.0;
                RaymarchingBox(steps, ({ positionRay }) => {
                    const pWorld = positionRay.add(0.5); // Convert from [-0.5,0.5] to [0,1]
                    //const distanceToPlane = planeNormal.dot(pWorld).add(planeConstant);
                    // If point is behind the plane, skip marching this step
                    const planeNormal = vec3(0.0, 1.0, -1.0).normalize();
                    const boxCenter = vec3(0.5, 0.5, 0.5);
                    const planeConstant = -planeNormal.dot(boxCenter);

                    const inHalfSpace = planeNormal.dot(pWorld);
                    /*
                    If(inHalfSpace.greaterThanEqual(-planeConstant), () => {
                        Continue();
                    });
                    */
                   If(pWorld.y.lessThan(0.5), () => {
                        Continue(); // Skip marching this point
                    });
                                    

                    const mapValue = texture.sample(pWorld).r.toVar();
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
    const map3D = new THREE.Data3DTexture( array, size.width, size.height, size.depth );
						map3D.name = 'Data3DTexture';
						map3D.format = THREE.RedFormat;
						map3D.minFilter = THREE.LinearFilter;
						map3D.magFilter = THREE.LinearFilter;
						map3D.unpackAlignment = 1;
						map3D.needsUpdate = true;

                        helper3D = new TextureHelper( map3D, 10, 10, depth );
                        helper3D.material.needsUpdate = true;
                        helper3D.material.side = THREE.DoubleSide;
                        helper3D.material.transparent = true;
                        helper3D.material.depthWrite = false;
                        helper3D.material.blending = THREE.NormalBlending;

                        value = diffuseColor.r;
                        depthFactor = attribute( 'uvw' ).z.div( size.depth );
                        threshold = 0.2;
                        mask = value.step( threshold ); // 0 if value < threshold

                        rgb = value.mul( depthFactor ).mul( value ).mul( mask );
                        alpha = value.mul( diffuseColor.a ).mul( mask );

                        //helper3D.material.outputNode = vec4(vec3(1.0), alpha);
                        helperArray.material.outputNode = vec4( vec3( rgb ), alpha );
						helper3D.material.outputNode = vec4(
							vec3( diffuseColor.r.mul( attribute( 'uvw' ).y.mul( diffuseColor.r ) ) ),
							diffuseColor.r.mul( diffuseColor.a )
						);
                        
                        helper3D.position.set(0, 0, 0);
                        
                        helper3D.scale.set(1.5, 1.5, 1.5);
                        
                        helper3D.rotation.set(
                            THREE.MathUtils.degToRad(0),
                            THREE.MathUtils.degToRad(-180),
                            THREE.MathUtils.degToRad(90)
                        );
                        // Create an object to hold threshold
                        const params = {
                            threshold: 0.5,  // initial value
                        };

                        // Add a separate folder or add it anywhere in GUI (separate from position)
                        const thresholdFolder = gui.addFolder('Volume Threshold');
                        thresholdFolder.add(params, 'threshold', 0, 1, 0.01).name('Threshold').onChange(value => {
                            // Use this value as needed, e.g. pass to shader or update helper3D
                            console.log("Threshold changed:", value);
                            render();
                        });
                        thresholdFolder.open();
                        // Position controls for volume
                        const volPosFolder = gui.addFolder('Volume Position');
                        volPosFolder.add(helper3D.position, 'x', -300, 300, 0.1).name('X').onChange(render);
                        volPosFolder.add(helper3D.position, 'y', -300, 300, 0.1).name('Y').onChange(render);
                        volPosFolder.add(helper3D.position, 'z', -300, 300, 0.1).name('Z').onChange(render);
                        volPosFolder.open();
                        
                        //knotClippingGroup.add(helper3D);


                        

                        // Rotation controls (degrees)
                        const volRotFolder = gui.addFolder('Volume Rotation');
                        const volRot = helper3D.rotation;

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
                        volFolder.add(helper3D.scale, 'x', 0.1, 300, 0.1).name('X').onChange(render);
                        volFolder.add(helper3D.scale, 'y', 0.1, 300, 0.1).name('Y').onChange(render);
                        volFolder.add(helper3D.scale, 'z', 0.1, 300, 0.1).name('Z').onChange(render);
                        volFolder.open();
                        
                        //modelScene.add(helper3D)