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
    for (var i=0; i<this.tiler.layers.length; i++ ){
        if (this.tiler.layers[i].visible) this.root.showLayer( i );
        else this.root.hideLayer(i);
    }

    this.root.update( camera );
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
