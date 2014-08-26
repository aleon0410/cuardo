// faces diagonals are diffrent from the original PlaneGeometry.js
//d---c
//| \ |
//a---b
PlaneGeometry = function ( center, width, nbIntervals ) {

	THREE.BufferGeometry.call( this );

	var width_half = width / 2;

	var nbIntervals1 = nbIntervals + 1;

	var segment_width = width / nbIntervals;

        var position = {array:new Float32Array( nbIntervals1*nbIntervals1*3 ), itemSize:3};
        var uv = {array:new Float32Array( nbIntervals1*nbIntervals1*2 ), itemSize:2};

	for ( var iy = 0, end = nbIntervals+1; iy < end; iy ++ ) {
		var y = center.y + iy * segment_width - width_half;
		for ( var ix = 0; ix < end; ix ++ ) {
                        var idx = ix + iy*nbIntervals1;
			position.array[idx*3  ] = center.x + ix * segment_width - width_half;
			position.array[idx*3+1] = y;
			position.array[idx*3+2] = 0;
                        uv.array[idx*2  ] = ix / nbIntervals;
                        uv.array[idx*2+1] = iy / nbIntervals;
		}
	}

        var index = {array:new Uint16Array( nbIntervals*nbIntervals*2*3 ), itemSize:3};

	for ( iy = 0; iy < nbIntervals; iy ++ ) {
		for ( ix = 0; ix < nbIntervals; ix ++ ) {
			var a = ix + nbIntervals1 * iy;
			var b = ix + 1 + nbIntervals1 * iy;
			var c = ix + 1 + nbIntervals1 * ( iy + 1 );
			var d = ix + nbIntervals1 * ( iy + 1 );

                        var idx = (ix + iy*nbIntervals)*2*3;
                        index.array[idx  ] = a;
                        index.array[idx+1] = b;
                        index.array[idx+2] = d;
                        index.array[idx+3] = b;
                        index.array[idx+4] = c;
                        index.array[idx+5] = d;
		}

	}
        this.attributes.position = position;
        this.attributes.index = index;
        this.attributes.uv = uv;
        this.offsets = [{start:0, count:nbIntervals*nbIntervals*2*3, index:0}];

};

PlaneGeometry.prototype = Object.create( THREE.BufferGeometry.prototype );

