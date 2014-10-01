var vertexShader= [

        "#define LAMBERT",

        "varying vec3 vLightFront;",

        "#ifdef DOUBLE_SIDED",

        "        varying vec3 vLightBack;",

        "#endif",

        "#if defined( USE_MAP ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP ) || defined( USE_SPECULARMAP ) || MAX_MAPS > 0",

        "	varying vec2 vUv;",
        "	uniform vec4 offsetRepeat;",

        "#endif",

        THREE.ShaderChunk[ "lightmap_pars_vertex" ],
        THREE.ShaderChunk[ "envmap_pars_vertex" ],
        THREE.ShaderChunk[ "lights_lambert_pars_vertex" ],
        THREE.ShaderChunk[ "color_pars_vertex" ],
        THREE.ShaderChunk[ "morphtarget_pars_vertex" ],
        THREE.ShaderChunk[ "skinning_pars_vertex" ],
        THREE.ShaderChunk[ "shadowmap_pars_vertex" ],
        THREE.ShaderChunk[ "logdepthbuf_pars_vertex" ],

        "void main() {",

		"#if defined( USE_MAP ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP ) || defined( USE_SPECULARMAP ) || MAX_MAPS > 0",

		"	vUv = uv * offsetRepeat.zw + offsetRepeat.xy;",

		"#endif",

                THREE.ShaderChunk[ "lightmap_vertex" ],
                THREE.ShaderChunk[ "color_vertex" ],

                THREE.ShaderChunk[ "morphnormal_vertex" ],
                THREE.ShaderChunk[ "skinbase_vertex" ],
                THREE.ShaderChunk[ "skinnormal_vertex" ],
                THREE.ShaderChunk[ "defaultnormal_vertex" ],

                THREE.ShaderChunk[ "morphtarget_vertex" ],
                THREE.ShaderChunk[ "skinning_vertex" ],
                THREE.ShaderChunk[ "default_vertex" ],
                THREE.ShaderChunk[ "logdepthbuf_vertex" ],

                THREE.ShaderChunk[ "worldpos_vertex" ],
                THREE.ShaderChunk[ "envmap_vertex" ],
                THREE.ShaderChunk[ "lights_lambert_vertex" ],
                THREE.ShaderChunk[ "shadowmap_vertex" ],
                //"vLightFront = vec3(1);",

        "}"

].join("\n");

var fragmentShader = [

        "uniform float opacity;",

        "varying vec3 vLightFront;",

        "#ifdef DOUBLE_SIDED",

        "        varying vec3 vLightBack;",

        "#endif",

        THREE.ShaderChunk[ "color_pars_fragment" ],


        "#if defined( USE_MAP ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP ) || defined( USE_SPECULARMAP ) || defined( MAX_MAPS )",

        "	varying vec2 vUv;",

        "#endif",

        "#ifdef USE_MAP",

        "	uniform sampler2D map;",

        "#endif",

        "#if MAX_MAPS > 0",

        "       uniform sampler2D maps[MAX_MAPS];",
        "       uniform int visibleMaps[MAX_MAPS];",
        
        "#endif",


        THREE.ShaderChunk[ "lightmap_pars_fragment" ],
        THREE.ShaderChunk[ "envmap_pars_fragment" ],
        THREE.ShaderChunk[ "fog_pars_fragment" ],
        THREE.ShaderChunk[ "shadowmap_pars_fragment" ],
        THREE.ShaderChunk[ "specularmap_pars_fragment" ],
        THREE.ShaderChunk[ "logdepthbuf_pars_fragment" ],

        "void main() {",

        //"        gl_FragColor = vec4( vec3( 1.0 ), opacity );",
        "        gl_FragColor = vec4(1);",

                THREE.ShaderChunk[ "logdepthbuf_fragment" ],
                THREE.ShaderChunk[ "map_fragment" ],

                "#if MAX_MAPS > 0",


                "        vec4 texelColor = vec4(1);",

                "        for (int i=0; i<MAX_MAPS; i++)",
                "               texelColor *= (visibleMaps[i] == 1 ? texture2D( maps[i], vUv ) : vec4(1));",

                "        #ifdef GAMMA_INPUT",

                //"                texelColor.xyz *= texelColor.xyz;",

                "        #endif",

                "        gl_FragColor = gl_FragColor * texelColor;",

                "#endif",
                
                THREE.ShaderChunk[ "alphatest_fragment" ],
                THREE.ShaderChunk[ "specularmap_fragment" ],


        "        #ifdef DOUBLE_SIDED",

                        //"float isFront = float( gl_FrontFacing );",
                        //"gl_FragColor.xyz *= isFront * vLightFront + ( 1.0 - isFront ) * vLightBack;",

        "                if ( gl_FrontFacing )",
        "                        gl_FragColor.xyz *= vLightFront;",
        "                else",
        "                        gl_FragColor.xyz *= vLightBack;",

        "        #else",

        "                gl_FragColor.xyz *= vLightFront;",

        "        #endif",

                THREE.ShaderChunk[ "lightmap_fragment" ],
                THREE.ShaderChunk[ "color_fragment" ],
                THREE.ShaderChunk[ "envmap_fragment" ],
                THREE.ShaderChunk[ "shadowmap_fragment" ],

                THREE.ShaderChunk[ "linear_to_gamma_fragment" ],

                THREE.ShaderChunk[ "fog_fragment" ],

        "}"

].join("\n");

