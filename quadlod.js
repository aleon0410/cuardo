
var container, stats;
var camera, controls, scene, renderer;
var depthMaterial, depthTarget;
var objects = [];
var projector, particleMaterial;
var text;
var headerText;
var EPSILON = 1e-12;

Tile = function( size, x, y, level ) {
    THREE.Object3D.call( this );

    // sub tiles
    this.tiles_ = [ [undefined, undefined], [undefined, undefined] ];
    // tile size FIXME useless ?
    this.size_ = size;

    // coordinate of the tile
    this.x = x;
    this.y = y;
    this.level = level;
}

// inherits from Object3D
Tile.prototype = Object.create( THREE.Object3D.prototype );

Tile.prototype.clone = function ( object ) {
    if ( object === undefined ) object = new Tile( this.size, this.x, this.y, this.level );
    // call the base class constructor
    THREE.Object3D.prototype.clone.call( this, object );

    for ( var i = 0; i < 2; i++ ) {
        for ( var j = 0; j < 2; j++ ) {
            if ( this.tiles_[i][j] !== undefined ) {
                object.tiles_[i][j] = this.tiles_[i][j].clone();
            }
        }
    }
    return object;
}

Tile.prototype.addObject = function( object, x /* = 0 */, y /* = 0 */, level /* = 0 */ ) {
    if ( level === undefined ) level = 0;
    if ( level == 0 ) {
        this.add( object );
    }
    else {
        nl = 1 << (level-1);
        var dx = ~~(x / nl);
        var dy = ~~(y / nl);
        var rx = x % nl;
        var ry = y % nl;
        if ( this.tiles_[dx][dy] === undefined ) {
            var t = new Tile( this.size / 2, this.x*2, this.y*2, this.level+1 );
            this.tiles_[dx][dy] = t;
            this.add( t );
        }
        this.tiles_[dx][dy].addObject( object, rx, ry, level-1 );
    }
}

Tile.prototype.changeVisibility = function( vis )
{
    if ( this.children[0].visible != vis ) {
        
//        console.log(this.x, this.y, this.level, "Changed from ", this.children[0].visible, " to ", vis );
    }
    this.children[0].visible = vis;
}

// set visible and all children invisible
Tile.prototype.setVisible = function( visible ) {
    if ( visible === undefined ) visible = true;
    this.changeVisibility( visible );

    for ( var i = 0; i < 2; i++ ) {
        for ( var j = 0; j < 2; j++ ) {
            if ( this.tiles_[i][j] !== undefined ) {
                this.tiles_[i][j].setVisible( false );
            }
        }
    }
}

Tile.prototype.hasVisibleChildren = function()
{
    return this.children[0].visible || ( this.tiles_[0][0] !== undefined && this.tiles_[0][0].hasVisibleChildren() )
        || ( this.tiles_[0][1] !== undefined && this.tiles_[0][1].hasVisibleChildren() )
        || ( this.tiles_[1][0] !== undefined && this.tiles_[1][0].hasVisibleChildren() )
        || ( this.tiles_[1][1] !== undefined && this.tiles_[1][1].hasVisibleChildren() );
}

Tile.prototype.setVisibleBranch = function()
{
    var h = this.hasVisibleChildren();
    if ( ! h ) {
        this.changeVisibility( true );
    }
}

///
/// Change the visibility of a tile, and deal with surrounding tiles to get a consistent overall visibility
/// The LOD of a tile can be refined but not simplified (lod increment is ok, but not lod decrement)
/// SetVisible(true) on the tile of level=0 must be called to reset LODs
Tile.prototype.setLOD = function ( x, y, level ) {
    if (level == 0) {
        if ( ! this.hasVisibleChildren() ) {
            this.setVisible();
        }
    }
    else {
        this.changeVisibility( false );

        nl = 1 << (level-1);
        var dx = ~~(x / nl);
        var dy = ~~(y / nl);
        var rx = x % nl;
        var ry = y % nl;
        for ( var i = 0; i < 2; i++ ) {
            for ( var j = 0; j < 2; j++ ) {
                if ( i==dx && j==dy && this.tiles_[dx][dy] !== undefined ) {
                    // recurse call
                    this.tiles_[dx][dy].setLOD( rx,ry, level-1 );
                }
                else  if ( this.tiles_[i][j] !== undefined ) {
                    // one of the neighbours
                    this.tiles_[i][j].setVisibleBranch();
                }
                else {
                    // in case no deeper tile is available, stop at this one
                    if ( ! this.hasVisibleChildren() ) {
                        this.setVisible();
                    }
                }
            }
        }
    }
}

