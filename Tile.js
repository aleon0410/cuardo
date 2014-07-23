Tile = function( size, x, y, level, quadtree ) {
    THREE.Object3D.call( this );

    // sub tiles
    this.tiles= [ [undefined, undefined], [undefined, undefined] ];
    // map of layerid -> 3d object
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

// assign an object to a leaf in the tree
// object is a map of layerid -> Object3D (group)
Tile.prototype.setObject = function( object, x /* = 0 */, y /* = 0 */, level /* = 0 */ ) {
    if ( level === undefined ) level = 0;
    if ( level == 0 ) {
        if ( this.object !== undefined ) {
            // already set
            return;
        }
        this.object = object;
        var that = this;
        for ( var lid = 0, l = object.length; lid < l; lid++ ) {
            if ( this.quadtree.visibleLayers.indexOf(lid) !== -1 ) {
                this.add( object[lid] );
            }
        }
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

Tile.prototype.hideLayer = function( layer )
{
    if (( this.object !== undefined ) && (this.object[layer] !== undefined )) {
        this.remove( this.object[layer] );
    }
    for ( var i = 0; i < 2; i++ ) {
        for ( var j = 0; j < 2; j++ ) {
            if (this.tiles[i][j] !== undefined ) {
                this.tiles[i][j].hideLayer(layer);
            }
        }
    }
}

Tile.prototype.showLayer = function( layer )
{
    if (( this.object !== undefined ) && (this.object[layer] !== undefined )) {
        var o = this.object[layer];
        if ( this.children.indexOf( o ) === -1 ) {
            this.add( this.object[layer] );
        }
    }
    for ( var i = 0; i < 2; i++ ) {
        for ( var j = 0; j < 2; j++ ) {
            if (this.tiles[i][j] !== undefined ) {
                this.tiles[i][j].showLayer(layer);
            }
        }
    }
}

Tile.prototype.changeVisibility = function( vis, layers )
{
    if ( this.object === undefined ) {
        return;
    }
    if ( layers === undefined ) layers = this.quadtree.visibleLayers;

    for ( var lid = 0, l = layers.length; lid < l; lid++ ) {
        var o = this.object[lid];
        if ( o.visible !== vis ) {
            changeVisibility( o, vis );
        }
    }
}

// set visible and all children invisible
Tile.prototype.setVisible = function( visible, layers ) {
    if ( visible === undefined ) visible = true;
    if ( layers === undefined ) layers = this.quadtree.visibleLayers;
    this.changeVisibility( visible, layers );

    for ( var i = 0; i < 2; i++ ) {
        for ( var j = 0; j < 2; j++ ) {
            if ( this.tiles[i][j] !== undefined ) {
                this.tiles[i][j].setVisible( false, layers );
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

changeVisibility = function( o, vis ) {
    o.visible = vis;
    o.traverse( function(obj) {
        obj.visible = vis;
    });
}

