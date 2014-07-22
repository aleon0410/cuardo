
var container, stats;
var camera, controls, scene, renderer;
var depthMaterial, depthTarget;
var objects = [];
var projector, particleMaterial;
var text;
var headerText;
var EPSILON = 1e-12;

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
                    obj.visible = false;
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

Tile = function( size, x, y, level, quadtree ) {
    THREE.Object3D.call( this );

    // sub tiles
    this.tiles= [ [undefined, undefined], [undefined, undefined] ];
    this.object = undefined;
    // tile size FIXME useless ?
    this.size = size;

    // coordinate of the tile
    this.x = x;
    this.y = y;
    this.level = level;
    this.tiler = quadtree.tiler;
    this.quadtree = quadtree;
}

// inherits from Object3D
Tile.prototype = Object.create( THREE.Object3D.prototype );

Tile.prototype.hasTile = function( x, y, level ) {
    if ( level == 0 ) {
        return this.object !== undefined;
    }
    nl = 1 << (level-1);
    var dx = ~~(x / nl);
    var dy = ~~(y / nl);
    var rx = x % nl;
    var ry = y % nl;
    if ( this.tiles[dx][dy] !== undefined && this.tiles[dx][dy].hasTile( rx, ry, level-1 ) ) {
        return true;
    }
    return false;
}
Tile.prototype.setObject = function( object, x /* = 0 */, y /* = 0 */, level /* = 0 */ ) {
    if ( level === undefined ) level = 0;
    if ( level == 0 ) {
        if ( this.object !== undefined ) {
            // already set
            return;
        }
        this.object = object;
        this.add( object );
    }
    else {
        nl = 1 << (level-1);
        var dx = ~~(x / nl);
        var dy = ~~(y / nl);
        var rx = x % nl;
        var ry = y % nl;
        if ( this.tiles[dx][dy] === undefined ) {
            var t = new Tile( this.size / 2, this.x*2+dx, this.y*2+dy, this.level+1, this.quadtree );
            this.tiles[dx][dy] = t;
            this.add( t );
        }
        this.tiles[dx][dy].setObject( object, rx, ry, level-1 );
    }
}

Tile.prototype.changeVisibility = function( vis )
{
    if ( this.object === undefined ) {
        return;
    }
    if ( this.object.visible != vis ) {
//        consoleTer.log(this.x, this.y, this.level, "Changed from ", this.object.visible, " to ", vis );
    }
    this.object.visible = vis;
    if ( this.object.constructor === THREE.Object3D ) {
        // probably a group
        this.object.children.forEach(function(c){
            c.visible = vis;
        });
    }
}

// set visible and all children invisible
Tile.prototype.setVisible = function( visible ) {
    if ( visible === undefined ) visible = true;
    this.changeVisibility( visible );

    for ( var i = 0; i < 2; i++ ) {
        for ( var j = 0; j < 2; j++ ) {
            if ( this.tiles[i][j] !== undefined ) {
                this.tiles[i][j].setVisible( false );
            }
        }
    }
}

Tile.prototype.hasAllChildren = function() {
    return (this.tiles[0][0] !== undefined) && (this.tiles[0][1] !== undefined) &&
        (this.tiles[1][0] !== undefined) && (this.tiles[1][1] !== undefined);
}

// update visibility based on camera distance
Tile.prototype.update = function( camera ) {
    var v1 = new THREE.Vector3();
    var v2 = new THREE.Vector3();
    v1.setFromMatrixPosition( camera.matrixWorld );

    // center coordinate
    c = this.quadtree.centerCoordinates( this.x, this.y, this.level );

    v2.setX( c.x );
    v2.setY( c.y );
    var d = v1.distanceTo( v2 );
    // requested lod
    var lod = ~~(1/d*1700);
    if ( lod > this.quadtree.maxLOD ) lod = this.quadtree.maxLOD;

    if ( lod <= this.level ) {
        if (this.object === undefined) {
            TileLoader.instance().enqueue( this.quadtree, this.x, this.y, this.level );
        }

        // set visible and children to invisible
        this.setVisible();
    }
    else if ( lod > this.level ) {
        if ( this.hasAllChildren() ) {
            // children tiles are available
            this.changeVisibility( false );
            this.tiles[0][0].update( camera );
            this.tiles[0][1].update( camera );
            this.tiles[1][0].update( camera );
            this.tiles[1][1].update( camera );
        }
        else {
            // we need new tiles
            var nNewTiles = 1 << (lod-this.level);
            var xx = this.x << (lod-this.level);
            var yy = this.y << (lod-this.level);
            for ( var i = 0; i < nNewTiles; i++ ) {
                for ( var j = 0; j < nNewTiles; j++ ) {
                    TileLoader.instance().enqueue( this.quadtree, xx+i, yy+j, lod );
                }
            }

            // stop at this level for now
            this.setVisible();
        }
    }
}

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
