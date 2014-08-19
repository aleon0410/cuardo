// clipper use alert(?), which is not defined in a worker
function alert(msg)
{
    console.log("ALERT:" + msg);
}

importScripts('../thirdparty/clipper.js');
importScripts('../thirdparty/poly2tri.js');
importScripts('../thirdparty/three.js/build/three.js');

var EPSILON = 1e-6;

var Timer = function() {
    this.t = null;
    // accumulated time
    this.acc = 0;
}; 

Timer.prototype.start = function() {
    this.t = new Date().getTime();
};

Timer.prototype.stop = function() {
    var t = new Date().getTime();
    this.acc += t - this.t;
}

Timer.prototype.get = function() {
    return this.acc;
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

function addTrianglesFromExtrusion(geom, paths, heigth, center, size){
    var i = geom.vertices.length;
    var tileOrigin = {x:center.x-size*.5, y:center.y-size*.5};
    var addedVtx = 0;
    paths.forEach( function(ring) {
        var lastPt;
        ring.forEach( function(pt) {
            if (lastPt){
                geom.vertices.push(lastPt);
                var lastPtH = new THREE.Vector3(lastPt.x, lastPt.y, heigth);
                lastPt = new THREE.Vector3(pt.x, pt.y, 0);
                geom.vertices.push(lastPt);

                geom.vertices.push(lastPtH);
                lastPtH = new THREE.Vector3(lastPt.x, lastPt.y, heigth);
                geom.vertices.push(lastPtH);
                var faces = [ new THREE.Face3(i, i+1, i+2), new THREE.Face3(i+2, i+1, i+3)];
                faces.forEach( function(face){
                    geom.faces.push( face );
                    
                    var uv = [new THREE.Vector2((geom.vertices[face.a].x-tileOrigin.x)/size, 
                                                (geom.vertices[face.a].y-tileOrigin.y)/size),
                              new THREE.Vector2((geom.vertices[face.b].x-tileOrigin.x)/size, 
                                                (geom.vertices[face.b].y-tileOrigin.y)/size),
                              new THREE.Vector2((geom.vertices[face.c].x-tileOrigin.x)/size, 
                                                (geom.vertices[face.c].y-tileOrigin.y)/size)];
                    geom.faceVertexUvs[ 0 ].push(uv);
                });
                i+=4;
            }
            else {
                lastPt = new THREE.Vector3(pt.x, pt.y, 0);
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

function triangulate(geom, paths, additionalPoints, center, size ){

    if (!paths.length || !paths[0].length) return;
    var tileOrigin = {x:center.x-size*.5, y:center.y-size*.5};

    var swctx = new poly2tri.SweepContext(paths[0]);
    for (var r=1; r<paths.length; r++) {
        if (paths[r].length) swctx.addHole(paths[r]);
    }
    additionalPoints.forEach(function(p){ swctx.addPoint(p); });
    swctx.triangulate();
    var triangles = swctx.getTriangles();
    var i = geom.vertices.length;
    // TODO: the points in poly2try are in the order they were input, dont make it a triangle soup
    triangles.forEach(function(t) {
        t.getPoints().forEach(function(p) {
            geom.vertices.push(new THREE.Vector3(p.x, p.y, 0 ));
        });

        var face = new THREE.Face3(i, i+1, i+2);
        geom.faces.push( face );
        var uv = [new THREE.Vector2((geom.vertices[face.a].x-tileOrigin.x)/size, 
                                    (geom.vertices[face.a].y-tileOrigin.y)/size),
                  new THREE.Vector2((geom.vertices[face.b].x-tileOrigin.x)/size, 
                                    (geom.vertices[face.b].y-tileOrigin.y)/size),
                  new THREE.Vector2((geom.vertices[face.c].x-tileOrigin.x)/size, 
                                    (geom.vertices[face.c].y-tileOrigin.y)/size)];
        geom.faceVertexUvs[ 0 ].push(uv);
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
    return ClipperLib.Clipper.CleanPolygons(clipperPath, 0.0001); // centimetric precision
    //return clipperPath;
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


// the plane should not be rotated and additional geometries should be placed
// after the initial plane geometry for this to workout
function gridAltitude( x, y, vertices, nbIntervals ){

    var gridX1 = nbIntervals + 1;
    var gridX1sq = gridX1*gridX1;

    var bbox = [ vertices[0].x, vertices[0].y,
                 vertices[gridX1sq - 1].x, vertices[gridX1sq - 1].y ];

   if ( x < bbox[0] || x > bbox[2] || y < bbox[1] || y > bbox[3] ) {
       throw 'out of plane'+x+' '+y+' '+bbox.join( ', ' );
   }

   var segment_width = vertices[1].x - vertices[0].x;

   var dx = (x - bbox[0]) / segment_width;
   var dy = (y - bbox[1]) / segment_width;
   var ix = Math.round( dx );
   var iy = Math.round( dy );
   var orig = gridX1 * Math.floor( dy ) + Math.floor( dx );

   if ( Math.abs(ix - dx) < EPSILON && Math.abs(iy - dy) < EPSILON ) return vertices[orig].z;

   var border = false;
      
   if ( iy == nbIntervals ) { // on the top border
       var a = vertices[orig]; 
       var b = vertices[orig+1]; 
       var alpha = (x - a.x) / (b.x - a.x);
       return (1 - alpha) * a.z + alpha * b.z;
   }
   
   if ( ix == nbIntervals ) { // on the right border
       var a = vertices[orig]; 
       var d = vertices[orig+gridX1]; 
       var alpha = (y - a.y) / (d.y - a.y);
       return (1 - alpha) * a.z + alpha * d.z;
   }


   // TODO fix the interpolation
   return vertices[orig].z; 

   //d---c
   //| \ |
   //a---b
   try {
   if ( ix < dx && iy < dy ){ // lower left triangle
       var a = vertices[orig]; 
       var b = vertices[orig+1]; 
       var d = vertices[orig+gridX1]; 
       var det = segment_width*segment_width;
       var lambda1 = ( (d.x - b.x) * (y - b.y)  - (d.y - b.y) * (x - b.x) ) / det ;
       if (lambda1 > 1 || lambda1 < 0 ) throw 'll lambda1'+lambda1;
       var lambda3 = ( (b.x - a.x) * (y - a.y)  - (b.y - a.y) * (x - a.x) ) / det ;
       if (lambda3 > 1 || lambda3 < 0 ) throw 'll lambda3'+lambda3;
       var lambda2 = 1 - lambda1 - lambda3 ;
       return lambda1*a.z + lambda2*b.z + lambda3*d.z;
   }
   else { // upper right
       var b = vertices[orig+1]; 
       var c = vertices[orig+gridX1+1]; 
       var d = vertices[orig+gridX1]; 
       var det = segment_width*segment_width;
       var lambda1 = ( (d.x - c.x) * (y - c.y)  - (d.y - c.y) * (x - c.x) ) / det ;
       if (lambda1 > 1 || lambda1 < 0 ) throw 'ur lambda1'+lambda1;
       var lambda3 = ( (c.x - b.x) * (y - b.y)  - (c.y - b.y) * (x - b.x) ) / det ;
       if (lambda3 > 1 || lambda3 < 0 ) throw 'ur lambda3'+lambda3;
       var lambda2 = 1 - lambda1 - lambda3 ;
       return lambda1*b.z + lambda2*c.z + lambda3*d.z;
   }
   }
   catch (err) {
       console.log('error ', border, ix < dx && iy < dy, err);
       return vertices[orig].z;
   }
}

//function computeTileUv(geom, center, size) {
//    // uv coord are relative to the tile
//    {
//        var tileOrigin = {x:center.x-size*.5, y:center.y-size*.5};
//        for (var f=0; f<geom.faces.length; f+=1){
//            var face = geom.faces[f];
//            var uv = [new THREE.Vector2((geom.vertices[face.a].x-tileOrigin.x)/size, 
//                                        (geom.vertices[face.a].y-tileOrigin.y)/size),
//                      new THREE.Vector2((geom.vertices[face.b].x-tileOrigin.x)/size, 
//                                        (geom.vertices[face.b].y-tileOrigin.y)/size),
//                      new THREE.Vector2((geom.vertices[face.c].x-tileOrigin.x)/size, 
//                                        (geom.vertices[face.c].y-tileOrigin.y)/size)];
//            geom.faceVertexUvs[ 0 ].push(uv);
//        }
//    }
//}

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
                            //console.log('removed dupe at ',x,y)
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
//    console.log("vector processing", d.tileId);
    var data = d.data;
    var ctxt = d.ctxt;

    var bboxTile = [ctxt.center.x - .5*ctxt.size,
                    ctxt.center.y - .5*ctxt.size,
                    ctxt.center.x + .5*ctxt.size,
                    ctxt.center.y + .5*ctxt.size];
    //console.log('it took ', (reqend-reqstart)/1000., 'sec to compled request');
    var userData = {name:'mesh',faceGidMap:[]};
    var userDataWall = {name:'wallMesh',faceGidMap:[]};
    var geom = new THREE.Geometry();
    var wallGeom = new THREE.Geometry();
    var lineGeom = new THREE.Geometry();
    var errGeom = new THREE.Geometry();
    var errSpotGeom = new THREE.Geometry();
    var nbInvalid = 0;
    var nbPoly = 0;

    var clipTimer = new Timer();
    var triangulateTimer = new Timer();
    // MULTIPOLYGON ONLY
//    console.log(data);
    data.features.forEach( function(feat) {
        var nbFace = geom.faces.length;
        var nbWallFace = wallGeom.faces.length;
        if (feat.geometry.bbox.length == 6 
            && Math.abs(feat.geometry.bbox[2]-feat.geometry.bbox[5] ) > EPSILON) {
            is3d = true;
        }

        var processPolygon = function( poly ) {
            
            var bboxCenter = feat.geometry.bbox.length == 4 ? 
                {
                    x: ( (+feat.geometry.bbox[0]) 
                         + (+feat.geometry.bbox[2]) )*.5 + ctxt.translation.x,
                    y: ( (+feat.geometry.bbox[1]) 
                            + (+feat.geometry.bbox[3]) )*.5 +ctxt.translation.y 
                }
                :
                {
                    x: ( (+feat.geometry.bbox[0]) 
                         + (+feat.geometry.bbox[3]) )*.5 + ctxt.translation.x,
                    y: ( (+feat.geometry.bbox[1]) 
                            + (+feat.geometry.bbox[4]) )*.5 +ctxt.translation.y 
                };

            var geometry = new THREE.Geometry();
            var wallGeometry = new THREE.Geometry();
            // first chose if we clip + simplify + add points or if we just exclude feature on south and west
            // if we drape we want to do that
            //
            var paths;
            var contours;
            var additionalPoints = [];
            var addContour = ctxt.symbology.polygon.lineColor || ctxt.symbology.polygon.lineWidth || ctxt.symbology.polygon.extrude;
            if (ctxt.symbology.draping){
                clipTimer.start();
                var clipped = clip( clipperPath( poly, ctxt.translation ), 
                                    ctxt.clipperRect, 
                                    addContour );
                clipTimer.stop();
                paths = p2tPath( clipped.poly );
                additionalPoints = grid( paths, p2tBbox( paths ), ctxt.center, ctxt.size, ctxt.nbIntervals );
                if (addContour) contours = p2tPath( clipped.contour ) || null; 
            }
            else {
                if ( bboxCenter.x <= bboxTile[0]
                  || bboxCenter.y <= bboxTile[1]
                  || bboxCenter.x > bboxTile[2]
                  || bboxCenter.y > bboxTile[3] ) return; // feature will be included by another tile
                paths = p2tPath( clipperPath( poly, ctxt.translation ) );
                if (addContour) contours = paths; 
            }


//gridAltitude( p.x, p.y, gridVertices, gridNbIntervals ) + ( height || 0 )
//                    addLinesFromClipperPaths( lineGeom, clipped.contour );

// heigth = +feat.properties[ ctxt.symbology.polygon.extrude ];
// FIX 1
// var simpPoly = ClipperLib.Clipper.SimplifyPolygons( clipped.poly, ClipperLib.PolyFillType.pftEvenOdd );
// FIX 2
// var paths = p2tPath( [simpPoly[0]] );
// //var polyBbox = p2tBbox( paths );
// //var additionalPoints = grid( paths, polyBbox, ctxt.center, ctxt.size, ctxt.nbIntervals );
// triangulate(geom, paths, additionalPoints, heigth, ctxt.center, ctxt.size);
// console.log('dubious fix for gid=',feat.properties.gid);
            try {
                triangulateTimer.start();
                triangulate(geometry, paths, additionalPoints, ctxt.center, ctxt.size);
                triangulateTimer.stop();
            }
            catch (err) {
                nbInvalid++;
                // show error spots for debug
                if (err.points) {
                    var points = [];
                    err.points.forEach(function(p){ points.push({X:p.x, Y:p.y}); });
                    addLinesFromClipperPaths(errSpotGeom, [points])
                }
                console.log('failed feature triangulation gid=',feat.properties.gid, err);
            }

            // extrude walls if needed
            if ( ctxt.symbology.polygon.extrude ){ 
                var heigth = +feat.properties[ ctxt.symbology.polygon.extrude ];
                addTrianglesFromExtrusion(wallGeometry, contours, heigth, ctxt.center, ctxt.size);
            }

            // now offset the vertices
            if ( ctxt.symbology.draping ){
                geometry.vertices.forEach( function(v){
                    v.z = gridAltitude( v.x, v.y, ctxt.gridVertices, ctxt.gridNbIntervals );
                });
                //wallGeometry.vertices.forEach( function(v){
                //    v.z += gridAltitude( v.x, v.y, ctxt.gridVertices, ctxt.gridNbIntervals );
                //});
            }

            var zOffset = (ctxt.symbology.zOffsetPercent * ctxt.size || 0)
                        + (ctxt.symbology.zOffset || 0);

            if ( ctxt.symbology.polygon.extrude ){ 
                zOffset +=  gridAltitude( bboxCenter.x, bboxCenter.y, 
                                 ctxt.gridVertices, ctxt.gridNbIntervals );
                wallGeometry.vertices.forEach( function(v){
                    v.z += 30;
                });
                zOffset += +feat.properties[ ctxt.symbology.polygon.extrude ];
            }

            geometry.vertices.forEach( function(v){
                v.z += zOffset;
            });


            // append geometry to geom
            geom.merge(geometry);
            wallGeom.merge(wallGeometry);
        }

        switch ( feat.geometry.type ) {
            case "MultiPolygon": {
                feat.geometry.coordinates.forEach( function(poly){
                    nbPoly++;
                    processPolygon(poly);
                });
            }
            break;
            case "Polygon": {
                processPolygon( feat.geometry.coordinates );
            }
            break;
            default:
            throw "Unsupported geometry type " + feat.geometry.type;
        }

        // create the map face -> gid
        for (var f=nbFace; f<geom.faces.length; f++) {
            userData.faceGidMap.push(feat.properties.gid);
        }
        for (var f=nbWallFace; f<wallGeom.faces.length; f++) {
            userDataWall.faceGidMap.push(feat.properties.gid);
        }
    });

    //computeTileUv(geom, ctxt.center, ctxt.size);
    geom.computeFaceNormals();
    geom.computeVertexNormals();
    geom.computeTangents();

    wallGeom.computeFaceNormals();
    wallGeom.computeVertexNormals();
    wallGeom.computeTangents();

    if (ctxt.symbology.polygon.extrude){
        //computeTileUv(wallGeom, ctxt.center, ctxt.size);
    }
    var r = { geom:geom, lineGeom:lineGeom, errGeom:errGeom, errSpotGeom:errSpotGeom, wallGeom:wallGeom, userDataWall:userDataWall, userData:userData, tileId: d.tileId };
    console.log('Processing time: clipping ' + clipTimer.get() + " triangulate " + triangulateTimer.get() );
    return r;
}


onmessage = function(o) {
    postMessage( vectorProcessing( o.data, o.ctxt ) );
}
