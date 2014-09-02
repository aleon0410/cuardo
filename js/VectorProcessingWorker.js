// clipper use alert(?), which is not defined in a worker
function alert(msg)
{
    console.log("ALERT:" + msg);
}

importScripts('../thirdparty/clipper.js');
importScripts('../thirdparty/poly2tri.js');
importScripts('../thirdparty/three.js/build/three.js');
importScripts('Symbology.js');

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

var Geom = function(indexed) {
    this.indexed = indexed || false;
    this.position=[];
    this.color=[];
    this.gidMap = [];
    this.uv = [];
    if (this.indexed){
        this.index = [];
        this.offsets = [{start:0, count:0, index:0}];
    }
};

Geom.prototype.merge = function( other ) {
    if (!other.position.length) return;
    if (other.position.length/3 > 21845) throw 'too many vertices';

    if (other.indexed){
        if (!this.indexed) throw 'cannot merge indexed and unindexed geom';
        var offset = 0;
        var lastOffset = this.offsets.length-1;
        if ( (this.position.length + other.position.length)/3 - this.offsets[lastOffset].index > 21845 ){
            this.offsets.push({start:this.index.length, 
                               count:other.index.length, 
                               index:this.position.length/3});
        } else {
            offset = this.position.length/3 - this.offsets[lastOffset].index;
            this.offsets[lastOffset].count += other.index.length;
        }


        var object = this;
        other.index.forEach(function(idx){ object.index.push(idx + offset)});
    }

    Array.prototype.push.apply(this.gidMap, other.gidMap);
    Array.prototype.push.apply(this.position, other.position);
    Array.prototype.push.apply(this.color, other.color);
    if (other.uv) {
        if (!this.uv) this.uv = [];
        Array.prototype.push.apply(this.uv, other.uv);
    }
}

Geom.prototype.bufferGeometry = function() {
    var geom = new THREE.BufferGeometry();

    if (this.indexed){ 
        var object = this;
        if (!this.offsets.length) this.offsets.push({start:0, count:this.index.length, index:0});
        geom.offsets = this.offsets;
        geom.attributes.index = {array:new Uint16Array( this.index ), itemSize:3};
    }
    geom.attributes.position = {array:new Float32Array( this.position ), itemSize:3};
    geom.attributes.color = {array:new Float32Array( this.color ), itemSize:3};
    if (this.uv) geom.attributes.uv = {array:new Float32Array( this.uv ), itemSize:2};

    return geom;
}

var PolygonGeometries = function(){
    this.geometry = new Geom(true);
    this.wallGeometry = new Geom(true);
    this.lineGeometry = new Geom();
    this.errSpotGeometry = new Geom();
    this.errGeometry = new Geom();
}

PolygonGeometries.prototype.merge = function( other ) {
    this.geometry.merge(other.geometry);
    this.wallGeometry.merge(other.wallGeometry);
    this.lineGeometry.merge(other.lineGeometry);
    this.errSpotGeometry.merge(other.errSpotGeometry);
    this.errGeometry.merge(other.errGeometry);
}

var Tile = function(center, size, nbIntervals, vertices){
    this.center = center;
    this.size = size;
    this.nbIntervals = nbIntervals;
    this.bbox = [center.x - .5*size,
                 center.y - .5*size,
                 center.x + .5*size,
                 center.y + .5*size];
    this.vertices = vertices;
}

function lines(paths){
    var geom = new Geom();
    paths.forEach(function(ring) {
        for (var i=1; i<ring.length; i++){
            geom.position.push( ring[i-1].x, ring[i-1].y, 0 );
            geom.position.push( ring[i].x, ring[i].y, 0 );
        }
    });
    return geom;
}

