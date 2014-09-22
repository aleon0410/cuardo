cuardo.QuadNode = function( size, x, y, level, quadtree ) {
    THREE.Object3D.call( this );

    // sub tiles
    this.nodes = [ [undefined, undefined], [undefined, undefined] ];
    // instances of Tile or undefined
    this.object = new cuardo.Tile( {}, cuardo.Tile.State.EMPTY );
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
cuardo.QuadNode.prototype = Object.create( THREE.Object3D.prototype );

cuardo.QuadNode.prototype.hasTile = function( x, y, level ) {
    if ( level == 0 ) {
        return this.object.isLoaded();
    }
    nl = 1 << (level-1);
    var dx = ~~(x / nl);
    var dy = ~~(y / nl);
    var rx = x % nl;
    var ry = y % nl;
    if ( this.nodes[dx][dy] !== undefined && this.nodes[dx][dy].hasTile( rx, ry, level-1 ) ) {
        return true;
    }
    return false;
}

// assign an object to a leaf in the tree
// object is a map of layerid -> Object3D (group)
cuardo.QuadNode.prototype.setObject = function( object, x /* = 0 */, y /* = 0 */, level /* = 0 */ ) {
    if ( level === undefined ) level = 0;
    if ( level == 0 ) {
        if ( this.object.isLoaded() ) {
            // already set
            return;
        }

        this.object = object;
        if ( ! this.object.isLoaded() ) {
            return;
        }
        // add the object to the cache
        this.quadtree.addToCache( this );

        var that = this;
        for ( var lid in object.layers ) {
            if ( this.quadtree.visibleLayers.indexOf(lid) !== -1 ) {
                this.add( object.layers[lid] );
            }
        }
    }
    else {
        nl = 1 << (level-1);
        var dx = ~~(x / nl);
        var dy = ~~(y / nl);
        var rx = x % nl;
        var ry = y % nl;
        if ( this.nodes[dx][dy] === undefined ) {
            var t = new cuardo.QuadNode( this.size / 2, this.x*2+dx, this.y*2+dy, this.level+1, this.quadtree );
            this.nodes[dx][dy] = t;
            this.add( t );
        }
        this.nodes[dx][dy].setObject( object, rx, ry, level-1 );
    }
}

cuardo.QuadNode.prototype.resetObject = function()
{
    var object = this.object;
    for ( var lid in object.layers ) {
        if ( this.quadtree.visibleLayers.indexOf(lid) !== -1 ) {
            this.remove( object.layers[lid] );
        }
    }
    this.object = new cuardo.Tile( {}, cuardo.Tile.State.EMPTY );
}

cuardo.QuadNode.prototype.hideLayer = function( layer )
{
    if (( this.object.isLoaded() ) && (this.object.layers[layer] !== undefined )) {
        this.remove( this.object.layers[layer] );
    }
    for ( var i = 0; i < 2; i++ ) {
        for ( var j = 0; j < 2; j++ ) {
            if (this.nodes[i][j] !== undefined ) {
                this.nodes[i][j].hideLayer(layer);
            }
        }
    }
}

cuardo.QuadNode.prototype.showLayer = function( layer )
{
    if (( this.object.isLoaded() ) && (this.object.layers[layer] !== undefined )) {
        var o = this.object.layers[layer];
        if ( this.children.indexOf( o ) === -1 ) {
            this.add( o );
        }
    }
    for ( var i = 0; i < 2; i++ ) {
        for ( var j = 0; j < 2; j++ ) {
            if (this.nodes[i][j] !== undefined ) {
                this.nodes[i][j].showLayer(layer);
            }
        }
    }
}

cuardo.QuadNode.prototype.changeVisibility = function( vis )
{
    if ( ! this.object.isLoaded() ) {
        return;
    }
    this.object.changeVisibility( vis );
}

// set visible and all children invisible
cuardo.QuadNode.prototype.setVisible = function( visible ) {
    if ( visible === undefined ) visible = true;
    this.changeVisibility( visible );

    for ( var i = 0; i < 2; i++ ) {
        for ( var j = 0; j < 2; j++ ) {
            if ( this.nodes[i][j] !== undefined ) {
                this.nodes[i][j].setVisible( false );
            }
        }
    }
}

// update visibility based on camera distance
cuardo.QuadNode.prototype.update = function( camera, lastLoaded ) {
    var v1 = new THREE.Vector3();
    var v2 = new THREE.Vector3();
    v1.setFromMatrixPosition( camera.matrixWorld );

    // center coordinate
    c = this.quadtree.centerCoordinates( this.x, this.y, this.level );

    v2.setX( c.x );
    v2.setY( c.y );
    var d = v1.distanceTo( v2 );

    // distance to see LOD0 (the whole quadtree)
    var md = 0.5 * this.quadtree.size / Math.tan( camera.fov/2.0 * Math.PI / 180.0 );
    // requested lod
    var lod = (Math.log(md / d) / Math.log(2)) | 0;
    if ( lod < 0 ) lod = 0;
    if ( lod > this.quadtree.maxLOD ) lod = this.quadtree.maxLOD;

    if ( (lod == this.level) && (this.object.isEmpty()) ) {
        cuardo.TileLoader.instance().enqueue( this.quadtree, this.x, this.y, this.level );
    }

    if ( this.level >= lod ) {
        if ( this.object.isLoaded() ) {
            // set visible and children to invisible
            this.setVisible();
        }
        else {
            var isLeaf = true;
            for ( var i = 0; i < 2; i++ ) {
                for ( var j = 0; j < 2; j++ ) {
                    if ( this.nodes[i][j] !== undefined ) {
                        isLeaf = false;
                        this.nodes[i][j].update( camera, lastLoaded );
                    }
                }
            }
            if ( isLeaf && lastLoaded ) {
                lastLoaded.changeVisibility( true );
            }
        }
    }
    else if ( this.level < lod ) {
        if ( this.object.isLoaded() ) {
            // set to invisible for now
            this.changeVisibility( false );
            // but it could be reverted to visible if no children can be visible
            lastLoaded = this;
        }

        for ( var i = 0; i < 2; i++ ) {
            for ( var j = 0; j < 2; j++ ) {
                if ( this.nodes[i][j] === undefined ) {
                    cuardo.TileLoader.instance().enqueue( this.quadtree, this.x*2+i, this.y*2+j, this.level+1 );
                    if ( lastLoaded ) {
                        lastLoaded.changeVisibility( true );
                    }
                }
                else {
                    this.nodes[i][j].update( camera, lastLoaded );
                }
            }
        }
    }
}

