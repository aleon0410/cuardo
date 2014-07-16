Tiler = function( layers = [], translation = new THREE.Vector3(0,0,0), nbIntervals = 8) {
    this.translation = translation; // lyon epsg:3946 ~ [1849500, 5173000];
    this.size = 40000;
    this.geom = new THREE.PlaneGeometry(1, 1, nbIntervals, nbIntervals);
    this.layers = layers;
    this.srid = 0;

    this.layers.forEach(function(l){
        var ext = l.extent;
        this.size = Math.max( this.size, Math.max(ext[2]-ext[0], ext[3]-ext[1]) ); 
        if ( this.srid && l.srid != this.srid ) {
            throw "layers srid don't match";
        }
        else {
            this.srid = l.srid;
        }

    });
};

Tiler.prototype.tile = function( center, size, callback ) {
    var group = new THREE.Object3D();
    // add basic grid for debug
    {
        var mesh = new THREE.Mesh(this.geom, 
            new THREE.MeshBasicMaterial( { color: Math.random()*0xffffff, wireframe:true } ));
        mesh.position = center;
        mesh.scale.x = size;
        mesh.scale.y = size;
        group.add(mesh);
    }
    this.layers.forEach(function(l){
        l.tile( center, size, 
            function(mesh){
                group.add(mesh);
            });
    });
    callback( group );
};

Terrain = function ( urlDem, urlTex, translation, nbIntervals = 8 ) {
    this.urlDem = urlDem;
    this.urlTex = urlTex;
    this.translation = translation;
    this.srid = 3946;
    this.extent = [1780810,5111630,1905820,5242220];

    this.geometryTerrain = new THREE.PlaneGeometry(1, 1, nbIntervals, nbIntervals);
    this.geometryTerrain.computeFaceNormals();
    this.geometryTerrain.computeVertexNormals();
    this.geometryTerrain.computeTangents();

}

Terrain.prototype.tile = function( center, size, callback ) {
    var extendCenter = new THREE.Vector3().subVectors(center, this.translation );
    console.log('center=',center,' translation=', this.translation, ' extendCenter=', extendCenter);
    var ext = [extendCenter.x - size*.5,
               extendCenter.y - size*.5,
               extendCenter.x + size*.5,
               extendCenter.y + size*.5];
    console.log('ext=',ext);
    this.textureDem = THREE.ImageUtils.loadTexture(this.urlDem + '&BBOX='+ext.join(','), null, function(){console.log('loaded dem');});
    console.log(this.urlDem + '&BBOX='+ext.join(','));
    this.textureTex = THREE.ImageUtils.loadTexture(this.urlTex + '&BBOX='+ext.join(','), null, function(){console.log('loaded tex');});
    console.log(this.urlTex + '&BBOX='+ext.join(','));

    var terrainShader = THREE.ShaderTerrain[ "terrain" ];
    var uniformsTerrain = THREE.UniformsUtils.clone(terrainShader.uniforms);
    
    uniformsTerrain[ "tNormal" ].value = this.textureTex;
    uniformsTerrain[ "uNormalScale" ].value = 1;

    // the displacement determines the height of a vector, mapped to
    // the heightmap
    uniformsTerrain[ "tDisplacement" ].value = this.textureDem;
    uniformsTerrain[ "uDisplacementScale" ].value = 1000;

    // the following textures can be use to finetune how
    // the map is shown. These are good defaults for simple
    // rendering
    uniformsTerrain[ "tDiffuse1" ].value = this.textureTex;
    //uniformsTerrain[ "tDetail" ].value = texture;
    uniformsTerrain[ "enableDiffuse1" ].value = true;
    //uniformsTerrain[ "enableDiffuse2" ].value = true;
    //uniformsTerrain[ "enableSpecular" ].value = true;

    // diffuse is based on the light reflection
    //uniformsTerrain[ "diffuse" ].value.setHex(0xcccccc);
    //uniformsTerrain[ "specular" ].value.setHex(0xff0000);
    // is the base color of the terrain
    uniformsTerrain[ "ambient" ].value.setHex(0xffffff);

    // how shiny is the terrain
    uniformsTerrain[ "shininess" ].value = 3;

    // handles light reflection
    //uniformsTerrain[ "uPixelScale" ].value.set(
    //        (ext[2]-ext[0])/texture.image.width, 
    //        (ext[3]-ext[1])/texture.image.height);


    // configure the material that reflects our terrain
    var material = new THREE.ShaderMaterial({
        uniforms:uniformsTerrain,
        vertexShader:terrainShader.vertexShader,
        fragmentShader:terrainShader.fragmentShader,
        lights:true,
        fog:false
    });
    //var material = new THREE.MeshBasicMaterial( { color: 0xff0000, wireframe:true } );

    // we use a plain to render as terrain
    // create a 3D object to add
    mesh = new THREE.Mesh(this.geometryTerrain, material);
    mesh.position = center;
    mesh.scale.x = size;
    mesh.scale.y = size;
    callback( mesh );
}
