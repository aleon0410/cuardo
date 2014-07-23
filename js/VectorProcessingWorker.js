// clipper use alert(?), which is not defined in a worker
function alert(msg)
{
    console.log("ALERT:" + msg);
}

importScripts('../thirdparty/clipper.js');
importScripts('../thirdparty/poly2tri.js');
importScripts('../thirdparty/three.js/build/three.js');

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
                lastPt = new THREE.Vector3(pt.X, pt.Y, 0);
                geom.vertices.push(lastPt);
            }
            else {
                lastPt = new THREE.Vector3(pt.X, pt.Y, 0);
            }
        });
    });
}

function addTrianglesFromClipperPathsExtrusion(geom, paths, heigth){
    var i = geom.vertices.length;
    var addedVtx = 0;
    var addedFac = 0; 
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
                addedVtx += 4;
                addedFac += 2;
            }
            else {
                lastPt = new THREE.Vector3(pt.X, pt.Y, 0);
            }
        });
    });
}

function addTrianglesFromClipperPaths(geom, paths, height){
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
            geom.vertices.push(new THREE.Vector3(p.x, p.y, height || 0));
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
        if (  ( !clipperPath.length && r.length >= 3 && isClockwise(r) )
           || ( clipperPath.length && r.length >= 3 && !isClockwise(r) ) ) r.reverse();
        clipperPath.push(r);
    });
    //return ClipperLib.Clipper.CleanPolygons(clipperPath, 0.0001); // centimetric precision
    return clipperPath;
}

function isClockwise( ring ) {
    var u = {X:ring[0].X-ring[1].X, 
             Y:ring[0].Y-ring[1].Y};
    var v = {X:ring[2].X-ring[1].X, 
             Y:ring[2].Y-ring[1].Y};
    return (u.X*v.Y - v.X*u.Y ) > 0;
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
        for (var f=0; f<geom.faces.length; f+=1){
            var face = geom.faces[f];
            var uv = [new THREE.Vector2((geom.vertices[face.a].x-tileOrigin.x)/size, 
                                        (geom.vertices[face.a].y-tileOrigin.y)/size),
                      new THREE.Vector2((geom.vertices[face.b].x-tileOrigin.x)/size, 
                                        (geom.vertices[face.b].y-tileOrigin.y)/size),
                      new THREE.Vector2((geom.vertices[face.c].x-tileOrigin.x)/size, 
                                        (geom.vertices[face.c].y-tileOrigin.y)/size)];
            geom.faceVertexUvs[ 0 ].push(uv);
        }
    }
}

function vectorProcessing( d ) {
    console.log("vector processing", d.tileId);
    var data = d.data;
    var ctxt = d.ctxt;

    var reqend = new Date().getTime();
    //console.log('it took ', (reqend-reqstart)/1000., 'sec to compled request');
    var userData = {name:'mesh',faceGidMap:[]};
    var userDataWall = {name:'wallMesh',faceGidMap:[]};
    var start = new Date().getTime();
    var geom = new THREE.Geometry();
    var wallGeom = new THREE.Geometry();
    var lineGeom = new THREE.Geometry();
    var errGeom = new THREE.Geometry();
    var errSpotGeom = new THREE.Geometry();
    var nbInvalid = 0;
    var nbPoly = 0;
    // MULTIPOLYGON ONLY
//    console.log(data);
    data.features.forEach( function(feat) {
        var nbFace = geom.faces.length;
        var nbWallFace = wallGeom.faces.length;
        if (feat.geometry.bbox.length == 6 
            && Math.abs(feat.geometry.bbox[2]-feat.geometry.bbox[5] ) > EPSILON) {
            is3d = true;
        }
        feat.geometry.coordinates.forEach( function(poly){
            nbPoly++;

            // TODO transform 3D polygons to put them in a plane

            var clipped = clip( clipperPath( poly, ctxt.translation ), 
                                ctxt.clipperRect, 
                                ctxt.symbology.polygon.lineColor || ctxt.symbology.polygon.lineWidth || ctxt.symbology.polygon.extrude );
             if (!clipped.poly.length) return;

            try {
                var heigth;
                if (ctxt.symbology.polygon.extrude) {
                    heigth = +feat.properties[ ctxt.symbology.polygon.extrude];
                    addTrianglesFromClipperPathsExtrusion(wallGeom, clipped.contour, heigth);
                }
                addTrianglesFromClipperPaths(geom, clipped.poly, heigth);
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
                    console.log('fixed polygon gid=',feat.properties.gid, err);
                }
                catch (err) {
                    // complete failed geom (before clipping)
                    addLinesFromClipperPaths(errGeom, clipperPath( poly, ctxt.translation ));
                    
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

        // create the map face -> gid
        for (var f=nbFace; f<geom.faces.length; f++) {
            userData.faceGidMap.push(feat.properties.gid);
        }
        for (var f=nbWallFace; f<wallGeom.faces.length; f++) {
            userDataWall.faceGidMap.push(feat.properties.gid);
        }
    });
    var end = new Date().getTime();
//    console.log((end-start)/1000.+'sec to triangulate '+nbPoly+' polygons with '+nbInvalid+' failed triangulations');

    computeTileUv(geom, ctxt.center, ctxt.size);
    geom.computeFaceNormals();
    geom.computeVertexNormals();
    geom.computeTangents();

    if (ctxt.symbology.polygon.extrude){
        computeTileUv(wallGeom, ctxt.center, ctxt.size);
    }
    var r = { geom:geom, lineGeom:lineGeom, errGeom:errGeom, errSpotGeom:errSpotGeom, wallGeom:wallGeom, userDataWall:userDataWall, userData:userData, tileId: d.tileId };
    return r;
}


onmessage = function(o) {
    postMessage( vectorProcessing( o.data, o.ctxt ) );
}
