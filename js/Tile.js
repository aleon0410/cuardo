// class representing objects stored in a QuadNode
// i.e. some 3D objects per layer
cuardo.Tile = function( layers, state ) {
    // map of layer id -> 3D objects
    if ( layers === undefined ) layers = [];
    this.layers = layers;

    if ( state === undefined ) state = cuardo.Tile.State.LOADED;
    this.state = state;
};

cuardo.Tile.State = {
    EMPTY : 0,
    LOADING : 1,
    LOADED : 2
};

cuardo.Tile.prototype.isEmpty = function() {
    return this.state === cuardo.Tile.State.EMPTY;
}

cuardo.Tile.prototype.isLoading = function() {
    return this.state === cuardo.Tile.State.LOADING;
}

cuardo.Tile.prototype.isLoaded = function() {
    return this.state === cuardo.Tile.State.LOADED;
}

cuardo.Tile.prototype.changeVisibility = function( vis )
{
    for ( var lid in this.layers ) {
        this.layers[lid].traverse( function(obj) {
            obj.visible = vis;
        });
    }
}
