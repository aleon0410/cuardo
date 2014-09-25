cuardo.RecordReplayControl = function( controls, notifyCallback){
    this.controls = controls;
    this.notifyCallback = notifyCallback;
    this.keyframes = [];

    var object = this;
    window.addEventListener( 'keydown', 
            function( event ){
                var keys = {r:82, p:80, s:83, l:76};
                switch ( event.keyCode ) {
                    case keys.r: object.record(); break;
                    case keys.p: object.replay(); break;
                    case keys.l: object.load(); break;
                    case keys.s: object.save(); break;
                }
            }
        , false );
}

cuardo.RecordReplayControl.prototype.onKeyDown = function( event ){
    var keys = {r:82, p:80, s:83, l:76};
    switch ( event.keyCode ) {
        case keys.r: console.log(this); this.record(); break;
        case keys.p: this.replay(); break;
        case keys.l: this.load(); break;
        case keys.s: this.save(); break;
    }
}

cuardo.RecordReplayControl.prototype.record = function(){
    var p = controls.getPosition();
    var last = this.keyframes.length ? this.keyframes[this.keyframes.length-1].dt: 0;
    var dt = prompt("Date (in seconds):", last.toString());
    this.keyframes.push( {dt:+dt, p:p.p, cam:p.cam} );
    if (this.notifyCallback) 
        this.notifyCallback('Record added (total:' + this.keyframes.length + ')');
}

cuardo.RecordReplayControl.prototype.replay = function(fps){
    fps = fps || 10;

    var time_per_frame = 1/fps;

    var positions = [];
    if ( this.keyframes.length == 0 ) {
        return;
    }
    if ( this.keyframes.length == 1 ) {
        positions.push( {dt:0, p:this.keyframes[0].p} );
    }
    else {
        for (var i = 1; i < this.keyframes.length; i++ ) {
            var ki = this.keyframes[i-1];
            var kj = this.keyframes[i];
            var n = (kj.dt - ki.dt) / time_per_frame;
            for (var j = 0; j <= n; j++ ) {
                // cosine interpolation
                var alpha = (1-Math.cos(j/n*Math.PI))/2.0;
                var p = [];
                for ( var k = 0; k < ki.p.length; k++ ) {
                    p.push( kj.p[k] * alpha + ki.p[k] * (1-alpha) );
                }
                positions.push( {p:p, dt:time_per_frame} );
            }
        }
    }

    this.controls.animate( positions );
}

cuardo.RecordReplayControl.prototype.save = function(){
    urlContent = "data:application/octet-stream," + encodeURIComponent(JSON.stringify(this.keyframes));
    window.open(urlContent, 'Records');
}

cuardo.RecordReplayControl.prototype.load = function(){

    var object = this;

    var elem = createPopin(); 
    var file = document.createElement('input');
    elem.appendChild(file);
    file.type = "file";
    var load = document.createElement('input');
    elem.appendChild(load);
    load.type = "button";
    load.value = "Load";
    load.onclick = function(){
        var f = new FileReader();
        f.onload = function(e) {
            object.keyframes = JSON.parse( e.target.result );
            if (object.notifyCallback) 
                object.notifyCallback('Loaded ' + object.keyframes.length + ' records');

            document.body.removeChild(elem);
        };
        f.readAsText(file.files[0]);
    };
}