function trianglesFromExtrusion(paths, heigth){
    var geom = new Geom(true);
    geom.index=[];
    paths.forEach( function(ring) {
        for (var i=1; i<ring.length; i++){
            var j = geom.position.length/3;
            geom.position.push( ring[i-1].x, ring[i-1].y, 0 );
            geom.position.push( ring[i].x, ring[i].y, 0) ;
            geom.position.push( ring[i].x, ring[i].y, heigth );
            geom.position.push( ring[i-1].x, ring[i-1].y, heigth );
            geom.index.push(j, j+1, j+2, 
                            j, j+2, j+3);
        }
    });
    return geom;
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
    if (!poly.length || !poly[0].length ) return null;
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

function triangulate(paths, additionalPoints){
    var geom = new Geom(true);
    if (!paths.length || !paths[0].length) return geom;

    var swctx = new poly2tri.SweepContext(paths[0]);
    for (var r=1; r<paths.length; r++) {
        if (paths[r].length) swctx.addHole(paths[r]);
    }
    additionalPoints.forEach(function(p){ swctx.addPoint(p); });
    swctx.triangulate();
    var triangles = swctx.getTriangles();
    
    paths.forEach( function(ring){
        ring.forEach( function(p){
            p.id = geom.position.length/3;
            geom.position.push(p.x, p.y, 0);
        });
    });
    additionalPoints.forEach( function(p){
        p.id = geom.position.length/3;
        geom.position.push(p.x, p.y, 0);
    });

    triangles.forEach(function(t) {
        geom.index.push( t.getPoint(0).id, t.getPoint(1).id, t.getPoint(2).id );
    });

// Recipe for triangle soup
//    var i = 0;
//    triangles.forEach(function(t) {
//        for (var v=0; v<3; v++)
//            geom.position.push(t.getPoint(v).x, t.getPoint(v).y, t.getPoint(v).z);
//        geom.index.push( i, i+1, i+2 );
//        i+=3;
//    });

    return geom;
}

function clipperPath( wfsPolygon, translation ) {
    var clipperPath = [];
    wfsPolygon.forEach( function(ring) {
        r = []
        ring.forEach( function(point) {
            r.push({X:point[0]+translation.x,Y:point[1]+translation.y});
        });
        if (r.length) r.pop(); // last point is a repeat of first
        if (  ( !clipperPath.length && isClockwise(r) )
           || ( clipperPath.length && !isClockwise(r) ) ) r.reverse();
        clipperPath.push(r);
    });
    return ClipperLib.Clipper.CleanPolygons(clipperPath, 0.0001); // centimetric precision
}

function isClockwise( ring ){
    return area(ring) < 0;
}

// area is negative if polygon is clockwise
function area( ring ) {
    var sum = 0;
    for (var i=0; i<ring.length; i ++){
        sum -= (ring[(i+1)%ring.length].X*ring[i].Y)-(ring[(i+1)%ring.length].Y*ring[i].X);
    }
    return sum*.5;
}


function intersects( point, bbox ){
    return point.x >= bbox[0]
        && point.y >= bbox[1]
        && point.x <= bbox[2]
        && point.y <= bbox[3];
}
/*
function fastClip( paths, bbox, needsContour ){
    // determine if we start inside or outside
    // goes alog the path
    // if we are inside, adds the point
    // if we cross the side, we add a point there

    var clippedPoly = [];
    var clippedContour = [];

    paths.forEach( function(ring){
        if (!ring.length) continue;
        var inside = intersects(ring[0], bbox);
        for (var i=0; i<ring.length; i++){
            if (intersects(ring[i], bbox))
        }
    });

    return {poly:clippedPoly, contour:clippedContour};

}
*/

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
function gridAltitude( x, y, tile ){

    if ( x < tile.bbox[0] || x > tile.bbox[2] || y < tile.bbox[1] || y > tile.bbox[3] ) {
       throw 'out of plane'+x+' '+y+' '+tile.bbox.join( ', ' );
    }
    var vertices = function(idx){
        return {x:tile.vertices[idx*3], 
                y:tile.vertices[idx*3+1],
                z:tile.vertices[idx*3+2]};
    };

    var cross = function(u, v){
        return u.x*v.y - u.y*v.x;
    };

    var sub = function(u, v){
        return {x:u.x-v.x, y:u.y-v.y};
    }

    var nbIntervals1 = tile.nbIntervals + 1;

   var segment_width = (tile.bbox[2]-tile.bbox[0])/tile.nbIntervals;

   var dx = (x - tile.bbox[0]) / segment_width;
   var dy = (y - tile.bbox[1]) / segment_width;
   var ix = Math.round( dx );
   var iy = Math.round( dy );
   var orig = nbIntervals1 * Math.floor( dy ) + Math.floor( dx );

   if ( Math.abs(ix - dx) < EPSILON && Math.abs(iy - dy) < EPSILON ) return vertices(orig).z;

   if ( iy == tile.nbIntervals ) { // on the top border
       var a = vertices(orig); 
       var b = vertices(orig+1); 
       var alpha = (x - a.x) / (b.x - a.x);
       return (1 - alpha) * a.z + alpha * b.z;
   }
   
   if ( ix == tile.nbIntervals ) { // on the right border
       var a = vertices(orig); 
       var d = vertices(orig+nbIntervals1); 
       var alpha = (y - a.y) / (d.y - a.y);
       return (1 - alpha) * a.z + alpha * d.z;
   }


   // TODO fix the interpolation

   var p = {x:x, y:y};
   //d---c
   //| \ |
   //a---b
   try {
   if ( ix < dx && iy < dy ){ // lower left triangle
       var a = vertices(orig); 
       var b = vertices(orig+1); 
       var d = vertices(orig+nbIntervals1); 
       var det = segment_width*segment_width;
       var lambda1 = cross(sub(d,b),sub(p,b)) / det ;
       if (lambda1 > 1 || lambda1 < 0 ) throw 'll lambda1'+lambda1;
       var lambda3 = cross(sub(b,a),sub(p,a)) / det ;
       if (lambda3 > 1 || lambda3 < 0 ) throw 'll lambda3'+lambda3;
       var lambda2 = 1 - lambda1 - lambda3 ;
       return lambda1*a.z + lambda2*b.z + lambda3*d.z;
   }
   else { // upper right
       var b = vertices(orig+1); 
       var c = vertices(orig+nbIntervals1+1); 
       var d = vertices(orig+nbIntervals1); 
       var det = segment_width*segment_width;
       var lambda1 = cross(sub(d,c),sub(p,c)) / det ;
       if (lambda1 > 1 || lambda1 < 0 ) throw 'ur lambda1'+lambda1;
       var lambda3 = cross(sub(c,b),sub(p,b)) / det ;
       if (lambda3 > 1 || lambda3 < 0 ) throw 'ur lambda3'+lambda3;
       var lambda2 = 1 - lambda1 - lambda3 ;
       return lambda1*b.z + lambda2*c.z + lambda3*d.z;
   }
   }
   catch (err) {
       console.log('error ', ix < dx && iy < dy, err);
       return vertices(orig).z;
   }
}

function computeTileUv(geom, tile) {
    geom.uv = [];
    // uv coord are relative to the tile
    for (var i=0; i<geom.position.length; i+=3){
        geom.uv.push( (geom.position[i  ] - tile.bbox[0])/tile.size,  
                      (geom.position[i+1] - tile.bbox[1])/tile.size );
    }
}

// the poly should be clipped by grid before calling
// return a list of points to add to poly2try
function grid(poly, polyBbox, tile){
    if (!polyBbox) return [];
    // ray tracing along x
    var y0 = tile.center.y - 0.5*tile.size;
    var x0 = tile.center.x - 0.5*tile.size;
    var stepSize = tile.size/tile.nbIntervals;
    var bottomIdx = Math.ceil( (polyBbox[1]-y0) / stepSize); 
    var topIdx = Math.floor( (polyBbox[3]-y0) / stepSize ); 
    if ( bottomIdx < 0 || topIdx > tile.nbIntervals ){
        throw 'bug '+bottomIdx+' '+topIdx+' '+tile.nbIntervals;
    }
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
            //if ( hit%2 ) throw 'bug';
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

function processPolygon( poly, bbox, properties, tile, translation, symbology, T ) {

    var res = new PolygonGeometries();

    var bboxCenter = bbox.length == 4 ? 
        {
            x: (bbox[0]+bbox[2])*.5 + translation.x,
            y: (bbox[1]+bbox[3])*.5 + translation.y 
        }
        :
        {
            x: (bbox[0]+bbox[3])*.5 + translation.x,
            y: (bbox[1]+bbox[4])*.5 + translation.y 
        };

    // first chose if we clip + simplify + add points or if we just exclude feature on south and west
    // if we drape we want to do that
    //
    var paths = [];
    var contours = [];
    var additionalPoints = [];
    var addContour = symbology.polygon.lineColor || symbology.polygon.lineWidth || symbology.polygon.extrude;
    if (symbology.draping){
        T['clip'].start();
        var clipped = clip( clipperPath( poly, translation ), 
                            [[{X:tile.bbox[0], Y:tile.bbox[1]},
                              {X:tile.bbox[2], Y:tile.bbox[1]},
                              {X:tile.bbox[2], Y:tile.bbox[3]},
                              {X:tile.bbox[0], Y:tile.bbox[3]},
                              ]], 
                            addContour );
        T['clip'].stop();
        T['p2t'].start();
        paths = p2tPath( clipped.poly );
        T['p2t'].stop();
        additionalPoints = grid( paths, p2tBbox( paths ), tile );
        if (addContour) contours = p2tPath( clipped.contour ); 
    }
    else {
        if ( bboxCenter.x <= tile.bbox[0]
          || bboxCenter.y <= tile.bbox[1]
          || bboxCenter.x > tile.bbox[2]
          || bboxCenter.y > tile.bbox[3] ) return res; // feature will be included by another tile
        T['p2t'].start();
        paths = p2tPath( clipperPath( poly, translation ) );
        T['p2t'].stop();
        
        if (addContour){
            T['contours'].start();
            paths.forEach( function(ring) {
                var r = contours.length;
                contours.push([]);
                ring.forEach( function(point) {
                    contours[r].push({x:point.x, y:point.y});
                });
                if (contours[r].length) contours[r].push(contours[r][0]);
            });
            T['contours'].stop();
        }
    }

    // FIX 1
    // var simpPoly = ClipperLib.Clipper.SimplifyPolygons( clipped.poly, ClipperLib.PolyFillType.pftEvenOdd );
    // FIX 2
    // var paths = p2tPath( [simpPoly[0]] );

    try {
        // WATCHOUT, path is modified here
        T['triangulation'].start();
        res.geometry = triangulate(paths, additionalPoints, tile);
        T['triangulation'].stop();
    }
    catch (err) {
        // show error spots for debug
        if (err.points) {
            var points = [];
            res.errSpotGeometry = lines(err.points);
            res.errGeometry = lines(contours);
        }
        console.log('failed feature triangulation gid=',properties.gid, err);
        return res;
    }

    // add lines if needed
    if ( symbology.polygon.lineColor || symbology.polygon.lineWidth ){
        T['lines'].start();
        res.lineGeometry = lines(contours);
        T['lines'].stop();
    }

    // extrude walls if needed
    var extrudedHeight;
    if ( symbology.polygon.extrude ){ 
        extrudedHeight = +evalExpression( symbology.polygon.extrude, properties );
    }
    if ( symbology.polygon.extrude ){ 
        T['extrusion'].start();
        res.wallGeometry = trianglesFromExtrusion(contours, extrudedHeight);
        T['extrusion'].stop();
    }

    T['uv'].start();
    computeTileUv(res.geometry, tile);
    computeTileUv(res.wallGeometry, tile);
    T['uv'].stop();

    var zOffset = (symbology.zOffsetPercent * tile.size || 0)
                + (symbology.zOffset || 0);
    // now offset the vertices
    T['zOffset'].start();
    if ( symbology.draping && tile.vertices ){
        for (var i=0, pos=res.geometry.position; i<pos.length; i+=3){
            pos[i+2] = gridAltitude( pos[i], pos[i+1], tile ) + zOffset;
        }
        for (var i=0, pos=res.wallGeometry.position; i<pos.length; i+=3){
            pos[i+2] = gridAltitude( pos[i], pos[i+1], tile ) + zOffset;
        }
        for (var i=0, pos=res.lineGeometry.position; i<pos.length; i+=3){
            pos[i+2] = gridAltitude( pos[i], pos[i+1], tile ) + zOffset;
        }
    }
    else {
        if (tile.vertices) zOffset += gridAltitude( bboxCenter.x, bboxCenter.y, tile );
        for (var i=0, pos=res.wallGeometry.position; i<pos.length; i+=3){
            pos[i+2] += zOffset;
        }
        for (var i=0, pos=res.lineGeometry.position; i<pos.length; i+=3){
            pos[i+2] += zOffset;
        }
        if (symbology.polygon.extrude){
            zOffset += extrudedHeight;
        }
        for (var i=0, pos=res.geometry.position; i<pos.length; i+=3){
            pos[i+2] += zOffset;
        }
    }
    T['zOffset'].stop();


    T['color'].start();
    // color feature
    var c = {r:1, g:1, b:1};
    if ( symbology.polygon.color ) {
        c = toRGB(evalExpression( symbology.polygon.color, properties ));
    }

    res.geometry.color = [];
    for (var i=0; i<res.geometry.position.length; i+=3){
        res.geometry.color.push( c.r, c.g, c.b );
    }
    res.wallGeometry.color = [];
    for (var i=0; i<res.wallGeometry.position.length; i+=3){
        res.wallGeometry.color.push( c.r, c.g, c.b );
    }
    res.lineGeometry.color = [];
    for (var i=0; i<res.lineGeometry.position.length; i+=3){
        res.lineGeometry.color.push( c.r, c.g, c.b );
    }
    T['color'].stop();

    T['map'].start();
    for (var f=0, end=res.geometry.position.length; f<end; f+=3) {
        res.geometry.gidMap.push(+properties.gid);
    }
    for (var f=0, end=res.wallGeometry.position.length; f<end; f+=3) {
        res.wallGeometry.gidMap.push(+properties.gid);
    }
    T['map'].stop();

    return res;
}

function processPoint( point, properties, tile, translation, symbology ) {
    var res = new PolygonGeometries();
    var ee = function(e) {
        return evalExpression(e, properties);
    }
    var tx = translation.x;
    var ty = translation.y;
    var tz = 0.0;
    if (point.length >= 3) {
        tz += point[2] + translation.z;
    }
    var xx = point[0] + tx;
    var yy = point[1] + ty;
    if ( xx < tile.bbox[0] || xx > tile.bbox[2] || yy < tile.bbox[1] || yy > tile.bbox[3] ) {
        return res;
    }
    var s = ee(symbology.size) / 2.0;   

    if ( symbology.draping ) {
        var zOffset = (ee(symbology.zOffsetPercent) * tile.size || 0)
            + (ee(symbology.zOffset) || 0);
        tz = gridAltitude( xx, yy, tile ) + zOffset + s;
    }

    var shape = ee(symbology.shape);
    if ( shape === 'cube' ) {
        res.geometry.position = [ point[0] + tx - s, point[1] + ty - s, tz -s,
                                  point[0] + tx + s, point[1] + ty - s, tz -s,
                                  point[0] + tx + s, point[1] + ty + s, tz -s,
                                  point[0] + tx - s, point[1] + ty + s, tz -s,
                                  point[0] + tx - s, point[1] + ty - s, tz +s,
                                  point[0] + tx + s, point[1] + ty - s, tz +s,
                                  point[0] + tx + s, point[1] + ty + s, tz +s,
                                  point[0] + tx - s, point[1] + ty + s, tz +s ];
    }
    else if ( shape === 'bar' ) {
        var h = ee(symbology.height)|0;
        res.geometry.position = [ point[0] + tx - s, point[1] + ty - s, tz,
                                  point[0] + tx + s, point[1] + ty - s, tz,
                                  point[0] + tx + s, point[1] + ty + s, tz,
                                  point[0] + tx - s, point[1] + ty + s, tz,
                                  point[0] + tx - s, point[1] + ty - s, tz + h,
                                  point[0] + tx + s, point[1] + ty - s, tz + h,
                                  point[0] + tx + s, point[1] + ty + s, tz + h,
                                  point[0] + tx - s, point[1] + ty + s, tz + h ];
    }
    else {
        throw "Unrecognized shape for point " + shape;
    }

    // triangles
    res.geometry.index = [ 0, 2, 1, // front
                           0, 3, 2,
                           1, 2, 5, // right
                           2, 6, 5,
                           0, 1, 4, // top
                           4, 1, 5,
                           5, 7, 4, // back
                           5, 6, 7,
                           0, 4, 7, // left
                           0, 7, 3,
                           3, 6, 2, // bottom
                           3, 7, 6
                         ];
    var c = toRGB(ee(symbology.polygon.color));

    res.geometry.color = [];
    res.geometry.gidMap = [];

    for (var i=0; i<res.geometry.position.length; i+=3){
        res.geometry.color.push( c.r, c.g, c.b );
        res.geometry.gidMap.push(+properties.gid);
    }

    return res;
}


onmessage = function(o) {
    var data = o.data.data;
    var ctxt = o.data.ctxt;
    var tileId = o.data.tileId;
    var workerId = o.data.workerId;

    // timers
    var T = {
        global: new Timer(),
        clip: new Timer(),
        convert: new Timer(),
        extrusion: new Timer(),
        p2t: new Timer(),
        contours: new Timer(),
        uv: new Timer(),
        zOffset: new Timer(),
        lines: new Timer(),
        map: new Timer(),
        color: new Timer(),
        merge: new Timer(),
        triangulation: new Timer()
    };
    
    T['global'].start();

    var res = new PolygonGeometries();
    var tile = new Tile( ctxt.center, ctxt.size, ctxt.nbIntervals, ctxt.gridVertices );

    try {
        data.features.forEach( function(feat) {
            switch ( feat.geometry.type ) {
            case "Point": {
                var r = processPoint( feat.geometry.coordinates, feat.properties, tile, ctxt.translation, ctxt.symbology );
                res.merge(r);
            }
                break;
            case "MultiPolygon": {
                feat.geometry.coordinates.forEach( function(poly){
                    var r = processPolygon(poly, feat.geometry.bbox, feat.properties, tile, ctxt.translation, ctxt.symbology, T);
                    T['merge'].start();
                    res.merge( r );
                    T['merge'].stop();
                });
            }
                break;
            case "Polygon": {
                var r = processPolygon( feat.geometry.coordinates, feat.geometry.bbox, feat.properties, tile, ctxt.translation, ctxt.symbology, T );
                res.merge(r);
            }
                break;
            default:
                throw "Unsupported geometry type " + feat.geometry.type;
            }
        });
    }
    catch (err)
    {
        postMessage({error:err, workerId:workerId, tileId:tileId});
        return;
    }

    T['convert'].start();
    var trGeom = res.geometry.bufferGeometry();
    trGeom.computeVertexNormals();
    trGeom.computeTangents();
    
    var trWallGeom = res.wallGeometry.bufferGeometry();
    trWallGeom.computeVertexNormals();
    trWallGeom.computeTangents();

    var trLineGeom = res.lineGeometry.bufferGeometry();

    var trErrGeom = res.errGeometry.bufferGeometry();
    
    var trErrSpotGeom = res.errSpotGeometry.bufferGeometry();

    var trGidMap = new Int32Array( res.geometry.gidMap );
    var trGidMapWall = new Int32Array( res.wallGeometry.gidMap );
    T['convert'].stop();

    T['global'].stop();
    var s = '';
    for ( var t in T ) {
        s += ' ' + t + ': ' + T[t].get();
    }
    console.log('Timing ' + s );
    postMessage( { geom:trGeom, lineGeom:trLineGeom, errGeom:trErrGeom, errSpotGeom:trErrSpotGeom, wallGeom:trWallGeom, gidMap:trGidMap, gidMapWall:trGidMapWall, tileId: tileId, sendDate: new Date().getTime(), workerId: workerId }, 
            trGeom.attributes.position.array.length ? [
            trGeom.attributes.position.array.buffer, 
            trGeom.attributes.index.array.buffer,
            trGeom.attributes.color.array.buffer,
            trGeom.attributes.normal.array.buffer,
            trGeom.attributes.uv.array.buffer,
            trGidMap.buffer,
            trGidMapWall.buffer,
            trLineGeom.attributes.position.array.buffer, 
            ] : []);
}
