//
// Simple control where the camera is placed on a dome around a center of interest

THREE.GISControls = function ( object, domElement ) {

    this.object = object;
    this.domElement = ( domElement !== undefined ) ? domElement : document;

    // Set to false to disable this control
    this.enabled = true;

    // "target" sets the location of focus, where the control orbits around
    // and where it pans with respect to.
    // (0,0,0) by default
    this.target = new THREE.Vector3();

    this.zoomSpeed = 1.0;

    // Limits to how far you can dolly in and out
    this.minDistance = 0;
    this.maxDistance = Infinity;

    this.rotateSpeed = 1.0;

    this.keyPanSpeed = 7.0;	// pixels moved per arrow key push

    // angles on the dome
    this.theta = 0; // on the XY plane, in degrees
    this.phi = 45; // in degrees

    // angle limits
    this.minPhi = -20;
    this.maxPhi = 80;

    // Set to true to disable use of the keys
    this.noKeys = false;

    // The four arrow keys
    this.keys = { LEFT: 37, UP: 38, RIGHT: 39, BOTTOM: 40 };

    ////////////
    // internals
    var distance = 5000;

    var pan = new THREE.Vector3();

    var scope = this;

    var EPS = 0.000001;

    var rotateStart = new THREE.Vector2();
    var rotateEnd = new THREE.Vector2();
    var rotateDelta = new THREE.Vector2();

    var panStart = new THREE.Vector2();
    var panEnd = new THREE.Vector2();
    var panDelta = new THREE.Vector2();
    var panOffset = new THREE.Vector3();

    var dollyStart = new THREE.Vector2();
    var dollyEnd = new THREE.Vector2();
    var dollyDelta = new THREE.Vector2();

    var lastPosition = new THREE.Vector3();

    var STATE = { NONE : -1, ROTATE : 0, DOLLY : 1, PAN : 2, TOUCH_ROTATE : 3, TOUCH_DOLLY : 4, TOUCH_PAN : 5 };

    var state = STATE.NONE;

    // for reset

    this.target0 = this.target.clone();
    this.position0 = this.object.position.clone();

    // events

    var changeEvent = { type: 'change' };
    var startEvent = { type: 'start'};
    var endEvent = { type: 'end'};

    this.dollyIn = function ( dollyScale ) {

	if ( dollyScale === undefined ) {

	    dollyScale = getZoomScale();

	}

	distance /= dollyScale;

    };

    this.dollyOut = function ( dollyScale ) {

	if ( dollyScale === undefined ) {

	    dollyScale = getZoomScale();

	}

	distance *= dollyScale;

    };

    // pass in distance in world space to move left
    this.panLeft = function ( distance ) {
        pan.x += distance * Math.sin( scope.theta * Math.PI / 180 );
        pan.y -= distance * Math.cos( scope.theta * Math.PI / 180 );
    };

    // pass in distance in world space to move up
    this.panUp = function ( distance ) {
        pan.x -= distance * Math.cos( scope.theta * Math.PI / 180 );
        pan.y -= distance * Math.sin( scope.theta * Math.PI / 180 );
    };

    this.pan = function ( deltaX, deltaY ) {

	var element = scope.domElement === document ? scope.domElement.body : scope.domElement;

	if ( scope.object.fov !== undefined ) {

	    // perspective
	    var position = scope.object.position;

            var targetDistance = distance;
	    // half of the fov is center to top of screen
	    targetDistance *= Math.tan( ( scope.object.fov / 2 ) * Math.PI / 180.0 );

	    // we actually don't use screenWidth, since perspective camera is fixed to screen height
	    scope.panLeft( 2 * deltaX * targetDistance / element.clientHeight );
	    scope.panUp( 2 * deltaY * targetDistance / element.clientHeight );

	} else if ( scope.object.top !== undefined ) {

	    // orthographic
	    scope.panLeft( deltaX * (scope.object.right - scope.object.left) / element.clientWidth );
	    scope.panUp( deltaY * (scope.object.top - scope.object.bottom) / element.clientHeight );

	} else {

	    // camera neither orthographic or perspective
	    console.warn( 'WARNING: GISControls.js encountered an unknown camera type - pan disabled.' );

	}
    };

    this.update = function () {
        // place the camera on a dome around the scene
        this.phi = Math.min( this.maxPhi, Math.max( this.minPhi, this.phi ) );

        this.object.position.x = distance * Math.cos( this.theta * Math.PI / 180 ) * Math.sin( this.phi * Math.PI / 180 ) + pan.x;
        this.object.position.y = distance * Math.sin( this.theta * Math.PI / 180 ) * Math.sin( this.phi * Math.PI / 180 ) + pan.y;
        this.object.position.z = distance * Math.cos( this.phi * Math.PI / 180 );

        this.object.up.x = 0;
        this.object.up.y = 0;
        this.object.up.z = this.phi >= 0 ? 1 : -1;
        this.object.lookAt( pan );

	if ( lastPosition.distanceToSquared( this.object.position ) > EPS ) {
	    this.dispatchEvent( changeEvent );
	    lastPosition.copy( this.object.position );
	}
    };


    this.reset = function () {

	state = STATE.NONE;

	this.target.copy( this.target0 );
	this.object.position.copy( this.position0 );

	this.update();

    };

    function getZoomScale() {

	return Math.pow( 0.95, scope.zoomSpeed );

    }

    function onMouseDown( event ) {

	if ( scope.enabled === false ) return;
	event.preventDefault();

	if ( event.button === 0 ) {
	    if ( scope.noRotate === true ) return;

	    state = STATE.ROTATE;

	    rotateStart.set( event.clientX, event.clientY );

	} else if ( event.button === 1 ) {
	    if ( scope.noZoom === true ) return;

	    state = STATE.DOLLY;

	    dollyStart.set( event.clientX, event.clientY );

	} else if ( event.button === 2 ) {
	    if ( scope.noPan === true ) return;

	    state = STATE.PAN;

	    panStart.set( event.clientX, event.clientY );

	}

	scope.domElement.addEventListener( 'mousemove', onMouseMove, false );
	scope.domElement.addEventListener( 'mouseup', onMouseUp, false );
	scope.dispatchEvent( startEvent );

    }

    function onMouseMove( event ) {

	if ( scope.enabled === false ) return;

	event.preventDefault();

	var element = scope.domElement === document ? scope.domElement.body : scope.domElement;

	if ( state === STATE.ROTATE ) {

	    if ( scope.noRotate === true ) return;

	    rotateEnd.set( event.clientX, event.clientY );
	    rotateDelta.subVectors( rotateEnd, rotateStart );
            
	    scope.theta -= 360 * rotateDelta.x / element.clientWidth * scope.rotateSpeed;
	    scope.phi -= 360 * rotateDelta.y / element.clientHeight * scope.rotateSpeed;
            
	    rotateStart.copy( rotateEnd );

	    scope.update();

	} else if ( state === STATE.DOLLY ) {

	    if ( scope.noZoom === true ) return;

	    dollyEnd.set( event.clientX, event.clientY );
	    dollyDelta.subVectors( dollyEnd, dollyStart );

	    if ( dollyDelta.y > 0 ) {

		scope.dollyIn();

	    } else {

		scope.dollyOut();

	    }

	    dollyStart.copy( dollyEnd );


	    scope.update();

	} else if ( state === STATE.PAN ) {

	    if ( scope.noPan === true ) return;

	    panEnd.set( event.clientX, event.clientY );
	    panDelta.subVectors( panEnd, panStart );
	    
	    scope.pan( panDelta.x, panDelta.y );

	    panStart.copy( panEnd );

	    scope.update();


	}
    }

    function onMouseUp( /* event */ ) {

	if ( scope.enabled === false ) return;

	scope.domElement.removeEventListener( 'mousemove', onMouseMove, false );
	scope.domElement.removeEventListener( 'mouseup', onMouseUp, false );
	scope.dispatchEvent( endEvent );
	state = STATE.NONE;

    }

    function onMouseWheel( event ) {

	if ( scope.enabled === false || scope.noZoom === true ) return;

	event.preventDefault();
	event.stopPropagation();

	var delta = 0;

	if ( event.wheelDelta !== undefined ) { // WebKit / Opera / Explorer 9

	    delta = event.wheelDelta;

	} else if ( event.detail !== undefined ) { // Firefox

	    delta = - event.detail;

	}

	if ( delta > 0 ) {

	    scope.dollyOut();

	} else {

	    scope.dollyIn();

	}

	scope.update();
	scope.dispatchEvent( startEvent );
	scope.dispatchEvent( endEvent );

    }

    function onKeyDown( event ) {

	if ( scope.enabled === false || scope.noKeys === true || scope.noPan === true ) return;
	
	switch ( event.keyCode ) {

	case scope.keys.UP:
	    scope.pan( 0, scope.keyPanSpeed );
	    scope.update();
	    break;

	case scope.keys.BOTTOM:
	    scope.pan( 0, - scope.keyPanSpeed );
	    scope.update();
	    break;

	case scope.keys.LEFT:
	    scope.pan( scope.keyPanSpeed, 0 );
	    scope.update();
	    break;

	case scope.keys.RIGHT:
	    scope.pan( - scope.keyPanSpeed, 0 );
	    scope.update();
	    break;

	}

    }

    this.domElement.addEventListener( 'contextmenu', function ( event ) { event.preventDefault(); }, false );
    this.domElement.addEventListener( 'mousedown', onMouseDown, false );
    this.domElement.addEventListener( 'mousewheel', onMouseWheel, false );
    this.domElement.addEventListener( 'DOMMouseScroll', onMouseWheel, false ); // firefox

    /* disabled
       this.domElement.addEventListener( 'touchstart', touchstart, false );
       this.domElement.addEventListener( 'touchend', touchend, false );
       this.domElement.addEventListener( 'touchmove', touchmove, false );
    */

    window.addEventListener( 'keydown', onKeyDown, false );

    // force an update at start
    this.update();

};

THREE.GISControls.prototype = Object.create( THREE.EventDispatcher.prototype );
