// TODO select only the opropriate layer
WfsLayer = function (url, translation, nbIntervals = 8 ) {
    this.url = url;
    this.translation = translation;
    this.nbIntervals = nbIntervals;
    this.extend = [];
    this.srid = 0;

    var object = this;
    cpabilityUrl = url;
    jQuery.ajax(this.url+'?SERVICE=WFS&VERSION=1.1.0&REQUEST=GetCapabilities', {
        success: function(data, textStatus, jqXHR) {
            $(data).find('FeatureType').each(function() { 
                object.srid =$(this).find('DefaultSRS').text().replace(new RegExp('.*EPSG::'), '');
                object.extend = proj4(proj4.defs("EPSG:"+object.srid), $(this).find('ows\\:LowerCorner').text().split(' ')).concat(
                       proj4(proj4.defs("EPSG:"+object.srid), $(this).find('ows\\:UpperCorner').text().split(' ')));
            });
            console.log('loaded');

        },
        async:   false,
        dataType: 'xml',
        error: function(jqXHR, textStatus, errorThrown) {
            console.log(textStatus+' :'+errorThrown);
            throw errorThrown;
        }
    });
    console.log('extend ' + this.extend.join(', '));
};


WfsLayer.prototype.tile = function( center, size, callback ) {
    var mesh;
    var remaining = 3;
    var loaded = function(){
        remaining--;
        if (!remaining) callback(mesh);
    };
    var extendCenter = new THREE.Vector3().subVectors(center, this.translation );
    //var extend = [1831540, 5159897, 1859318, 5192652];
    var extend = [1831402.5, 5160390.5, 1856581, 5192156];
    var translation = [-.5*(extend[2]+extend[0]), -.5*(extend[3]+extend[1])];
    //var translation = [0,0];
    console.log('extend ', extend);
    console.log('translation ', translation);

    var url = 'http://localhost/cgi-bin/tinyows?SERVICE=WFS&VERSION=1.1.0&REQUEST=GetFeature&typeName=tows:pos_opposable_posperime_shp&outputFormat=JSON';
    var material =  new THREE.MeshLambertMaterial( { color:0x00ff00, wireframe:true } );
    material.ambient = material.color;
    var geom = new THREE.Geometry();
    var nbInvalid = 0;
    jQuery.ajax(url, {
        success: function(data, textStatus, jqXHR) {
            var start = new Date().getTime();
            var nbPoly = 0;
            var nbPt = 0;
            //feat = data.features[0];
            data.features.forEach( function(feat) {
                feat.geometry.coordinates.forEach( function(poly){
                    nbPoly++;
                    try {
                        var rings = [];
                        poly.forEach( function(ring) {
                            var r = rings.length;
                            rings.push([]);
                            ring.forEach( function(point) {
                                var pt = new poly2tri.Point(point[0]+translation[0], point[1]+translation[1]);
                                if ( !rings[r].length ||
                                    !repeated(rings[r][rings[r].length-1], pt) ) {
                                    if ( rings[r].length < 2 ||
                                        !collinear(rings[r][rings[r].length-2], rings[r][rings[r].length-1], pt)) {
                                        rings[r].push(pt);
                                        nbPt++;
                                    }
                                    else {
                                        rings[r][r.length-1] = pt;
                                    }
                                }
                            });
                            if (rings[r].length) rings[r].pop(); // last point is repeated
                            if (rings[r].length > 2 && collinear( rings[r][rings[r].length-2], rings[r][rings[r].length-1],  rings[r][0])) rings[r].pop();
                        });
                        //console.log('ring 0 has '+rings[0].length+' points');
                        if (!rings.length || !rings[0].length) return;
                        var swctx = new poly2tri.SweepContext(rings[0]);
                        for (var r=1; r<rings.length; r++) {
                            if (rings[r].length) swctx.addHole(rings[r]);
                        }
                        swctx.triangulate();
                        var triangles = swctx.getTriangles();
                        var i = geom.vertices.length;
                        triangles.forEach(function(t) {
                            t.getPoints().forEach(function(p) {
                                geom.vertices.push(new THREE.Vector3(p.x, p.y, 0));
                            });
                            geom.faces.push( new THREE.Face3(i, i+1, i+2) );
                            i += 3;
                        });
                    }
                    catch (err) {
                        nbInvalid++;
                        console.log('poly:', poly);
                        console.log('poly2tri error:', err);
                        points = err.message.replace(new RegExp(".*supported! \\("),'').replace(new RegExp(".*Constraints \\("),'').split(') (');
                        var errgeom = new THREE.Geometry();
                        points.forEach( function(pt) {
                            pt = pt.replace(')','');
                            pt = pt.split(';');
                            console.log('point:', pt);
                            errgeom.vertices.push(new THREE.Vector3(+pt[0], +pt[1], 0));
                        });
                        var errmesh = new THREE.Line( errgeom, new THREE.LineBasicMaterial({ color:0xff0000, linewidth: 3 }) );
                        scene.add(errmesh);



                        //throw err;
                        var failedgeom = new THREE.Geometry();
                        poly.forEach( function(ring) {
                            ring.forEach( function(point) {
                                var pt = [point[0]+translation[0], point[1]+translation[1]];
                                failedgeom.vertices.push(new THREE.Vector3(pt[0], pt[1], 0));
                            });
                        });
                        console.log('failed feature triangulation gid='+feat.properties.gid);
                        var failedmaterial = new THREE.LineBasicMaterial({ color:0xffaaaa, linewidth: 1 });
                        var failedmesh = new THREE.Line( failedgeom, failedmaterial/*, THREE.LinePieces*/ );
                        scene.add(failedmesh);
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
                    }
                });

            });
            var end = new Date().getTime();
            console.log((end-start)/1000.+'sec to triangulate '+nbPoly+' polygons ('+nbPt+' points) with '+nbInvalid+' failed triangulations');

        },
        async:   false,
        dataType: 'json',
        error: function(jqXHR, textStatus, errorThrown) {
            console.log(textStatus+' :'+errorThrown);
            throw errorThrown;
        }
    });
    console.log('nb of vtx ', geom.vertices.length );
    console.log('nb of faces ', geom.faces.length );
    geom.computeBoundingBox();
    console.log('bbox ', geom.boundingBox.min, geom.boundingBox.max);
    geom.computeFaceNormals();
    mesh = new THREE.Mesh( geom, material );
    scene.add(mesh);
}
