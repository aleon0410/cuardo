cuardo.Map = function(layers, target, sceneSize, maxLod, maxCachedTiles){
    this.layers = parameters.layer;
    //this.renderer = parameters.renderer;


    window.addEventListener( 'resize', this.onWindowResize, false );
    this.container = document.getElementById( this.target );
    if (!this.container) throw "cannot find element "+ target;

    this.view.camera = new THREE.PerspectiveCamera( 30, this.width() / this.height(), 1, 1000000 );

    this.scene = new THREE.Scene();
    {
        // layers
        {
            var tiler = new cuardo.Tiler(this.layers);
            var quadtree = new cuardo.QuadTree( sceneSize, maxLOD, tiler, maxCachedTiles);
            this.scene.add( quadtree );
        }

        // sky cube
        {
	    var urls  = [ "images/s_3.png",
                          "images/s_1.png",
                          "images/s_4.png",
                          "images/s_2.png",
                          "images/s_posZ.png",
                          "images/s_negZ.png"];

            var l = config.sceneSize * 10;
	    var skyGeometry = new THREE.BoxGeometry( l, l, l );
	
	    var materialArray = [];
            var stillToLoad = 6;
	    for (var i = 0; i < 6; i++)
		materialArray.push( new THREE.MeshBasicMaterial({
		    map: THREE.ImageUtils.loadTexture( urls[i], null, function() {
                        if (!--stillToLoad) { requestRender(); } }),
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

    
    if (!this.renderer){
        this.renderer = new THREE.WebGLRenderer( { antialias: true } );
        this.container.appendChild( renderer.domElement );
        this.renderer.setClearColor( 0x222222, 1 );
        this.renderer.setSize( this.width(), this.height() );

        //renderer.shadowMapEnabled = true;
        //renderer.shadowMapType = THREE.PCFSoftShadowMap;

        // composer and effects
        {
            composer = new THREE.EffectComposer( this.renderer );
            composer.addPass( new THREE.RenderPass( this.scene, this.view.camera ) );
            
            {
            // ssao
            var depthShader = THREE.ShaderLib[ "depthRGBA" ];
            var depthUniforms = THREE.UniformsUtils.clone( depthShader.uniforms );
            depthMaterial = new THREE.ShaderMaterial( { fragmentShader: depthShader.fragmentShader, vertexShader: depthShader.vertexShader, uniforms: depthUniforms } );
            depthMaterial.blending = THREE.NoBlending;
            depthTarget = new THREE.WebGLRenderTarget( width(), height, { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, format: THREE.RGBAFormat } );
            var effect = new THREE.ShaderPass( THREE.SSAOShader );
            effect.uniforms[ 'tDepth' ].value = depthTarget;
            effect.uniforms[ 'size' ].value.set( window.innerWidth, window.innerHeight );
            effect.uniforms[ 'cameraNear' ].value = camera.near;
            effect.uniforms[ 'cameraFar' ].value = camera.far;
            effect.uniforms[ 'lumInfluence' ].value = .01;
            effect.uniforms[ 'aoClamp' ].value = .8;
            composer.addPass( effect );


            var fxaa = new THREE.ShaderPass( THREE.FXAAShader );
            var dpr = 1;
            if (window.devicePixelRatio !== undefined) {
                dpr = window.devicePixelRatio;
            }
            fxaa.uniforms['resolution'].value.set(1 / (width() * dpr), 1 / (height() * dpr));
            //fxaa.renderToScreen = true;
            composer.addPass(fxaa);
            
            // depth of field
            var bokehPass = new THREE.BokehPass( scene, camera, {
                focus: .9,
                aperture:	0.005,
                maxblur:	1,
                width:  width(),
                height: height()
            } );
            bokehPass.renderToScreen = true;
            composer.addPass( bokehPass );

            }
        }
    }

    // stats
    {

        if ( displayStats ) {
            stats = new Stats();
            stats.domElement.style.position = 'absolute';
            stats.domElement.style.top = '300px';
            stats.domElement.style.zIndex = 100;
            container.appendChild( stats.domElement );
        }
    }

    resetPosition = controls.getPosition();

    this.animate();
}

cuardo.Map.prototype.height = function (){
    var height = window.getComputedStyle(this.container).height;
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
    console.log("height", height);
    return height;
}

cuardo.Map.prototype.width = function(){
    var width = window.getComputedStyle(this.container).width;
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
    console.log("width", width);
    return width;
}

function render(t) {
    this.scene.updateMatrixWorld();

    this.scene.traverse( function ( object ) {
        if ( object instanceof cuardo.QuadTree ) {
            object.update( camera );
        }
    } );

    this.scene.overrideMaterial = depthMaterial;
    this.renderer.render( scene, camera, depthTarget );
    this.scene.overrideMaterial = null;
    this.composer.render()
    if ( displayStats ) {
        this.stats.update();
    }

    // load missing tiles
    cuardo.TileLoader.instance().load( this.requestRender );
}

function animate()
{
    if ( this.renderAsked ) {
        this.render();
        this.renderAsked = false;
    }
    // call animate @ 60 fps
    requestAnimationFrame(this.animate);
}

function requestRender()
{
    this.renderAsked = true;
}

function onWindowResize() {
    this.camera.aspect = this.width() / this.height();
    this.camera.updateProjectionMatrix();
    this.renderer.setSize( this.width(), this.height() );
    this.requestRender();
}
