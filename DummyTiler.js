Tiler = function( nbIntervals = 8) {
    this.translation = [1849500, 5173000];
    this.size = 40000;
    this.geom = new THREE.PlaneGeometry(1, 1, nbIntervals, nbIntervals);
};

Tiler.prototype.tile = function( center, size, callback ) {
    if ( size < 100 ) {
        callback();
    }
    var mesh = new THREE.Mesh( new THREE.PlaneGeometry(size, size, 8,8),
                               new THREE.MeshBasicMaterial( { color: Math.random()*0xffffff, wireframe:true } ));
    mesh.position = center;
    mesh.updateMatrix();
    mesh.matrixAutoUpdate = false;
    callback( mesh );
};