// quad of size x size, centered on x,y
QuadTree = function( size, lod ) {
    THREE.Object3D.call( this );

    // the root tile
    this.tile = new Tile( this.size, 0, 0, 0 );
    this.add( this.tile );

    // max LOD
    this.maxLOD = lod;
    // size of an edge
    this.size = size;

    // map of lod available
    var n = 1 << this.maxLOD;
    this.lodMap = new Array(n);
    for ( var i = 0; i < n; i++ ) {
        this.lodMap[i] = new Array(n);
    }
}

// inherits from Object3D
QuadTree.prototype = Object.create( THREE.Object3D.prototype );

QuadTree.prototype.clone = function (object) {
    console.log('clone');
    if ( object === undefined ) object = new QuadTree( this.size, this.maxLOD );
    THREE.Object3D.prototype.clone.call( this, object );

    object.tile = this.children[0];

    return object;
}

QuadTree.prototype.addObject = function( object, level )
{
    var x = (object.position.x - this.position.x + this.size/2) / this.size;
    var y = (object.position.y - this.position.y + this.size/2) / this.size;
    var nl = 1<<this.maxLOD;
    var sx = ~~(x*nl);
    var sy = ~~(y*nl);
    // update the max lod map
    if ( this.lodMap[sx][sy] === undefined || this.lodMap[sx][sy] < level ) {
        this.lodMap[sx][sy] = level;
    }
    nl = 1 <<level;
    var dx = ~~(x*nl);
    var dy = ~~(y*nl);
    this.tile.addObject( object, dx, dy, level );
}

QuadTree.prototype.setLOD = function( x, y, level )
{
    this.tile.setLOD( x,y, level );
}

// update object visibility based on current camera
QuadTree.prototype.update = function( camera )
{
    var v1 = new THREE.Vector3();
    var v2 = new THREE.Vector3();
    v1.setFromMatrixPosition( camera.matrixWorld );

    var j = 1 << this.maxLOD;
    // reset to LOD0
    this.tile.setVisible( true );
    for ( var x = 0; x < j; x++ ) {
        for ( var y = 0; y < j; y++ ) {
            var xx = x/j * this.size - this.size/2 + this.size/j/2;
            var yy = y/j * this.size - this.size/2 + this.size/j/2;

	    v2.setX( xx );
            v2.setY( yy );
            var d = v1.distanceTo( v2 );
            var lod = ~~(1/d*2000);
            if (lod>=this.maxLOD) lod = this.maxLOD;
            var xd = ~~(x / (1 << (2,this.maxLOD-lod)));
            var yd = ~~(y / (1 << (2,this.maxLOD-lod)));
            if ( this.lodMap[x][y] < lod ) {
                // FIXME load the desired lod if available
                console.log('missing LOD', x, y, lod);
                continue;
            }
            this.setLOD(xd,yd,lod);
        }
    }
}

init();
animate();

function repeated(p1, p2) {
    return Math.abs(p1.x - p2.x) < EPSILON &&  Math.abs(p1.y - p2.y) < EPSILON;
}

function collinear(pa, pb, pc) {
    return Math.abs((pa.x - pc.x) * (pb.y - pc.y) - (pa.y - pc.y) * (pb.x - pc.x)) < EPSILON;
}

