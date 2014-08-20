WfsLayer = function (url, translation, nbIntervals, terrain, symbology, range) {
    this.url = url;
    this.translation = translation;
    this.nbIntervals = nbIntervals || 8;
    this.extent = [];
    this.srid = 0;
    this.terrain = terrain || null;
    //this.symbology = {polygon:{color:0x00ff00, extrude:'hfacade', lineColor:0xff0000, lineWidth:2, opacity:.3}};
    //this.symbology = {polygon:{extrude:'hfacade'}};
    this.symbology = symbology || {polygon:{color:0xffffff, opacity:.3, lineColor:0xff0000, lineWidth:2}};


    var object = this;
    var split = this.url.split('?');
    var baseUrl = split[0];

/*    // Level of details
    // Sorted array of pairs (size,layer_name)
    // The layer_name will be used for every tile size bigger or equal to size
    // If layer_name is empty, nothing will be returned for these sizes
    if ( levels === undefined ) {
        var l = /typeName=([^&]+)/.exec(split[1]);
        if (l) {
            levels = [{size:0, layer:l[l.length-1]}]
        }
        else {
            throw 'You must specify at least one level of detail';
        }
    }
    this.levels = levels;*/
    this.range = range || [0,1000000];

    console.log(baseUrl+'?SERVICE=WFS&VERSION=1.1.0&REQUEST=GetCapabilities');
    jQuery.ajax(baseUrl+'?SERVICE=WFS&VERSION=1.1.0&REQUEST=GetCapabilities', {
        success: function(data, textStatus, jqXHR) {
            $(data).find('FeatureType').each(function() { 
                object.srid =$(this).find('DefaultSRS').text().replace(new RegExp('.*EPSG::'), '');
                object.extent = proj4(proj4.defs("EPSG:"+object.srid), $(this).find('ows\\:LowerCorner').text().split(' ')).concat(
                       proj4(proj4.defs("EPSG:"+object.srid), $(this).find('ows\\:UpperCorner').text().split(' ')));
            });
        },
        async:   false,
        dataType: 'xml',
        error: function(jqXHR, textStatus, errorThrown) {
            console.log(textStatus+' :'+errorThrown);
            throw errorThrown;
        }
    });


    // map of tileId -> callbacks
    this.continuations = {};
    var that = this;
    this.workers = [];
    this.maxWorkers = 4;
    for ( var i = 0; i < this.maxWorkers; i++ ) {
        this.workers[i] = new Worker('js/VectorProcessingWorker.js');
        // mesh building after features have been processed
        this.workers[i].onmessage = function(o) { return that.onVectorProcessed(o); };
    }
    this.currentWorker = 0;
};


WfsLayer.prototype.tile = function( center, size, tileId, callback ) {
    if ( (size < this.range[0]) || (size > this.range[1]) ) {
        // return null if not visible
        callback();
        return;
    }
    var extentCenter = new THREE.Vector3().subVectors(center, this.translation );
    var ext = [extentCenter.x - size*.5,
               extentCenter.y - size*.5,
               extentCenter.x + size*.5,
               extentCenter.y + size*.5];

    var clipperRect = [[{X:center.x-.5*size, Y:center.y-.5*size},
                        {X:center.x+.5*size, Y:center.y-.5*size},
                        {X:center.x+.5*size, Y:center.y+.5*size},
                        {X:center.x-.5*size, Y:center.y+.5*size},
                        ]];

    var object = this;
    var is3d = false;

    var reqstart = new Date().getTime();

/*
    // look for the correct level
    var level = undefined;
    for ( var i = 0, l = this.levels.length; i < l; i++ ) {
        if ( this.levels[i].size > size ) {
            break;
        }
        level = this.levels[i];
    }
*/

    var ctxt = {
        translation: this.translation,
        clipperRect: clipperRect,
        symbology: object.symbology,
        is3d: is3d,
        center: center,
        size:size,
        nbIntervals: this.nbIntervals,
        gridVertices : null,
        gridNbIntervals : null
    };
    if (this.terrain){
        //console.log('terrain geom ', tileId, this.terrain.geom[tileId]);
        ctxt.gridVertices = this.terrain.geom[tileId].vertices;
        ctxt.gridNbIntervals = this.terrain.nbIntervals;
    }

    this.continuations[tileId] = callback;

    //console.log(this.url + '&BBOX='+ext.join(',') + '&typeName=' + level.layer);
    jQuery.ajax(this.url + '&BBOX='+ext.join(','), {
        success: function(data, textStatus, jqXHR) {
            var reqend = new Date().getTime();
            // call the worker to process these features

            var worker = object.workers[object.currentWorker];
            console.log('GET time ' + (reqend-reqstart) + " using worker #" + object.currentWorker);
            worker.postMessage( {data:data, ctxt:ctxt, tileId:tileId} );
            object.currentWorker = (object.currentWorker + 1) % object.maxWorkers;
        },
        async:   true,
        dataType: 'json',
        error: function(jqXHR, textStatus, errorThrown) {
            console.log(textStatus+' :'+errorThrown);
            throw errorThrown;
        },
    });
}

WfsLayer.prototype.onVectorProcessed = function( o ) {
    // function called after worker has been executed
    var r = o.data;

    var cloneFakeGeometry = function( g ) {
        // classes are not copied, only data
        // so we rebuild full objects here
        var geom = new THREE.Geometry();
        geom.vertices = g.vertices;
        geom.faces = g.faces;
        geom.faceVertexUvs = g.faceVertexUvs;
        return geom;
    }
    var geom = cloneFakeGeometry( r.geom );
    var lineGeom = cloneFakeGeometry( r.lineGeom );
    var errGeom = cloneFakeGeometry( r.errGeom );
    var errSpotGeom = cloneFakeGeometry( r.errSpotGeom );
    var wallGeom = cloneFakeGeometry( r.wallGeom );
    var material =  new THREE.MeshLambertMaterial( 
            { color:this.symbology.polygon.color,
              ambient:this.symbology.polygon.color,
              opacity:this.symbology.polygon.opacity || 1.,
              transparent: (this.symbology.polygon.opacity || 1) < 1, 
              wireframe:this.symbology.polygon.wireframe || false } );

    var group = new THREE.Object3D();
    var mesh = new THREE.Mesh( geom, material );
    mesh.userData = r.userData;
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


    if ( this.symbology.polygon.lineColor && this.symbology.polygon.lineWidth){
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
    if (this.symbology.polygon.extrude){
        var wallMesh = new THREE.Mesh( wallGeom,  material );
        wallMesh.userData = r.userDataWall;
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
