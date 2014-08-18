// faces diagonals are diffrent from the original PlaneGeometry.js
//d---c
//| \ |
//a---b
PlaneGeometry = function ( center, width, widthSegments ) {

	THREE.Geometry.call( this );

	this.parameters = {
		width: width,
		widthSegments: widthSegments,
	};

	var ix, iy;
	var width_half = width / 2;

	var gridX = widthSegments || 1.;

	var gridX1 = gridX + 1;

	var segment_width = width / gridX;

	var normal = new THREE.Vector3( 0, 0, 1 );

	for ( iy = 0; iy < gridX1; iy ++ ) {

		var y = center.y + iy * segment_width - width_half;

		for ( ix = 0; ix < gridX1; ix ++ ) {

			var x = center.x + ix * segment_width - width_half;

			this.vertices.push( new THREE.Vector3( x, y, 0 ) );

		}

	}

	for ( iy = 0; iy < gridX; iy ++ ) {

		for ( ix = 0; ix < gridX; ix ++ ) {

			var a = ix + gridX1 * iy;
			var b = ix + 1 + gridX1 * iy;
			var c = ix + 1 + gridX1 * ( iy + 1 );
			var d = ix + gridX1 * ( iy + 1 );

			var uva = new THREE.Vector2( ix / gridX, iy / gridX );
			var uvb = new THREE.Vector2( ( ix + 1 ) / gridX, iy / gridX );
			var uvc = new THREE.Vector2( ( ix + 1 ) / gridX, ( iy + 1 ) / gridX );
			var uvd = new THREE.Vector2( ix / gridX, ( iy + 1 ) / gridX );

			var face = new THREE.Face3( a, b, d );
			face.normal.copy( normal );
			face.vertexNormals.push( normal.clone(), normal.clone(), normal.clone() );

			this.faces.push( face );
			this.faceVertexUvs[ 0 ].push( [ uva, uvb, uvd ] );

			face = new THREE.Face3( b, c, d );
			face.normal.copy( normal );
			face.vertexNormals.push( normal.clone(), normal.clone(), normal.clone() );

			this.faces.push( face );
			this.faceVertexUvs[ 0 ].push( [ uvb.clone(), uvc, uvd.clone() ] );

		}

	}

};

PlaneGeometry.prototype = Object.create( THREE.Geometry.prototype );