function init() {
    window.addEventListener( 'resize', onWindowResize, false );

    // mouse click detect object
    {
        document.addEventListener( 'mousedown', onDocumentMouseDown, false );
        document.addEventListener( 'keydown', onDocumentKeyDown, false );
        projector = new THREE.Projector();
    }

    // camera
    {
        camera = new THREE.PerspectiveCamera( 30, window.innerWidth / window.innerHeight, 1, 100000 );
        //camera.position.y = -10000;
        camera.position.z = 300;
        camera.position.y = -800;
    }

    // trackball
    {
        controls = new THREE.TrackballControls( camera );
        controls.rotateSpeed = 2.0;
        controls.zoomSpeed = 1.5;
        controls.panSpeed = 1.8;
        controls.noZoom = false;
        controls.noPan = false;
        controls.staticMoving = true;
        controls.dynamicDampingFactor = 0.3;
        controls.keys = [ 65, 83, 68 ];
        controls.addEventListener( 'change', render );
    }

    // scene
    {
        scene = new THREE.Scene();

        // buildings
        {
            var material =  new THREE.MeshLambertMaterial( { color:0xeeeeee} );
            material.ambient = material.color;
            var sz = .5;
            var geometry = new THREE.BoxGeometry( sz, sz, sz );
            var group = geometry;
            for ( var i = 0; i < 50; i ++ ) {
            
                    var mesh = new THREE.Mesh( geometry, material );
                    mesh.position.x = Math.random() * 400 - 200;
                    mesh.position.y = Math.random() * 300 - 150;
                    mesh.scale.z = Math.random() * 10 + 1;
                    mesh.scale.x = Math.random() * 10 + 1;
                    mesh.scale.y = Math.random() * 5 + 1;
                    mesh.rotation.z = Math.random();
                    mesh.position.z = mesh.scale.z*sz/2.;
                    mesh.castShadow = true;
                    //mesh.receiveShadow = true;
                    //THREE.GeometryUtils.merge(group, mesh);
                scene.add( mesh );
            }
            //var mesh = new THREE.Mesh( group, material );
            //scene.add( group );
        }

        // ground
        if(false)
        {
            var material =  new THREE.MeshLambertMaterial( { color:0x777777, shading: THREE.FlatShading} );
            material.ambient = material.color;
            var plane = new THREE.Mesh(new THREE.PlaneGeometry(800, 800), material);
            plane.position.z = -0.1;
            plane.receiveShadow = true;
            scene.add(plane);
        }

        // my tiled ground
        if (true){
            var size = 800;
            var xCenter = 0;
            var yCenter = 0;
            var quadtree = new QuadTree( size, 3 );
            var x0 = xCenter - size/2;
            var y0 = yCenter - size/2;
            scene.add( quadtree );
            var nbLevel = 2;
            for (var level=0; level<nbLevel; level++) {
                var sqrNbTiles = 1 << level;
                var group = new THREE.Object3D();
                var tileSize = size/sqrNbTiles;
                for (var i=0; i<sqrNbTiles; i++) {
                    for (var j=0; j<sqrNbTiles; j++) {
                        var grid = new THREE.GridHelper( tileSize/2, tileSize/8 );
                        var color = Math.random()*0xffffff;
                        grid.setColors( color, color );
                        grid.rotation.x = -Math.PI/2;
                        grid.position.x = x0 + (i+0.5)*tileSize;
                        grid.position.y = y0 + (j+0.5)*tileSize;
                        //  grid.position.z = 50*level;
                        grid.updateMatrix();
                        grid.matrixAutoUpdate = false;
                        grid.visible = false;

                        quadtree.addObject( grid, level );
                    }
                }
            }
            quadtree.position.x = 0;
            quadtree.position.y = 0;
            quadtree.updateMatrix();
            quadtree.matrixAutoUpdate = false;

        }
        

        //// grid
        //{
        //    var helper = new THREE.GridHelper( 200, 10 );
        //    helper.setColors( 0x0000ff, 0xf0f0f0 );
        //    helper.rotation.x = -Math.PI/2;
        //    scene.add( helper );
        //}

        // lights
        {
            //light = new THREE.PointLight( 0xdddddd );
            light = new THREE.SpotLight( 0xffffff, 1, 0, Math.PI / 2, 1 );
            light.position.set( 1000, 1000, 1000 );

            light.castShadow = true;
            light.shadowCameraVisible = true;
            light.shadowCameraNear = 1000;
            light.shadowCameraFar = 2000;
            light.shadowCameraFov = 20;
            light.shadowDarkness = 0.5;
            light.shadowMapWidth = 1024;
            light.shadowMapHeight = 512;

            scene.add( light );
            scene.add( new THREE.SpotLightHelper( light, 5 ) );

            alight = new THREE.AmbientLight( 0xdddddd );
            scene.add( alight );

        }

        // LOD
        if(false)
        {

            var sz = 10;
            var geometry = new THREE.BoxGeometry( sz, sz, sz );
            for ( var j = 0; j < 10; j ++ ) {
                var material =  new THREE.MeshPhongMaterial( { color:0xee0000} );
                material.ambient = material.color;
                var lod = new THREE.LOD();
                for ( var i = 0; i < 5; i ++ ) {
                    var mesh = new THREE.Mesh( geometry, material );
                    mesh.scale.z = i + 1;
                    mesh.position.z = .5*sz*mesh.scale.z;
                    mesh.updateMatrix();
                    mesh.matrixAutoUpdate = false;
                    lod.addLevel(mesh, i*100);
                }
                lod.position.x = -100+20*j;
                lod.updateMatrix();
                lod.matrixAutoUpdate = false;
                objects.push(lod);
                scene.add( lod );
            }
        }
    }

    // renderer
    {
        renderer = new THREE.WebGLRenderer( { antialias: false } );
        renderer.setClearColor( 0x222222, 1 );
        renderer.setSize( window.innerWidth, window.innerHeight );

        //renderer.shadowMapEnabled = true;
        //renderer.shadowMapType = THREE.PCFSoftShadowMap;

        // composer and effects
        {
            composer = new THREE.EffectComposer( renderer );
            composer.addPass( new THREE.RenderPass( scene, camera ) );
            
            if (false){
            // ssao
            var depthShader = THREE.ShaderLib[ "depthRGBA" ];
            var depthUniforms = THREE.UniformsUtils.clone( depthShader.uniforms );
            depthMaterial = new THREE.ShaderMaterial( { fragmentShader: depthShader.fragmentShader, vertexShader: depthShader.vertexShader, uniforms: depthUniforms } );
            depthMaterial.blending = THREE.NoBlending;
            depthTarget = new THREE.WebGLRenderTarget( window.innerWidth, window.innerHeight, { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, format: THREE.RGBAFormat } );
            var effect = new THREE.ShaderPass( THREE.SSAOShader );
            effect.uniforms[ 'tDepth' ].value = depthTarget;
            effect.uniforms[ 'size' ].value.set( window.innerWidth, window.innerHeight );
            effect.uniforms[ 'cameraNear' ].value = camera.near;
            effect.uniforms[ 'cameraFar' ].value = camera.far;
            effect.uniforms[ 'lumInfluence' ].value = .9;
            effect.uniforms[ 'aoClamp' ].value = .5;
            composer.addPass( effect );
            
            // depth of field
            var bokehPass = new THREE.BokehPass( scene, camera, {
                focus: .8,
                aperture:	0.008,
                maxblur:	1,
                width:  window.innerWidth,
                height: window.innerHeight
                } );
            bokehPass.renderToScreen = true;
            composer.addPass( bokehPass );
            }
        }
    }

    // stats
    {
        container = document.getElementById( 'container' );
        container.appendChild( renderer.domElement );

        stats = new Stats();
        stats.domElement.style.position = 'absolute';
        stats.domElement.style.top = '150px';
        stats.domElement.style.zIndex = 100;
        container.appendChild( stats.domElement );
    }

    // first render to avoid blank screen before interaction
    render();
    render(); // for some reason lod needs that second render

}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize( window.innerWidth, window.innerHeight );
    controls.handleResize();
    render();
}

