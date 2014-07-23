// class representing objects stored in a QuadNode
// i.e. some 3D objects per layer
Tile = function( layers, state ) {
    // map of layer id -> 3D objects
    if ( layers === undefined ) layers = {};
    this.layers = layers;

    if ( state === undefined ) state = Tile.State.LOADED;
    this.state = state;
};

Tile.State = {
    EMPTY : 0,
    LOADING : 1,
    LOADED : 2
};

Tile.prototype.isEmpty = function() {
    return this.state == Tile.State.EMPTY;
}

Tile.prototype.isLoading = function() {
    return this.state == Tile.State.LOADING;
}

Tile.prototype.isLoaded = function() {
    return this.state == Tile.State.LOADED;
}
