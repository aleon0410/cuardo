TileLoader = function()
{
    this.queue = [];
}

TileLoader.instance = function()
{
    if (TileLoader.instance__ === undefined ) {
        TileLoader.instance__ = new TileLoader();
    }
    return TileLoader.instance__;
}

TileLoader.prototype.enqueue = function( quadtree, x, y, level )
{
    var e = { x:x, y:y, level:level, quadtree:quadtree };
    if ( this.queue.indexOf(e) !== -1 ) {
        return;
    }
    this.queue.push( e );
}

var lastRender = 0;
TileLoader.prototype.load = function( renderFunction )
{
    while ( this.queue.length > 0 ) {
        var p = this.queue.shift();

        if ( p.quadtree.tile.hasTile( p.x, p.y, p.level ) ) {
            // already loaded
            continue;
        }

        var f = ( function( pp ) {
            return function( obj ) {
                if ( obj !== undefined ) {
                    p.quadtree.tile.setObject( obj, pp.x, pp.y, pp.level );
                    if ( renderFunction !== undefined ) {
                        // only ask for a refresh when the last refresh was asked
                        // not too much recently
                        var now = performance.now();
                        if ( (now - lastRender) > 50 ) { // milliseconds
                            setTimeout(renderFunction,0);
                            lastRender = now;
                        }
                    }
                }
            };
        }) ( p );
        var c = p.quadtree.centerCoordinates( p.x, p.y, p.level );
        c.z = 0;
        var ss = p.quadtree.size / Math.pow(2,p.level);
        (p.quadtree.tiler.tile)( c, ss, f );
    }
}