function animate() {
    requestAnimationFrame( animate );
    controls.update();
}

function render() {
    console.log("render");
    scene.updateMatrixWorld();
    scene.traverse( function ( object ) {
        if ( object instanceof THREE.LOD ) {
            object.update( camera );
            object.objects.forEach( function(obj) {
                    var visible = obj.object.visible;
                    if ( obj.object instanceof THREE.Object3D ) {
                        obj.object.traverse(function(child) {
                                child.visible = visible;});
                    }
            });

        }
        else if ( object instanceof QuadTree ) {
            object.update( camera );
        }



    } );


    scene.overrideMaterial = depthMaterial;
    renderer.render( scene, camera, depthTarget );
    scene.overrideMaterial = null;
    composer.render()
    stats.update();
}

function onDocumentKeyDown( event ) {
    if ( event.keyCode == 65 ){ // a pressed
        camera.lookAt(new THREE.Vector3(0,0,0));
        camera.position.x = 0;
        camera.position.y = 0;
        camera.position.w = 10000;
        render();
    }
}
function onDocumentMouseDown( event ) {
    event.preventDefault();

    var vector = new THREE.Vector3( ( event.clientX / window.innerWidth ) * 2 - 1, 
                                  - ( event.clientY / window.innerHeight ) * 2 + 1, 0.5 );
    projector.unprojectVector( vector, camera );

    var raycaster = new THREE.Raycaster( camera.position, vector.sub( camera.position ).normalize() );

    var intersects = raycaster.intersectObjects( objects );

    if ( intersects.length > 0 ) {

            var text3d = new THREE.TextGeometry( 'face:'+intersects[ 0 ].faceIndex, {
					size: 2,
					height: .1,
					curveSegments: 2,
					font: "helvetiker"
				});

            //text3d.computeBoundingBox();
            var textMaterial = new THREE.MeshBasicMaterial( { color: 0x000000, overdraw: 0.5 } );
            scene.remove( text );
            text = new THREE.Mesh( text3d, textMaterial );
            text.position = intersects[ 0 ].point;
            scene.add( text );

            // var material =  new THREE.MeshPhongMaterial( { color:0xbb0000 } );
            // var particle = new THREE.Sprite( particleMaterial );
            // particle.position = intersects[ 0 ].point;
            // particle.scale.x = particle.scale.y = 16;
            // scene.add( particle );
            render();
    }
}