cuardo.Terrain = function ( urlDem, nbIntervals, zScale, symbology ) {
    this.urlDem = urlDem;

    this.symbology = symbology || {diffuse:0xffffff, ambient:0x555555, reflectivity:0};

    this.urlTex = [];
    this.visibleTex = [];

    this.nbIntervals = nbIntervals || 32;
    this.zScale = zScale || 255;

    this.geom = {};
    this.canvas = document.createElement( 'canvas' );
    this.visible = false;
}

cuardo.Terrain.prototype.setVisibility = function( vis ){
    this.visible = vis;
}

cuardo.Terrain.prototype.setTexVisibility = function( idx, vis ){
    this.visibleTex[idx] = vis ? 1 : 0;
}


cuardo.Terrain.prototype.addRaster = function( url ){
    this.urlTex.push( url );
    this.visibleTex.push(1);
    return this.visibleTex.length - 1;
}

cuardo.Terrain.prototype.getImageData = function( image ) {

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

cuardo.Terrain.prototype.tile = function( center, size, tileId, callback ) {
    var mesh;
    var remaining = 1 + this.urlTex.length;
    var textureDem;
    var textureTex = [];
    var object = this;
    var loaded = function(){
        remaining--;
        if (!remaining){
            var imagedata = object.getImageData( textureDem.image );
            var geom =  new cuardo.PlaneGeometry(center, size, object.nbIntervals);
            var pos = geom.attributes.position.array;
            var uv = geom.attributes.uv.array;
            for (var i=0, end=geom.attributes.position.array.length/3; i<end; i++){
                pos[i*3+2] = object.zScale * getPixel( imagedata, uv[i*2], uv[i*2+1]).r;
            }
            geom.computeVertexNormals();
            //geom.computeTangents();
            var material = new THREE.MeshLambertMaterial( 
                    { map : textureTex[0] || null,
                    } );
            var lambertShader = THREE.ShaderLib['lambert'];
            var uniforms = THREE.UniformsUtils.clone(lambertShader.uniforms);
            uniforms['visibleMaps'] = { type: "iv1", value: object.visibleTex };
            uniforms['maps'] = { type: "tv", value: textureTex };
            //uniforms['map'].value = textureTex[0];
            uniforms['diffuse'].value.setHex(object.symbology.diffuse || 0xffffff);
            uniforms['ambient'].value.setHex(object.symbology.ambient || 0x555555);
            uniforms['reflectivity'].value = object.symbology.reflectivity || 0;
            var newmaterial = new THREE.ShaderMaterial(
                    {
                        uniforms: uniforms,
                        vertexShader: vertexShader,
                        fragmentShader: fragmentShader,
                        defines : {'MAX_MAPS' : object.urlTex.length, 'USE_COLOR':'1', 'WRAP_AROUND':'0'},
                        lights: true
                    }
                    );
            mesh = new THREE.Mesh(geom, newmaterial);
            mesh.userData = {type:'terrain'};


            object.geom[tileId] = geom;
            //callback(new THREE.WireframeHelper(mesh));
            callback(mesh);
        }
    };
    var extendCenter = new THREE.Vector3().subVectors(center, cuardo.translation );
    var ext = [extendCenter.x - size*.5,
               extendCenter.y - size*.5,
               extendCenter.x + size*.5,
               extendCenter.y + size*.5];
    textureDem = THREE.ImageUtils.loadTexture(this.urlDem + '&BBOX='+ext.join(','), null, loaded);

    if (this.urlTex.length ) {
        for (var i=0; i<this.urlTex.length; i++){
            textureTex[i] = THREE.ImageUtils.loadTexture(this.urlTex[i] + '&BBOX='+ext.join(','), 
                    null, 
                    function(){
                        loaded();
                    })
        }
    }

}

