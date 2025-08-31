import {
	NodeMaterial,
	BoxGeometry,
	BufferAttribute,
	Mesh,
	PlaneGeometry,
	DoubleSide,
	Vector3,
} from 'three';
import { texture as textureNode, cubeTexture, texture3D, float, vec4, attribute } from 'three/tsl';
import { mergeGeometries } from '../utils/BufferGeometryUtils.js';

/**
 * A helper that can be used to display any type of texture for
 * debugging purposes. Depending on the type of texture (2D, 3D, Array),
 * the helper becomes a plane or box mesh.
 *
 * This helper can only be used with {@link WebGPURenderer}.
 * When using {@link WebGLRenderer}, import from `TextureHelper.js`.
 *
 * @private
 * @augments Mesh
 * @three_import import { TextureHelper } from 'three/addons/helpers/TextureHelperGPU.js';
 */
class TextureHelper extends Mesh {

	/**
	 * Constructs a new texture helper.
	 *
	 * @param {Texture} texture - The texture to visualize.
	 * @param {number} [width=1] - The helper's width.
	 * @param {number} [height=1] - The helper's height.
	 * @param {number} [depth=1] - The helper's depth.
	 */
	constructor( texture, width = 1, height = 1, depth = 1 , mode = 3) {

		const material = new NodeMaterial();
		material.side = DoubleSide;
		material.transparent = true;
		material.name = 'TextureHelper';

		let colorNode;

		const uvw = attribute( 'uvw' );

		if ( texture.isCubeTexture ) {

			colorNode = cubeTexture( texture ).sample( uvw );

		} else if ( texture.isData3DTexture || texture.isCompressed3DTexture ) {

			colorNode = texture3D( texture ).sample( uvw );

		} else if ( texture.isArrayTexture || texture.isDataArrayTexture || texture.isCompressedArrayTexture ) {

			colorNode = textureNode( texture ).sample( uvw.xy ).depth( uvw.z );

		} else {

			colorNode = textureNode( texture );

		}

		const alphaNode = float( getAlpha( texture ) );

		material.colorNode = vec4( colorNode.rgb, alphaNode );

		const geometry = texture.isCubeTexture
			? createCubeGeometry( width, height, depth )
			: createSliceGeometry( texture, width, height, depth, mode );

		super( geometry, material );

		/**
		 * The texture to visualize.
		 *
		 * @type {Texture}
		 */
		this.texture = texture;
		this.type = 'TextureHelper';

	}

	/**
	 * Frees the GPU-related resources allocated by this instance. Call this
	 * method whenever this instance is no longer used in your app.
	 */
	dispose() {

		this.geometry.dispose();
		this.material.dispose();

	}

}

function getImageDepth( texture ) {

	if ( texture.isCubeTexture ) {

		return 6;

	} else if ( texture.isArrayTexture || texture.isDataArrayTexture || texture.isCompressedArrayTexture ) {

		return texture.image.depth;

	} else if ( texture.isData3DTexture || texture.isCompressed3DTexture ) {

		return texture.image.depth;

	} else {

		return 1;

	}

}

function getImageHeight( texture ) {

	if ( texture.isCubeTexture ) {

		return 6;

	} else if ( texture.isArrayTexture || texture.isDataArrayTexture || texture.isCompressedArrayTexture ) {

		return texture.image.height;

	} else if ( texture.isData3DTexture || texture.isCompressed3DTexture ) {

		return texture.image.height;

	} else {

		return 1;

	}

}

function getImageWidth( texture ) {

	if ( texture.isCubeTexture ) {

		return 6;

	} else if ( texture.isArrayTexture || texture.isDataArrayTexture || texture.isCompressedArrayTexture ) {

		return texture.image.width;

	} else if ( texture.isData3DTexture || texture.isCompressed3DTexture ) {

		return texture.image.width;

	} else {

		return 1;

	}

}

function getAlpha( texture ) {

	if ( texture.isCubeTexture ) {

		return 1;

	} else if ( texture.isArrayTexture || texture.isDataArrayTexture || texture.isCompressedArrayTexture ) {

		return Math.max( 1 / texture.image.depth, 0.25 );

	} else if ( texture.isData3DTexture || texture.isCompressed3DTexture ) {

		return Math.max( 1 / texture.image.depth, 0.25 );

	} else {

		return 1;

	}

}

