Tiler = function( layers = [], translation = new THREE.Vector3(0,0,0), nbIntervals = 8) {
    this.translation = translation; // lyon epsg:3946 ~ [1849500, 5173000];
    this.size = 40000;
    this.geom = new THREE.PlaneGeometry(1, 1, nbIntervals, nbIntervals);
    this.layers = layers;
    this.srid = 0;

    this.layers.forEach(function(l){
        var ext = l.extent;
        this.size = Math.max( this.size, Math.max(ext[2]-ext[0], ext[3]-ext[1]) ); 
        if ( this.srid && l.srid != this.srid ) {
            throw "layers srid don't match";
        }
        else {
            this.srid = l.srid;
        }

    });
};

Tiler.prototype.tile = function( center, size, callback ) {
    var group = new THREE.Object3D();
    // add basic grid for debug
    {
        var mesh = new THREE.Mesh(this.geom, 
            new THREE.MeshBasicMaterial( { color: Math.random()*0xffffff, wireframe:true } ));
        mesh.position = center;
        mesh.scale.x = size;
        mesh.scale.y = size;
        group.add(mesh);
    }
    var remaining = this.layers.length;
    this.layers.forEach(function(l){
        l.tile( center, size, 
            function(mesh){
                group.add(mesh);
                remaining--;
                if (!remaining) callback(group);
            });
    });
};

