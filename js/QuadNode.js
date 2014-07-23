QuadNode = function( size, x, y, level, quadtree ) {
    THREE.Object3D.call( this );

    // sub tiles
    this.nodes = [ [undefined, undefined], [undefined, undefined] ];
    // instances of Tile or undefined
    this.object = new Tile( {}, Tile.State.EMPTY );
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
QuadNode.prototype = Object.create( THREE.Object3D.prototype );

QuadNode.prototype.hasTile = function( x, y, level ) {
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
QuadNode.prototype.setObject = function( object, x /* = 0 */, y /* = 0 */, level /* = 0 */ ) {
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
        var that = this;
        for ( var lid = 0, l = object.layers.length; lid < l; lid++ ) {
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
            var t = new QuadNode( this.size / 2, this.x*2+dx, this.y*2+dy, this.level+1, this.quadtree );
            this.nodes[dx][dy] = t;
            this.add( t );
        }
        this.nodes[dx][dy].setObject( object, rx, ry, level-1 );
    }
}

QuadNode.prototype.hideLayer = function( layer )
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

QuadNode.prototype.showLayer = function( layer )
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

QuadNode.prototype.changeVisibility = function( vis )
{
    if ( ! this.object.isLoaded() ) {
        return;
    }
    changeVisibility_( this, vis );
}

// set visible and all children invisible
QuadNode.prototype.setVisible = function( visible ) {
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

QuadNode.prototype.hasAllChildren = function() {
    return (this.nodes[0][0] !== undefined) && (this.nodes[0][1] !== undefined) &&
        (this.nodes[1][0] !== undefined) && (this.nodes[1][1] !== undefined);
}

QuadNode.prototype.hasAllChildrenLoaded = function() {
    return this.nodes[0][0].object.isLoaded() &&
        this.nodes[0][1].object.isLoaded() &&
        this.nodes[1][0].object.isLoaded() &&
        this.nodes[1][1].object.isLoaded();
}

// update visibility based on camera distance
QuadNode.prototype.update = function( camera ) {
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
        if (this.object.isEmpty()) {
            TileLoader.instance().enqueue( this.quadtree, this.x, this.y, this.level );
        }
        // set visible and children to invisible
        this.setVisible();
    }
    else if ( lod > this.level ) {
        if ( this.hasAllChildren() ) {
            // children tiles are available
            if ( this.hasAllChildrenLoaded() ) {
                this.changeVisibility( false );
            }
            this.nodes[0][0].update( camera );
            this.nodes[0][1].update( camera );
            this.nodes[1][0].update( camera );
            this.nodes[1][1].update( camera );
        }
        else {
            // we need new tiles
            for ( var i = 0; i < 2; i++ ) {
                for ( var j = 0; j < 2; j++ ) {
                    if ( this.nodes[i][j] === undefined ) {
                        TileLoader.instance().enqueue( this.quadtree, this.x*2+i, this.y*2+j, this.level+1 );
                    }
                }
            }

            // stop at this level for now
            this.setVisible();
        }
    }
}

changeVisibility_ = function( o, vis ) {
    o.traverse( function(obj) {
        obj.visible = vis;
    });
}

