cuardo.RasterLayer = function( url, terrain )
{
    this.texIdx = terrain.addRaster( url );
    this.terrain = terrain;
    this.setVisibility( false );
}


cuardo.RasterLayer.prototype.setVisibility = function( vis ){
    this.visible = vis;
    this.terrain.setTexVisibility( this.texIdx, vis );
}

cuardo.RasterLayer.prototype.tile = function( center, size, tileId, callback ) {
    callback(undefined);
}
