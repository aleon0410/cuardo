// clipper use alert(?), which is not defined in a worker
function alert(msg)
{
    console.log("ALERT:" + msg);
}

importScripts('../thirdparty/clipper.js');
importScripts('../thirdparty/poly2tri.js');
importScripts('../thirdparty/three.js/build/three.js');

var EPSILON = 1e-6;


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

function p2tPath( clipperPath ) {
    var rings = [];
    clipperPath.forEach( function(ring) {
        var r = rings.length;
        rings.push([]);
        ring.forEach( function(point) {
            rings[r].push({x:point.X, y:point.Y});
        });
    });
    return rings;
} 

function p2tBbox( poly ) {
    var bbox = [poly[0][0].x, poly[0][0].y, poly[0][0].x, poly[0][0].y ];
    poly.forEach( function(ring) {
        ring.forEach( function(point) {
            (point.x < bbox[0]) && (bbox[0] = point.x);
            (point.y < bbox[1]) && (bbox[1] = point.y);
            (point.x > bbox[2]) && (bbox[2] = point.x);
            (point.y > bbox[3]) && (bbox[3] = point.y);
        });
    });
    return bbox;
}

function triangulate(geom, paths, additionalPoints, height){

    if (!paths.length || !paths[0].length) return;

    var swctx = new poly2tri.SweepContext(paths[0]);
    for (var r=1; r<paths.length; r++) {
        if (paths[r].length) swctx.addHole(paths[r]);
    }
    additionalPoints.forEach(function(p){ swctx.addPoint(p); });
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

// the poly should be clipped by grid before calling
// return a list of points to add to poly2try
function grid(poly, polyBbox, gridCenter, gridSize, gridNbDiv){
    // ray tracing along x
    var y0 = gridCenter.y - 0.5*gridSize;
    var x0 = gridCenter.x - 0.5*gridSize;
    var stepSize = gridSize/gridNbDiv;
    var bottomIdx = Math.ceil( (polyBbox[1]-y0) / stepSize); 
    var topIdx = Math.floor( (polyBbox[3]-y0) / stepSize ); 
    if ( bottomIdx < 0 || topIdx > gridNbDiv ) throw 'bug';
    var points = [];
    //var iter = 100;
    var allInter = [];
    for ( var iy=bottomIdx; iy<=topIdx; iy++ ) {
        //console.log("y ", iy-bottomIdx+1, '/',topIdx-bottomIdx);
        var y = y0 + iy*stepSize;
        // find all intersections with this ray
        var intersections = [];//{ringIdx,segmentIdx,alpha, x, y}
        for (var r=0; r<poly.length; r++) {
            //console.log('ring ', r+1, '/',poly.length);
            var hit = 0;
            for (var p=1; p<=poly[r].length; p++) {
                //console.log('segment ', p, '/',poly[r].length-1);
                var segment = [ poly[r][p-1], poly[r][p%poly[r].length] ];
                //console.log( 'segment',segment, p-1, p%poly[r].length );
                var ySpan = segment[1].y - segment[0].y;
                //if (! --iter) throw 'here';
                //console.log( 'ySpan', ySpan, segment[0].y, y , segment[1].y);
                if ( Math.abs(ySpan) > EPSILON ) { // parralel to ray otherwise
                    var alpha =  (y - segment[0].y)/ySpan;
                    //console.log( 'alpha ', alpha );
                    if ( alpha >=0 && alpha <= 1){ // 
                        var x = segment[0].x + alpha * ( segment[1].x - segment[0].x );
                        intersections.push({
                                ringIdx:r, 
                                segmentIdx:p-1, 
                                alpha:alpha, 
                                x:x,
                                y:y
                                });
                        hit++;
                        if ( alpha == 1 &&
                           ( segment[0].y - y )*(  poly[r][(p+1)%poly[r].length].y - y ) < 0 ) { 
                            // decide if the raw crosses or touches
                            // the collision will also be detected by next segment test, 
                            // we keep it only if the ray does not cross the line
                            // i.e. the ray enters and exist at this point
                            intersections.pop();
                            --hit;
                            console.log('removed dupe at ',x,y)
                        }
                        //console.log('hit');
                    }
                }
                else if ( Math.abs(segment[0].y - y) < EPSILON) { // parallel to ray
                    // we have an intersection before and after
                    // for external ring we skip them
                    ++p;
                    intersections.pop();
                    --hit;
                }
            }
            //console.log ('ring ', r, 'hit ', hit);
            if ( hit%2 ) throw 'bug';
        }

        allInter.push.apply(allInter, intersections);

        intersections.sort(function(a,b){return a.x - b.x;});

        for ( var i = 1; i < intersections.length; i+=2 ) {
            //console.log('inter ', i+1, '/',intersections.length);
            var leftIdx = Math.ceil( (intersections[i-1].x-x0) / stepSize); 
            var rightIdx = Math.floor( (intersections[i].x-x0) / stepSize ); 
            //console.log('xIdx', leftIdx,rightIdx, intersections[i-1].x, intersections[i].x );
            for ( var ix = leftIdx; ix<=rightIdx; ix++ ){
                var x = x0 + ix*stepSize;
                //console.log(x,intersections[i-1].x,y);
                if (Math.abs(x - intersections[i-1].x) > EPSILON && Math.abs(x - intersections[i].x) > EPSILON){ // avoid point on line
                    points.push({x:x, y:y});
                }
            }
        }
    }

    // sort intersections by ring, reverse segments and reverse alpha
    allInter.sort( function( a, b ) {
        //
        if ( a.ringIdx == b.ringIdx) {
            if ( a.segmentIdx == b.segmentIdx ) {
                return b.alpha - a.alpha;
            }
            return b.segmentIdx - a.segmentIdx;
        }
        return a.ringIdx - b.ringIdx;

    });

    allInter.forEach( function(inter) {
        if ( inter.alpha > 100*EPSILON && inter.alpha < 1 - 100*EPSILON ){
            poly[inter.ringIdx].splice( inter.segmentIdx+1, 0, {x:inter.x, y:inter.y});
        }
    });

    // add intersections with x rays
    poly.forEach( function( ring ) {
        for (var p=1; p <= ring.length; p++) {
            var segment = [ ring[p-1], ring[p%ring.length] ];
            var startIdx =  (segment[0].x-x0) / stepSize; 
            var endIdx = (segment[1].x-x0) / stepSize;
            if ( startIdx < endIdx ) {
                var leftIdx = Math.floor(startIdx);
                var rightIdx = Math.ceil(endIdx);
                for ( i = rightIdx-1; i >= leftIdx+1; i-- ){
                    var x = x0 + i*stepSize;
                    var alpha =  (x - segment[0].x)/(segment[1].x-segment[0].x);
                    ring.splice(p, 0, {x:x ,y:segment[0].y + alpha * ( segment[1].y - segment[0].y )});
                }
            }
            else {
                var leftIdx = Math.floor(endIdx);
                var rightIdx = Math.ceil(startIdx);
                for ( i = leftIdx+1; i < rightIdx; i++ ){
                    var x = x0 + i*stepSize;
                    var alpha =  (x - segment[0].x)/(segment[1].x-segment[0].x);
                    ring.splice(p, 0, {x:x ,y:segment[0].y + alpha * ( segment[1].y - segment[0].y )});
                }
            }
        }
    });

    return points;
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

            var paths = p2tPath( clipped.poly );
            var polyBbox = p2tBbox( paths );
            var additionalPoints = grid( paths, polyBbox, ctxt.center, ctxt.size, ctxt.nbIntervals );

            //try {
                var heigth;
                if (ctxt.symbology.polygon.extrude) {
                    heigth = +feat.properties[ ctxt.symbology.polygon.extrude];
                    addTrianglesFromClipperPathsExtrusion(wallGeom, clipped.contour, heigth);
                }
                triangulate(geom, paths, additionalPoints, heigth);
                if (clipped.contour && clipped.contour.length) {
                    addLinesFromClipperPaths( lineGeom, clipped.contour );
                }
            /*}
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
                    var paths = p2tPath( simpPoly );
                    var polyBbox = p2tBbox( paths );
                    var additionalPoints = grid( paths, polyBbox, ctxt.center, ctxt.size, ctxt.nbIntervals );
                    triangulate(geom, paths, heigth);
                    console.log('fixed polygon gid=',feat.properties.gid, err);
                }
                catch (err) {
                    // complete failed geom (before clipping)
                    addLinesFromClipperPaths(errGeom, clipperPath( poly, ctxt.translation ));
                    
                    // add polygon exterior rings 
                    // TODO fix case with holes
                    try {
                        var paths = p2tPath( [simpPoly[0]] );
                        var polyBbox = p2tBbox( paths );
                        var additionalPoints = grid( paths, polyBbox, ctxt.center, ctxt.size, ctxt.nbIntervals );
                        triangulate(geom, paths, heigth);
                        console.log('dubious fix for gid=',feat.properties.gid);
                    }
                    catch (err){
                        console.log('failed feature triangulation after simplification and fix atempts for gid=',feat.properties.gid, err);
                    }
                }
            }*/
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
