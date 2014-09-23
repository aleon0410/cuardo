cuardo.Tiler = function( layers, translation) {
    this.translation = translation; 
    this.layers = layers || [];
    this.tileIds = {};
    this.currentTileId = -1;
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

