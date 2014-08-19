Tiler = function( layers, translation, nbIntervals) {
    this.translation = translation || new THREE.Vector3(0,0,0); // lyon epsg:3946 ~ [1849500, 5173000];
    this.size = 40000;
    this.nbIntervals = nbIntervals || 8;
    this.geom = new THREE.PlaneGeometry(1, 1, this.nbIntervals, this.nbIntervals);
    this.layers = layers || [];
    this.srid = 0;
    this.tileIds = {};
    this.currentTileId = -1;

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
    var group = [];
    for ( var lid = 0 ; lid < this.layers.length; lid++ ) group.push( new THREE.Object3D() );
    this.currentTileId++;

    // add basic grid for debug
    {
        var mesh = new THREE.Mesh(this.geom, 
            new THREE.MeshBasicMaterial( { color: Math.random()*0xffffff, wireframe:true } ));
        mesh.position = center;
        mesh.scale.x = size;
        mesh.scale.y = size;
        group[0].add(mesh);
    }
    var remaining = this.layers.length;
    var object = this;


    var tileId = object.currentTileId;
    //console.log('starting tile ', tileId);
    this.layers[0].tile( center, size, tileId,
            function( terrainmesh ){
                group[0].add(terrainmesh);
                //console.log('added terrain ', tileId);
                callback(group);
                remaining--;
                for ( var lid = 1 ; lid < object.layers.length; lid++ ) {
                    object.layers[lid].tile( center, size, tileId,
                        (function(g) {
                            return function(mesh) {
                                    g.add(mesh);
                                    remaining--;
                                    if (!remaining) {
                                        callback(group);
                                    }
                            };
                        })(group[lid])
                        );
                }
            });
};

