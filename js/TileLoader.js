TileLoader = function()
{
    this.queue = [];
    // function( n_loaded, n_total );
    this.progressCallback = function(a,b){};
    this.tilerProgressCallback = function(a,b){};
    this.nLoaded = 0;
    this.nTotal = 0;
}

TileLoader.instance = function()
{
    if (TileLoader.instance__ === undefined ) {
        TileLoader.instance__ = new TileLoader();
    }
    return TileLoader.instance__;
}

TileLoader.prototype.setProgressCallback = function( f )
{
    this.progressCallback = f;
}

TileLoader.prototype.setTilerProgressCallback = function( f )
{
    this.tilerProgressCallback = f;
}

TileLoader.prototype.enqueue = function( quadtree, x, y, level )
{
    var e = { x:x, y:y, level:level, quadtree:quadtree };
    if ( this.queue.indexOf(e) !== -1 ) {
        return;
    }
    // mark this object as 'loading in progress'
    quadtree.root.setObject( new Tile({}, Tile.State.LOADING), x, y, level );
    this.queue.push( e );
    this.nTotal += 1;
    this.progressCallback( this.nLoaded, this.nTotal );
}

var lastRender = 0;
TileLoader.prototype.load = function( renderFunction )
{
    var remaining = this.queue.length;
    while ( this.queue.length > 0 ) {
        var p = this.queue.shift();

        if ( p.quadtree.root.hasTile( p.x, p.y, p.level ) ) {
            // already loaded
            that.nLoaded += 1;
            that.progressCallback( that.nLoaded, that.nTotal );
            continue;
        }

        var that = this;
        var f = ( function( pp ) {
            return function( layers ) {
                if ( layers !== undefined ) {
                    that.nLoaded += 1;
                    that.progressCallback( that.nLoaded, that.nTotal );
                    var obj = new Tile( layers, Tile.State.LOADED );
                    p.quadtree.root.setObject( obj, pp.x, pp.y, pp.level );
                    if ( renderFunction !== undefined ) {
                        renderFunction();
                    }
                }
            };
        }) ( p );
        var c = p.quadtree.centerCoordinates( p.x, p.y, p.level );
        c.z = 0;
        var ss = p.quadtree.size / Math.pow(2,p.level);
        (p.quadtree.tiler.tile)( c, ss, this.tilerProgressCallback, f );
    }
}

