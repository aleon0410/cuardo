Tiler = function (nbIntervals = 8) {
    // lyon epsg:3946
    this.translation = [1849500, 5173000];
    this.size = 40000;
    this.geom = new THREE.PlaneGeometry(1, 1, nbIntervals, nbIntervals);
};

Tiler.prototype.tile = function( center, size, callback ) {
    var mesh = new THREE.Mesh(this.geom, 
            new THREE.MeshBasicMaterial( { color: Math.random()*0xffffff, wireframe:true } ));
    mesh.position = center;
    mesh.scale.x = size;
    mesh.scale.y = size;
    callback( mesh );
};


