cuardo.Tiler = function( layers, translation, nbIntervals) {
    this.translation = translation || new THREE.Vector3(0,0,0); // lyon epsg:3946 ~ [1849500, 5173000];
    this.size = 0;
    this.nbIntervals = nbIntervals || 8;
    this.geom = new THREE.PlaneGeometry(1, 1, this.nbIntervals, this.nbIntervals);
    this.layers = layers || [];
    this.srid = 0;
    this.tileIds = {};
    this.currentTileId = -1;

    var object = this;
    this.layers.forEach(function(l){
        var ext = l.extent;
        object.size = Math.max( object.size, Math.max(ext[2]-ext[0], ext[3]-ext[1]) ); 
        if ( object.srid && l.srid != object.srid ) {
            throw "layers srid don't match";
        }
        else {
            object.srid = l.srid;
        }

    });
};

cuardo.Tiler.prototype.tile = function( center, size, progressCallback, callback ) {
    var group = {};
    this.currentTileId++;

    var remaining = this.layers.length;
    var nTotal = remaining;
    progressCallback( 0, nTotal );
    var object = this;

    var tileId = object.currentTileId;
    if ( this.layers[0] instanceof cuardo.Terrain ) {
        this.layers[0].tile( center, size, tileId,
                             function( terrainmesh ){
                                 group[0] = terrainmesh;
                                 remaining--;
                                 progressCallback( nTotal - remaining, nTotal );
                                 if (!remaining) {
                                     callback(group);
                                 }
                                 for ( var lid = 1 ; lid < object.layers.length; lid++ ) {
                                     object.layers[lid].tile( center, size, tileId,
                                                              (function(l) {
                                                                  return function(mesh) {
                                                                      if (mesh !== undefined ) {
                                                                          group[l] = mesh;
                                                                      }
                                                                      remaining--;
                                                                      progressCallback( nTotal - remaining, nTotal );
                                                                      if (!remaining) {
                                                                          callback(group);
                                                                      }
                                                                  };
                                                              })(lid)
                                                            );
                                 }
                             });
    }
    else {
        for ( var lid = 0 ; lid < object.layers.length; lid++ ) {
            object.layers[lid].tile( center, size, tileId,
                                     (function(l) {
                                         return function(mesh) {
                                             if (mesh !== undefined ) {
                                                 group[l] = mesh;
                                             }
                                             remaining--;
                                             progressCallback( nTotal - remaining, nTotal );
                                             if (!remaining) {
                                                 callback(group);
                                             }
                                         };
                                     })(lid)
                                   );
        }
    }
};

