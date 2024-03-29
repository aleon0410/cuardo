cuardo.WfsLayer = function (url, terrain, symbology, range) {
    this.url = url;
    this.terrain = terrain || null;
    //this.symbology = {polygon:{color:0x00ff00, extrude:'hfacade', lineColor:0xff0000, lineWidth:2, opacity:.3}};
    //this.symbology = {polygon:{extrude:'hfacade'}};
    this.symbology = symbology || {polygon:{color:0xffffff, opacity:.3, lineColor:0xff0000, lineWidth:2}};


    var object = this;
    var split = this.url.split('?');
    var baseUrl = split[0];

    this.range = range || [0,1000000];

    // map of tileId -> callbacks
    this.continuations = {};
    var that = this;

    // worker pool shared by all instances
    var nWorkers = localStorage.nWorkers || 8;
    if ( cuardo.WfsLayer.workerPool === undefined ) {
        cuardo.WfsLayer.workerPool = new cuardo.WorkerPool( nWorkers, 'js/VectorProcessingWorker.js' );
    }

    this.loaded = [];
    this.visible = false;
};

cuardo.WfsLayer.prototype.setVisibility = function( vis ){
    this.visible = vis;
}

cuardo.WfsLayer.prototype.getFeature = function( gid ) {
    var props;
    
    var layerName = /typeName=([^&]+)/.exec(this.url);

    var q = this.url+'&featureId='+layerName[1]+'.'+gid;
    jQuery.ajax(q, {
        success: function(data, textStatus, jqXHR) {
            props = data.features[0].properties;
        },
        async: false,
        dataType: 'json',
        error: function(jqXHR, textStatus, errorThrown) {
            console.warn(jqXHR + textStatus+' :'+errorThrown);
        }
    });
    return props;
}

cuardo.WfsLayer.prototype.tile = function( center, size, tileId, callback ) {
    if ( (size < this.range[0]) || (size >= this.range[1]) ) {
        // return null if not visible
        callback();
        return;
    }

    var extentCenter = new THREE.Vector3().subVectors(center, cuardo.translation );
    var ext = [extentCenter.x - size*.5,
               extentCenter.y - size*.5,
               extentCenter.x + size*.5,
               extentCenter.y + size*.5];

    var object = this;
    var is3d = false;

    var reqstart = new Date().getTime();

    var ctxt = {
        translation: cuardo.translation,
        symbology: object.symbology,
        is3d: is3d,
        center: center,
        size:size,
        gridVertices : null,
        gridNbIntervals : null
    };
    if (this.terrain){
        //console.log('terrain geom ', tileId, this.terrain.geom[tileId]);
        ctxt.gridVertices = this.terrain.geom[tileId].attributes.position.array;
        ctxt.nbIntervals = this.terrain.nbIntervals;
    }

    this.continuations[tileId] = callback;

    var loadedData = cuardo.WfsDataCache.instance().get(this.url, center, size);

    if (loadedData){
        var reqend = new Date().getTime();
        // call the worker to process these features

        //console.log('(Cache) GET time ' + (reqend-reqstart));
        cuardo.WfsLayer.workerPool.enqueueJob( {data: loadedData, ctxt:ctxt, tileId:tileId},
                                        (function( obj ) {
                                            return function( o ) {
                                                obj.onVectorProcessed( o );
                                            }
                                        }) ( object )
                                      );
        return;
    }

    //console.log(this.url + '&BBOX='+ext.join(',') + '&typeName=' + level.layer);
    jQuery.ajax(this.url + '&BBOX='+ext.join(','), {
        success: function(data, textStatus, jqXHR) {

            cuardo.WfsDataCache.instance().add(object.url, center, size, data);

            var reqend = new Date().getTime();
            // call the worker to process these features

            //console.log('GET time ' + (reqend-reqstart));
            cuardo.WfsLayer.workerPool.enqueueJob( {data:data, ctxt:ctxt, tileId:tileId}, 
                                            (function( obj ) {
                                                return function( o ) {
                                                    obj.onVectorProcessed( o );
                                                }
                                            }) ( object )
                                          );
        },
        async:   true,
        dataType: 'json',
        error: function(jqXHR, textStatus, errorThrown) {
            console.log(textStatus+' :'+errorThrown);
            throw errorThrown;
        },
    });
}

