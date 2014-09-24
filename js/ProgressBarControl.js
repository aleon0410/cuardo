cuardo.ProgressBarControl = function( target, notifyCallback ){

    this.notifyCallback = notifyCallback;

    var table = document.createElement('img');
    
    //this.img = document.createElement('img');
    //target.appendChild(this.img);
    //this.img.src = "images/loading.gif";
    //this.img.style.visibility = "hidden";
    //this.img.style.float = "left";

    this.d = document.createElement('progress');
    target.appendChild(this.d);
    this.d.style.display = 'inline';
    this.d.style.height = 8;
    this.d.value = 0;
    this.d.max = 0;

    target.appendChild(document.createElement('br'));

    this.t = document.createElement('progress');
    target.appendChild(this.t);
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

