cuardo.renderAsked = true; // try to transform this into member variable at your own risk

cuardo.Map = function(target, layers, sceneSize, maxLOD, maxCachedTiles){

    this.target = document.getElementById(target);
    if (!this.target) throw 'cannot find element '+target;

    this.camera; 
    this.scene;
    this.renderer;
    this.depthMaterial;
    this.depthTarget;
    this.layers = layers

    var that = this;
    window.addEventListener( 'resize', 
            function () {
                that.camera.aspect = that.width() / that.height();
                that.camera.updateProjectionMatrix();
                that.renderer.setSize( that.width(), that.height() );
                that.requestRender();
            }, 
            false );

    this.camera = new THREE.PerspectiveCamera( 30, this.width() / this.height(), 1, 1000000 );

    // scene
    {
        this.scene = new THREE.Scene();

        var tiler = new cuardo.Tiler(this.layers, cuardo.translation, 1);
        var quadtree = new cuardo.QuadTree( sceneSize, maxLOD, tiler, maxCachedTiles || 256 );
        this.scene.add( quadtree );

        // sky cube
        {
            var urls  = [ "images/s_3.png",
                              "images/s_1.png",
                              "images/s_4.png",
                              "images/s_2.png",
                              "images/s_posZ.png",
                              "images/s_negZ.png"];

                var l = sceneSize * 10;
            var skyGeometry = new THREE.BoxGeometry( l, l, l );
        
            var materialArray = [];
                var stillToLoad = 6;
            for (var i = 0; i < 6; i++)
            materialArray.push( new THREE.MeshBasicMaterial({
                map: THREE.ImageUtils.loadTexture( urls[i], null, function() {
                            if (!--stillToLoad) { that.requestRender(); } }),
                side: THREE.BackSide
            }));
            var skyMaterial = new THREE.MeshFaceMaterial( materialArray );
            var skyBox = new THREE.Mesh( skyGeometry, skyMaterial );

            // add it to the scene
            this.scene.add( skyBox );
        }

        // lights
        {
            light = new THREE.SpotLight( 0xffffff, 1, 0, Math.PI / 2, 1 );
            light.position.set( 50000, 50000, 50000 );

            this.scene.add( light );

            alight = new THREE.AmbientLight( 0xeeeeee );
            this.scene.add( alight );

        }
    }

    // renderer
    {
        this.renderer = new THREE.WebGLRenderer( { antialias: true } );
        this.renderer.setClearColor( 0x222222, 1 );
        this.renderer.setSize( this.width(),  this.height() );
        this.target.appendChild( this.renderer.domElement );

        // composer and effects
        {
            this.composer = new THREE.EffectComposer( this.renderer );
            this.composer.addPass( new THREE.RenderPass( this.scene, this.camera ) );
            
            {
            // ssao
            var depthShader = THREE.ShaderLib[ "depthRGBA" ];
            var depthUniforms = THREE.UniformsUtils.clone( depthShader.uniforms );
            this.depthMaterial = new THREE.ShaderMaterial( { fragmentShader: depthShader.fragmentShader, vertexShader: depthShader.vertexShader, uniforms: depthUniforms } );
            this.depthMaterial.blending = THREE.NoBlending;
            this.depthTarget = new THREE.WebGLRenderTarget( window.innerWidth, window.innerHeight, { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, format: THREE.RGBAFormat } );
            var effect = new THREE.ShaderPass( THREE.SSAOShader );
            effect.uniforms[ 'tDepth' ].value = this.depthTarget;
            effect.uniforms[ 'size' ].value.set( window.innerWidth, window.innerHeight );
            effect.uniforms[ 'cameraNear' ].value = 1;//camera.near;
            effect.uniforms[ 'cameraFar' ].value = 2000;//camera.far;
            effect.uniforms[ 'lumInfluence' ].value = .01;
            effect.uniforms[ 'aoClamp' ].value = .8;
            this.composer.addPass( effect );


            var fxaa = new THREE.ShaderPass( THREE.FXAAShader );
            var dpr = 1;
            if (window.devicePixelRatio !== undefined) {
                dpr = window.devicePixelRatio;
            }
            fxaa.uniforms['resolution'].value.set(1 / (window.innerWidth * dpr), 1 / (window.innerHeight * dpr));
            //fxaa.renderToScreen = true;
            this.composer.addPass(fxaa);
            
            // depth of field
            var bokehPass = new THREE.BokehPass( this.scene, this.camera, {
                focus: .9,
                aperture:	0.005,
                maxblur:	1,
                width:  window.innerWidth,
                height: window.innerHeight
            } );
            bokehPass.renderToScreen = true;
            this.composer.addPass( bokehPass );

            }
        }
    }
}

cuardo.Map.prototype.render = function (t) {
    this.scene.updateMatrixWorld();

    var that = this;
    this.scene.traverse( function ( object ) {
        if ( object instanceof cuardo.QuadTree ) {
            object.update( that.camera );
        }
    } );

    this.scene.overrideMaterial = this.depthMaterial;
    this.renderer.render( this.scene, this.camera, this.depthTarget );
    this.scene.overrideMaterial = null;
    this.composer.render();

    // load missing tiles
    cuardo.TileLoader.instance().load( this.requestRender );
}

cuardo.Map.prototype.height = function (){
    var height = window.getComputedStyle(this.target).height;
    if ( height && height.slice(-2) == "px" ){
        height = +height.slice(0,-2);
    }
    else if  ( height && height.slice(-1) == "%" ){
        height = window.innerHeight * (+height.slice(0,-1))
    }
    else if ( height ){
        throw "unhandled unit for height: "+height;
    }
    else {
        height = window.innerWidth * (+height.slice(0,-1))
    }
    return height;
}

cuardo.Map.prototype.width = function (){
    var width = window.getComputedStyle(this.target).width;
    if ( width && width.slice(-2) == "px" ){
        width = +width.slice(0,-2);
    }
    else if  ( width && width.slice(-1) == "%" ){
        width = window.innerWidth * (+width.slice(0,-1))
    }
    else if ( width ){
        throw "unhandled unit for width: "+width;
    }
    else {
        width = window.innerWidth * (+width.slice(0,-1))
    }
    return width;
}

cuardo.Map.prototype.mouseRay = function(position){
    var vector = new THREE.Vector3( ( (position.x - this.target.offsetLeft) / this.width() ) * 2 - 1, 
                                  - ( (position.y - this.target.offsetTop) / this.height() ) * 2 + 1, 0.5 );
    var projector = new THREE.Projector();
    vector = projector.unprojectVector( vector, this.camera );

    return {position: this.camera.position, direction: vector.sub( this.camera.position ).normalize() };
}

cuardo.Map.prototype.requestRender = function ()
{
    cuardo.renderAsked = true;
}

cuardo.Map.prototype.animate = function ()
{
    if ( cuardo.renderAsked ) {
        this.render();
        cuardo.renderAsked = false;
    }
    // call animate @ 60 fps
    var that = this;
    window.requestAnimationFrame( function(){that.animate();} );
}

