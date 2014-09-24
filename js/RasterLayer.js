cuardo.RasterLayer = function( url, terrain )
{
    this.texIdx = terrain.addRaster( url );
    this.visible = true;
    this.terrain = terrain;
}


cuardo.RasterLayer.prototype.setVisibility = function( vis ){
    this.visible = vis;
    this.terrain.setTexVisibility( this.texIdx, vis );
}

cuardo.RasterLayer.prototype.tile = function( center, size, tileId, callback ) {
    callback(undefined);
}
