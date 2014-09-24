cuardo.LayerSet = function( layers ){
    this.layers = layers;
    this.visible = true;
}

cuardo.LayerSet.prototype.setVisibility = function( vis ){
    this.visible = vis;
    this.layers.forEach(function(l){ l.setVisibility( vis );});
}

cuardo.LayerSet.prototype.tile = function( center, size, tileId, callback ) {

    var group = new THREE.Object3D();
    var remaining = this.layers.length;
    for (var i=0; i<this.layers.length; i++){
        this.layers[i].tile( center, size, tileId, 
                function(g)
                { 
                    remaining --;
                    if (g) group.add(g);
                    if (!remaining) callback( group );
                } );
    }
}

