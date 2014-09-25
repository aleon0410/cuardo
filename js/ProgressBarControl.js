cuardo.ProgressBarControl = function( target, notifyCallback ){
    var t =  document.getElementById(target);
    if (!t) throw 'cannot find element '+target;

    this.notifyCallback = notifyCallback;

    //this.img = document.createElement('img');
    //t.appendChild(this.img);
    //this.img.src = "images/loading.gif";
    //this.img.style.visibility = "hidden";
    //this.img.style.float = "left";

    this.d = document.createElement('progress');
    t.appendChild(this.d);
    this.d.style.display = 'inline';
    this.d.style.height = 8;
    this.d.value = 0;
    this.d.max = 0;

    t.appendChild(document.createElement('br'));

    this.t = document.createElement('progress');
    t.appendChild(this.t);
    this.t.style.display = 'inline';
    this.t.style.height = 8;
    this.t.value = 0;
    this.t.max = 0;

    var object = this;

    cuardo.TileLoader.instance().setProgressCallback( 
        function progressTileLoading( nLoaded, nTotal ) {
            //object.img.style.visibility = (nLoaded != nTotal ) ? 'visible' : 'hidden';
            object.d.value = nLoaded;
            object.d.max = nTotal;
            if (object.notifyCallback) 
                object.notifyCallback('loaded ' + nLoaded + '/' + nTotal);
        }
    );
    cuardo.TileLoader.instance().setTilerProgressCallback(
        function tilerProgress( nLoaded, nTotal ) {
            object.t.value = nLoaded;
            object.t.max = nTotal;
        }
    );

}

