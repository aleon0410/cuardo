WfsLayer = function (url, translation, nbIntervals, terrain) {
    this.url = url;
    this.translation = translation;
    this.nbIntervals = nbIntervals || 8;
    this.extent = [];
    this.srid = 0;
    this.terrain = terrain || null;

    // TODO select only the opropriate layer
    var object = this;
    var baseUrl = this.url.split('?')[0];
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

    //this.symbology = {polygon:{extrude:'hfacade'}};
    this.symbology = {polygon:{color:0x00ff00, opacity:.3/*, lineColor:0xff0000, lineWidth:2*/}};
};

var EPSILON = 1e-6;

function repeated(p1, p2) {
    if ( Math.abs(p1.x - p2.x) < EPSILON &&  Math.abs(p1.y - p2.y) < EPSILON )
        throw 'repeated points should have been removed by clipper';
    return false;
}

function collinear(pa, pb, pc) {
    if ( Math.abs((pa.x - pc.x) * (pb.y - pc.y) - (pa.y - pc.y) * (pb.x - pc.x)) < EPSILON )
        throw 'collinear points should have been removed by clipper';
    return false;
}

function addLinesFromClipperPaths(geom, paths){
    paths.forEach(function(ring) {
        var lastPt;
        ring.forEach( function(pt) {
            if (lastPt){
                geom.vertices.push(lastPt);
                lastPt = new THREE.Vector3(pt.X, pt.Y, 1);
                geom.vertices.push(lastPt);
            }
            else {
                lastPt = new THREE.Vector3(pt.X, pt.Y, 1);
            }
        });
    });
}

function addTrianglesFromClipperPathsExtrusion(geom, paths, heigth){
    var i = geom.vertices.length;
    paths.forEach( function(ring) {
        var lastPt;
        ring.forEach( function(pt) {
            if (lastPt){
                geom.vertices.push(lastPt);
                var lastPtH = new THREE.Vector3(lastPt.x, lastPt.y, heigth);
                lastPt = new THREE.Vector3(pt.X, pt.Y, 0);
                geom.vertices.push(lastPt);

                geom.vertices.push(lastPtH);
                lastPtH = new THREE.Vector3(lastPt.x, lastPt.y, heigth);
                geom.vertices.push(lastPtH);
                geom.faces.push( new THREE.Face3(i, i+1, i+2) );
                geom.faces.push( new THREE.Face3(i+2, i+1, i+3) );
                i+=4;
            }
            else {
                lastPt = new THREE.Vector3(pt.X, pt.Y, 1);
            }
        });
    });
}

