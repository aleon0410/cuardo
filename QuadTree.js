// quad of size x size, centered on x,y
QuadTree = function( size, lod, tiler ) {
    THREE.Object3D.call( this );

    // max LOD
    this.maxLOD = lod;
    // size of an edge
    this.size = size;

    // tiling function
    this.tiler = tiler;

    // the root tile
    this.tile = new Tile( size, 0, 0, 0, this );
    this.add( this.tile );

    // visible layers
    // all layers are visible at construction
    this.visibleLayers = [];
    for ( var lid = 0; lid < this.tiler.layers.length; lid++ ) {
        this.visibleLayers.push(lid);
    }
}

// inherits from Object3D
QuadTree.prototype = Object.create( THREE.Object3D.prototype );

QuadTree.prototype.setObject = function( object, level )
{
    var x = (object.position.x - this.position.x + this.size/2) / this.size;
    var y = (object.position.y - this.position.y + this.size/2) / this.size;
    var nl = 1<<level;
    var dx = ~~(x*nl);
    var dy = ~~(y*nl);
    this.tile.setObject( object, dx, dy, level );
}

//
// get center coordinates (in quadtree coordinates)
QuadTree.prototype.centerCoordinates = function( x, y, level )
{
    var tileSize = this.size / Math.pow(2,level);
    var xc = (x+0.5) * tileSize - this.size / 2;
    var yc = (y+0.5) * tileSize - this.size / 2;
    return {x:xc, y:yc};
}

// update object visibility based on current camera
QuadTree.prototype.update = function( camera )
{
    this.tile.update( camera );
}

QuadTree.prototype.setLayerVisibility = function( layer, vis )
{
    if (vis) this.tile.showLayer( layer );
    else this.tile.hideLayer( layer );
}

QuadTree.prototype.setVisibleLayers = function( layers )
{
    var that = this;
    layers.forEach( function(l) {
        if ( that.visibleLayers.indexOf(l) === -1 ) {
            // new visible layer
            that.tile.showLayer(l);
        }
    });

    this.visibleLayers.forEach(function(l) {
        if ( layers.indexOf(l) === -1 ) {
            // layer removed
            that.tile.hideLayer(l);
        }
    });
    this.visibleLayers = layers;
}
