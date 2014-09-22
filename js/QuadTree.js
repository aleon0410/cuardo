// quad of size x size, centered on x,y
cuardo.QuadTree = function( size, lod, tiler, maxCachedTiles ) {
    THREE.Object3D.call( this );

    // max LOD
    this.maxLOD = lod;
    // size of an edge
    this.size = size;

    // tiling function
    this.tiler = tiler;

    // the root tile
    this.root = new cuardo.QuadNode( size, 0, 0, 0, this );
    this.add( this.root );

    // list of loaded nodes
    this.cache = []
    this.maxCachedTiles = maxCachedTiles || 32;

    // visible layers
    // all layers are visible at construction
    this.visibleLayers = [];
    for ( var lid = 0; lid < this.tiler.layers.length; lid++ ) {
        this.visibleLayers.push(lid.toString());
    }
}

// inherits from Object3D
cuardo.QuadTree.prototype = Object.create( THREE.Object3D.prototype );

cuardo.QuadTree.prototype.setObject = function( object, level )
{
    var x = (object.position.x - this.position.x + this.size/2) / this.size;
    var y = (object.position.y - this.position.y + this.size/2) / this.size;
    var nl = 1<<level;
    var dx = ~~(x*nl);
    var dy = ~~(y*nl);
    this.root.setObject( object, dx, dy, level );
}

//
// get center coordinates (in quadtree coordinates)
cuardo.QuadTree.prototype.centerCoordinates = function( x, y, level )
{
    var tileSize = this.size / Math.pow(2,level);
    var xc = (x+0.5) * tileSize - this.size / 2;
    var yc = (y+0.5) * tileSize - this.size / 2;
    return {x:xc, y:yc};
}

// update object visibility based on current camera
cuardo.QuadTree.prototype.update = function( camera )
{
    this.root.update( camera );
}

cuardo.QuadTree.prototype.setLayerVisibility = function( layer, vis )
{
    var idx = this.visibleLayers.indexOf(layer);
    if (vis) {
        if ( idx === -1 ) {
            this.visibleLayers.push(layer);
            this.root.showLayer( layer );
        }
    }
    else {
        if ( idx !== -1 ) {
            this.visibleLayers.splice(idx, 1);
            this.root.hideLayer( layer );
        }
    }
}

cuardo.QuadTree.prototype.setVisibleLayers = function( layers )
{
    var that = this;
    layers.forEach( function(l) {
        if ( that.visibleLayers.indexOf(l) === -1 ) {
            // new visible layer
            that.root.showLayer(l);
        }
    });

    this.visibleLayers.forEach(function(l) {
        if ( layers.indexOf(l) === -1 ) {
            // layer removed
            that.root.hideLayer(l);
        }
    });
    this.visibleLayers = layers;
}

cuardo.QuadTree.prototype.addToCache = function( node )
{
    // delete old tiles
    //console.log('nb nodes ' + this.cache.length + ' max ' + this.maxCachedTiles);
    if ( this.cache.length >= this.maxCachedTiles ) {
        var nb = this.cache.length - this.maxCachedTiles + 1;
        for ( var i = 0; i < nb; i++ ) {
            var n = this.cache.shift();
            console.log('Discard ' + n.x + ' ' + n.y + ' ' + n.level);
            n.resetObject();
        }
    }

    this.cache.push( node )
}