cuardo.WfsLayer.prototype.onVectorProcessed = function( o ) {
    // function called after worker has been executed
    var r = o.data;
    cuardo.WfsLayer.workerPool.releaseWorker( r.workerId );

    var group = new THREE.Object3D();
    if ( r.error !== undefined ) {
        console.warn("*** Worker error *** : " + r.error );
        this.continuations[r.tileId](group);
        return;
    }

    var timing = new Date().getTime() - r.sendDate;
    //console.log('Copy from worker ' + timing);
    var cloneFakeGeometry = function( g ) {
        // classes are not copied, only data
        // so we rebuild full objects here
        var geom = new THREE.BufferGeometry();
        geom.offsets = g.offsets;
        geom.attributes = g.attributes;
        return geom;
    }
    var geom = cloneFakeGeometry( r.geom );
    var lineGeom = cloneFakeGeometry( r.lineGeom );
    var errGeom = cloneFakeGeometry( r.errGeom );
    var errSpotGeom = cloneFakeGeometry( r.errSpotGeom );
    var wallGeom = cloneFakeGeometry( r.wallGeom );
    var material =  new THREE.MeshLambertMaterial( 
            { color: 0xffffff,//this.symbology.polygon.color,
              ambient: 0xffffff,//this.symbology.polygon.color,
              opacity:this.symbology.polygon.opacity || 1.,
              transparent: (this.symbology.polygon.opacity || 1) < 1, 
              vertexColors: THREE.VertexColors,
              //vertexColors: (this.symbology.polygon.colorFun ? THREE.FaceColors : THREE.NoColors),
              blending: THREE.NormalBlending } );

    var mesh = new THREE.Mesh( geom, material );
    mesh.userData = {name:'mesh', layer:this, vertexGidMap:r.gidMap};
    group.add(mesh);


    //{
    //    var m= new THREE.Mesh( geom,   new THREE.MeshLambertMaterial( 
    //        { color:this.symbology.polygon.color, 
    //          ambient:0x555555, 
    //          difuse:this.symbology.polygon.color,
    //          wireframe:true} ));
    //    m.userData = r.userData;
    //    m.position.z = 100;
    //    group.add(m);
    //}


    if ( (this.symbology.polygon.lineColor !== undefined) && (this.symbology.polygon.lineWidth !== undefined) ){
        group.add(new THREE.Line( lineGeom, 
                                  new THREE.LineBasicMaterial({ 
                                      color:this.symbology.polygon.lineColor, 
                                      linewidth:this.symbology.polygon.lineWidth }),
                                  THREE.LinePieces ));
    }
    group.add(new THREE.Line( errGeom, 
                              new THREE.LineBasicMaterial(
                                  { color:0xff0000, linewidth: 1 }) , 
                              THREE.LinePieces ));
    group.add(new THREE.Line( errSpotGeom, 
                              new THREE.LineBasicMaterial(
                                  { color:0xff0000, linewidth: 3 }) , 
                              THREE.LinePieces ));
    if (this.symbology.polygon.extrude !== undefined){
        var wallMesh = new THREE.Mesh( wallGeom,  material );
        wallMesh.userData = {name:'mesh', url:this.url, vertexGidMap:r.gidMapWall};
        group.add( wallMesh );
    }
    
    this.continuations[r.tileId](group);
}

// IF WE WANT TO USE THREE.Shape.Utils.triangulateShape instead of poly2tri
                    //    //var rings = [];
                    //    //var r = 0;
                    //    //poly.forEach( function(ring) {
                    //    //    rings.push([]);
                    //    //    var lastPoint;
                    //    //    ring.forEach( function(point) {
                    //    //        var pt = [point[0]+translation[0], point[1]+translation[1]];
                    //    //        if (lastPoint && (Math.abs(pt[0]-lastPoint[0])> 0.1 
                    //    //                         || Math.abs(pt[1]-lastPoint[1])> 0.1) ) {
                    //    //            rings[r].push(new THREE.Vector3(pt[0], pt[1], 0));
                    //    //            nbPt++;
                    //    //        }
                    //    //        lastPoint = pt;
                    //    //    });
                    //    //    rings[r].pop();
                    //    //    r++;
                    //    //});
                    //    //if (!r) return;
                    //    //var holes = [];
                    //    //for ( var i = 1; i<r; i++ ) {
                    //    //    holes.push( rings[i] );
                    //    //}
                    //    //var faces = THREE.Shape.Utils.triangulateShape( rings[0], holes );
                    //    //var offset = failedgeom.vertices.length;
                    //    //rings.forEach( function(ring){
                    //    //    ring.forEach( function( v ) {
                    //    //        failedgeom.vertices.push( v );
                    //    //    });
                    //    //});
                    //    //console.log('added '+(failedgeom.vertices.length-offset)+' vertices');
                    //    //faces.forEach( function(face) {
                    //    //    face.a += offset;
                    //    //    face.b += offset;
                    //    //    face.c += offset;
                    //    //    failedgeom.faces.push( face );
                    //    //});
/*
                        clippedPoly = res.poly; 

                        // plot contours for debug
                        if(0)
                        {
                            res.contour.forEach( function(ring) {
                                var clippedgeom = new THREE.Geometry();
                                ring.forEach( function(point) {
                                    clippedgeom.vertices.push(new THREE.Vector3(point.X,  point.Y, 100));
                                });
                                //if (ring.length) clippedgeom.vertices.push(new THREE.Vector3(ring[0].X,  ring[0].Y, 100)); // to close line

                                var clippedmaterial = new THREE.LineBasicMaterial({ color:0x00ff00, linewidth: 5 });
                                var clippedmesh = new THREE.Line( clippedgeom, clippedmaterial );
                                group.add(clippedmesh);
                            });
                        }
                        */
