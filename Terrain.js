Terrain = function ( urlDem, urlTex, translation, nbIntervals ) {
    this.urlDem = urlDem;
    this.urlTex = urlTex;
    this.translation = translation;
    this.srid = 3946;
    this.extent = [1780810,5111630,1905820,5242220];
    this.nbIntervals = nbIntervals || 8;

    this.geometryTerrain = new THREE.PlaneGeometry(1, 1, this.nbIntervals, this.nbIntervals);
    this.geometryTerrain.computeFaceNormals();
    this.geometryTerrain.computeVertexNormals();
    this.geometryTerrain.computeTangents();

    this.demTextures = {};
    var terrainShader = THREE.ShaderTerrain[ "terrain" ];
    this.material = new THREE.ShaderMaterial({
        vertexShader:terrainShader.vertexShader,
        fragmentShader:terrainShader.fragmentShader,
        lights:true,
        fog:false
    });

}

Terrain.prototype.tile = function( center, size, tileId, callback ) {
    var mesh;
    var remaining = 3;
    var loaded = function(){
        remaining--;
        if (!remaining) callback(mesh);
    };
    var extendCenter = new THREE.Vector3().subVectors(center, this.translation );
    var ext = [extendCenter.x - size*.5,
               extendCenter.y - size*.5,
               extendCenter.x + size*.5,
               extendCenter.y + size*.5];
    textureDem = THREE.ImageUtils.loadTexture(this.urlDem + '&BBOX='+ext.join(','), null, loaded );
    //console.log(this.urlDem + '&BBOX='+ext.join(','));
    textureTex = THREE.ImageUtils.loadTexture(this.urlTex + '&BBOX='+ext.join(','), null, loaded);
    //console.log(this.urlTex + '&BBOX='+ext.join(','));

    var terrainShader = THREE.ShaderTerrain[ "terrain" ];
    var uniformsTerrain = THREE.UniformsUtils.clone(terrainShader.uniforms);
    

    this.demTextures[tileId] = textureDem;

    uniformsTerrain[ "tNormal" ].value = textureDem;
    uniformsTerrain[ "uNormalScale" ].value = 1;

    // the displacement determines the height of a vector, mapped to
    // the heightmap
    uniformsTerrain[ "tDisplacement" ].value = textureDem;
    uniformsTerrain[ "uDisplacementScale" ].value = 100;

    // the following textures can be use to finetune how
    // the map is shown. These are good defaults for simple
    // rendering
    uniformsTerrain[ "tDiffuse1" ].value = textureTex;
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
    //var material = new THREE.ShaderMaterial({
    //    uniforms:uniformsTerrain,
    //    vertexShader:terrainShader.vertexShader,
    //    fragmentShader:terrainShader.fragmentShader,
    //    lights:true,
    //    fog:false
    //});
    //var material = new THREE.MeshBasicMaterial( { color: 0xff0000, wireframe:true } );

    var material = this.material.clone();
    material.uniforms = uniformsTerrain; 
    // we use a plain to render as terrain
    // create a 3D object to add
    mesh = new THREE.Mesh(this.geometryTerrain, material);
    mesh.position = center;
    mesh.scale.x = size;
    mesh.scale.y = size;
    loaded();
}