function createCubeGeometry( width, height, depth ) {

	const geometry = new BoxGeometry( width, height, depth );

	const position = geometry.attributes.position;
	const uv = geometry.attributes.uv;
	const uvw = new BufferAttribute( new Float32Array( uv.count * 3 ), 3 );

	const _direction = new Vector3();

	for ( let j = 0, jl = uv.count; j < jl; ++ j ) {

		_direction.fromBufferAttribute( position, j ).normalize();

		const u = _direction.x;
		const v = _direction.y;
		const w = _direction.z;

		uvw.setXYZ( j, u, v, w );

	}

	geometry.deleteAttribute( 'uv' );
	geometry.setAttribute( 'uvw', uvw );

	return geometry;

}

function createSliceGeometry( texture, width, height, depth, mode ) {
	//additional rotations
	mode = 3;
	console.log("Mode of volume", mode);
	let sliceCount;
	if (mode === 1) {
		sliceCount = getImageDepth(texture);  // Z slicing
	} else if (mode === 2) {
		sliceCount = getImageWidth(texture);  // X slicing
	} else if (mode === 3) {
		sliceCount = getImageHeight(texture); // Y slicing
	}
	//let sliceCount = getImageDepth( texture );
	/*

	if (mode == 1)
	{
		sliceCount = getImageWidth( texture );
	}
	if (mode == 2)
	{
		sliceCount = getImageHeight( texture );
	}
	*/

	const geometries = [];

	for ( let i = 0; i < sliceCount; ++ i ) {

		//let geometry = new PlaneGeometry( width, height );
		/*
		if (mode == 1)
		{
			geometry = new PlaneGeometry( width, depth );
		}
		if (mode == 2)
		{
			geometry = new PlaneGeometry( height, depth );
		}*/

		{

			/*
			if (mode == 1)
			{
				console.log("it s one");
				geometry.translate( 0, 0, depth * ( i / ( sliceCount - 1 ) - 0.5 ) );
				geometry.rotateX( 3.14159 / 2.0 );
			}
			if (mode == 2)
			{
				console.log("it s two");
				geometry.translate( 0, 0, depth * ( i / ( sliceCount - 1 ) - 0.5 ) );
				geometry.rotateY( 3.14159 / 2.0 );
			}*/
				//console.log("it s three");
			//geometry.translate( 0, 0, depth * ( i / ( sliceCount - 1 ) - 0.5 ) );
		}

		let geometry;
		if (mode === 1) {
			geometry = new PlaneGeometry(width, height);
			geometry.translate(0, 0, depth * (i / (sliceCount - 1) - 0.5));
		} else if (mode === 2) {
			geometry = new PlaneGeometry(depth, height);
			geometry.rotateY(Math.PI / 2);
			geometry.translate(width * (i / (sliceCount - 1) - 0.5), 0, 0);
		} else if (mode === 3) {
			geometry = new PlaneGeometry(width, depth);
			geometry.rotateX(-Math.PI / 2);
			geometry.translate(0, height * (i / (sliceCount - 1) - 0.5), 0);
		}

		const uv = geometry.attributes.uv;
		const uvw = new BufferAttribute( new Float32Array( uv.count * 3 ), 3 );

		for ( let j = 0, jl = uv.count; j < jl; ++ j ) {

			const u = uv.getX( j );
			const v = uv.getY( j );
			const w = sliceCount === 1
				? 1
				: texture.isArrayTexture || texture.isDataArrayTexture || texture.isCompressedArrayTexture
					? i
					: i / ( sliceCount - 1 );

			{
				if (mode === 1) {
					// Default: slice along Z
					uvw.setXYZ(j, u, v, w);
				} else if (mode === 2) {
					// Slice along X
					uvw.setXYZ(j, w, u, v);
				} else if (mode === 3) {
					// Slice along Y
					uvw.setXYZ(j, u, w, v);
				}
				//uvw.setXYZ( j, u, v, w );
			}
		}

		geometry.deleteAttribute( 'uv' );
		geometry.setAttribute( 'uvw', uvw );

		geometries.push( geometry );

	}

	return mergeGeometries( geometries );

}

export { TextureHelper };