function addTrianglesFromClipperPaths(geom, paths){
    var rings = [];
    paths.forEach( function(ring) {
        var r = rings.length;
        rings.push([]);
        ring.forEach( function(point) {
            var pt = new poly2tri.Point(point.X, point.Y);
            // TODO note: repeated and colinear should be deal with by clipper
            if ( !rings[r].length ||
                !repeated(rings[r][rings[r].length-1], pt) ) {
                if ( rings[r].length < 2 ||
                    !collinear(rings[r][rings[r].length-2], rings[r][rings[r].length-1], pt)) {
                    rings[r].push(pt);
                }
                else {
                    rings[r][r.length-1] = pt;
                }
            }
        });
        if (rings[r].length > 2 && collinear( rings[r][rings[r].length-2], rings[r][rings[r].length-1],  rings[r][0])) rings[r].pop();
    });

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

function clipperPath( wfsPolygon, translation ) {
    var clipperPath = [];
    wfsPolygon.forEach( function(ring) {
        r = []
        ring.forEach( function(point) {
            r.push({X:point[0]+translation.x,Y:point[1]+translation.y});
        });
        if (r.length) r.pop(); // last point is a repeat of first
        clipperPath.push(r);
    });
    //return ClipperLib.Clipper.CleanPolygons(clipperPath, 0.0001); // centimetric precision
    return clipperPath;
}

function clip( clipperPath, clipperRect, needsContour ) {
    var clippedPoly = new ClipperLib.Paths();
    {
        var cpr = new ClipperLib.Clipper();
        cpr.AddPaths(clipperPath, ClipperLib.PolyType.ptSubject, true);
        cpr.AddPaths(clipperRect, ClipperLib.PolyType.ptClip, true);
        cpr.Execute(ClipperLib.ClipType.ctIntersection, 
                clippedPoly, 
                ClipperLib.PolyFillType.pftEvenOdd,
                ClipperLib.PolyFillType.pftEvenOdd);
    }

    var clippedContour = new ClipperLib.Paths();
    if ( needsContour )
    {
        var tree = new ClipperLib.PolyTree();
        var cpr = new ClipperLib.Clipper();
        var poly = ClipperLib.JS.Clone(clipperPath);
        poly.forEach(function(ring){
            // close contour
            // note: we move the point to prvent it to be removed as duplicate
            if (ring.length) ring.push({X:ring[0].X+EPSILON, Y:ring[0].Y}); 
        });

        cpr.AddPaths(poly, ClipperLib.PolyType.ptSubject, false);
        cpr.AddPaths(clipperRect, ClipperLib.PolyType.ptClip, true);
        cpr.Execute(ClipperLib.ClipType.ctIntersection, 
                tree, 
                ClipperLib.PolyFillType.pftEvenOdd,
                ClipperLib.PolyFillType.pftEvenOdd);
        ClipperLib.Clipper.OpenPathsFromPolyTree(tree).forEach( function(ring) {
            clippedContour.push( ring );
        });
    }

    return {poly:clippedPoly, contour:clippedContour};
}

function computeTileUv(geom, center, size) {
    // uv coord are relative to the tile
    {
        var tileOrigin = {x:center.x-size*.5, y:center.y-size*.5};
        for (var v=0; v<geom.vertices.length; v+=3){
            var uv = [new THREE.Vector2((geom.vertices[v].x-tileOrigin.x)/size, 
                                        (geom.vertices[v].y-tileOrigin.y)/size),
                      new THREE.Vector2((geom.vertices[v+1].x-tileOrigin.x)/size, 
                                        (geom.vertices[v+1].y-tileOrigin.y)/size),
                      new THREE.Vector2((geom.vertices[v+2].x-tileOrigin.x)/size, 
                                        (geom.vertices[v+2].y-tileOrigin.y)/size)];
            geom.faceVertexUvs[ 0 ].push(uv);
        }
    }
}

WfsLayer.prototype.tile = function( center, size, tileId, callback ) {
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
    var translation = this.translation;

    var reqstart = new Date().getTime();
//    console.log(this.url + '&BBOX='+ext.join(','));
    jQuery.ajax(this.url + '&BBOX='+ext.join(','), {
        success: function(data, textStatus, jqXHR) {
            var reqend = new Date().getTime();
            //console.log('it took ', (reqend-reqstart)/1000., 'sec to compled request');
            var start = new Date().getTime();
            var geom = new THREE.Geometry();
            var lineGeom = new THREE.Geometry();
            var errGeom = new THREE.Geometry();
            var errSpotGeom = new THREE.Geometry();
            var nbInvalid = 0;
            var nbPoly = 0;
            // MULTIPOLYGON ONLY
            data.features.forEach( function(feat) {
                if (feat.geometry.bbox.length == 6 
                    && Math.abs(feat.geometry.bbox[2]-feat.geometry.bbox[5] ) > EPSILON) {
                        is3d = true;
                    }
                feat.geometry.coordinates.forEach( function(poly){
                    nbPoly++;


                    // transform 3D polygons to put them in a plane
                    // 


                    var clipped = clip( clipperPath( poly, translation ), 
                                clipperRect, 
                                object.symbology.polygon.lineColor || object.symbology.polygon.lineWidth );
                    if (!clipped.poly.length) return;

                    try {
                        addTrianglesFromClipperPaths(geom, clipped.poly);
                        if (clipped.contour && clipped.contour.length) {
                            addLinesFromClipperPaths( lineGeom, clipped.contour );
                        }
                    }
                    catch (err) {
                        nbInvalid++;
                        // show error spots for debug
                        if (err.points) {
                            var points = [];
                            err.points.forEach(function(p){ points.push({X:p.x, Y:p.y}); });
                            addLinesFromClipperPaths(errSpotGeom, [points])
                        }

                        // try to simplify polygon and retriangulate
                        var simpPoly = ClipperLib.Clipper.SimplifyPolygons( clipped.poly, ClipperLib.PolyFillType.pftEvenOdd );
                        try {
                            addTrianglesFromClipperPaths(geom, simpPoly);
                            console.log('fixed polygon gid=',feat.properties.gid);
                        }
                        catch (err) {
                            // complete failed geom (before clipping)
                            addLinesFromClipperPaths(errGeom, clipperPath( poly, translation ));
                            
                            // add polygon rings one at a time, for self intersection of 
                            // ext ring it's ok, but with holes I don't thinks it's ok
                            // TODO fix case with holes
                            try {
                                simpPoly.forEach( function(ring) { addTrianglesFromClipperPaths(geom, [ring]); });
                                console.log('dubious fix for gid=',feat.properties.gid);
                            }
                            catch (err){
                                console.log('failed feature triangulation after simplification and fix atempts for gid=',feat.properties.gid, err);
                            }
                        }
                    }
                });

            });
            var end = new Date().getTime();
            console.log((end-start)/1000.+'sec to triangulate '+nbPoly+' polygons with '+nbInvalid+' failed triangulations');

            geom.computeBoundingBox();
            //console.log('bbox ', geom.boundingBox.min, geom.boundingBox.max);
            //console.log('nb of vtx ', geom.vertices.length );
            //console.log('nb of faces ', geom.faces.length );
            geom.computeFaceNormals();
            var material;
            if (object.terrain && !object.symbology.polygon.extrude) {
                var drapingShader = ShaderDraping[ "draping" ];
                var uniformsDraping = THREE.UniformsUtils.clone(drapingShader.uniforms);
                uniformsDraping['color'].value.setHex(object.symbology.polygon.color); 
                uniformsDraping['opacity'].value = object.symbology.polygon.opacity; 
                uniformsDraping['uZoffset'].value = 1; 
                uniformsDraping[ "tDisplacement" ].value = object.terrain.demTextures[tileId];
                uniformsDraping[ "uDisplacementScale" ].value = 100;
                material = new THREE.ShaderMaterial({
                    uniforms:uniformsDraping,
                    vertexShader:drapingShader.vertexShader,
                    fragmentShader:drapingShader.fragmentShader,
                    lights:true,
                    transparent: true
                });
            }
            else {
                material =  new THREE.MeshLambertMaterial( 
                        { color:0x00ff00, ambient:0x00ff00, wireframe:true } );
            }

            computeTileUv(geom, center, size);
            geom.computeFaceNormals();
            geom.computeVertexNormals();
            geom.computeTangents();

            var group = new THREE.Object3D();
            group.add(new THREE.Mesh( geom, material ));
            console.log(lineGeom);
            if ( object.symbology.polygon.lineColor && object.symbology.polygon.lineWidth){
                group.add(new THREE.Line( lineGeom, 
                            new THREE.LineBasicMaterial({ color:object.symbology.polygon.lineColor, 
                                                          linewidth:object.symbology.polygon.lineWidth }) , 
                            THREE.LinePieces ));
            }
            group.add(new THREE.Line( errGeom, new THREE.LineBasicMaterial({ color:0xff0000, linewidth: 1 }) , THREE.LinePieces ));
            group.add(new THREE.Line( errSpotGeom, new THREE.LineBasicMaterial({ color:0xff0000, linewidth: 3 }) , THREE.LinePieces ));
            
            callback(group);
        },
        async:   true,
        dataType: 'json',
        error: function(jqXHR, textStatus, errorThrown) {
            console.log(textStatus+' :'+errorThrown);
            throw errorThrown;
        }
    });
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
