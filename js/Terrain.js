Terrain = function ( urlDem, urlTex, translation, nbIntervals, zScale ) {
    this.urlDem = urlDem;
    this.urlTex = urlTex;
    this.translation = translation;
    this.srid = 3946;
    this.extent = [1780810,5111630,1905820,5242220];
    this.nbIntervals = nbIntervals || 8;
    this.zScale = zScale || 255;

    this.geom = {};
    this.canvas = document.createElement( 'canvas' );
}

Terrain.prototype.getImageData = function( image ) {

    this.canvas.width = image.width;
    this.canvas.height = image.height;

    var context = this.canvas.getContext( '2d' );
    context.drawImage( image, 0, 0 );

    return context.getImageData( 0, 0, image.width, image.height );
}

var OVER_255 = 1./255;
function getPixel(imagedata, dx, dy) {
    var x = Math.round((imagedata.width - 1) * dx);
    var y = Math.round((imagedata.height -1) * (1-dy));

    var position = ( x + imagedata.width * y ) * 4, data = imagedata.data;
    
    return { r: imagedata.data[ position ] * OVER_255, 
             g: imagedata.data[ position + 1 ] * OVER_255, 
             b: imagedata.data[ position + 2 ] * OVER_255, 
             a: imagedata.data[ position + 3 ] * OVER_255};
}


Terrain.prototype.tile = function( center, size, tileId, callback ) {
    var mesh;
    var remaining = 2;
    var textureDem;
    var textureTex;
    var object = this;
    var loaded = function(){
        remaining--;
        if (!remaining){
            var imagedata = object.getImageData( textureDem.image );
            var geom =  new PlaneGeometry(center, size, object.nbIntervals);
            var pos = geom.attributes.position.array;
            var uv = geom.attributes.uv.array;
            for (var i=0, end=geom.attributes.position.array.length/3; i<end; i++){
                pos[i*3+2] = object.zScale * getPixel( imagedata, uv[i*2], uv[i*2+1]).r;
            }
            geom.computeVertexNormals();
            //geom.computeTangents();
            var material = new THREE.MeshLambertMaterial( 
                    { color: 0xfffffff,
                      map : textureTex,
                      reflectivity: 0,
                      //wireframe:true
                    } );
            mesh = new THREE.Mesh(geom, material);
            object.geom[tileId] = geom;
            callback(mesh);
        }
    };
    var extendCenter = new THREE.Vector3().subVectors(center, this.translation );
    var ext = [extendCenter.x - size*.5,
               extendCenter.y - size*.5,
               extendCenter.x + size*.5,
               extendCenter.y + size*.5];
    textureDem = THREE.ImageUtils.loadTexture(this.urlDem + '&BBOX='+ext.join(','), null, loaded);
    textureTex = THREE.ImageUtils.loadTexture(this.urlTex + '&BBOX='+ext.join(','), null, loaded);

}
