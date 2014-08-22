// deals only with triagulated 3D surfaces
//
WfsTinLayer = function (url, translation, nbIntervals, terrain, range) {
    this.url = url;
    this.translation = translation;
    this.nbIntervals = nbIntervals || 8;
    this.extent = [];
    this.srid = 0;
    this.terrain = terrain || null;

    // size range for which this tile is visible
    this.range = range || [0,1000000];

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



WfsTinLayer.prototype.tile = function( center, size, tileId, callback ) {
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

    var bboxTile = [center.x - .5*size,
                    center.y - .5*size,
                    center.x + .5*size,
                    center.y + .5*size];

    var object = this;

    console.log(this.url + '&BBOX='+ext.join(','));
    jQuery.ajax(this.url + '&BBOX='+ext.join(','), {
        success: function(data, textStatus, jqXHR) {
            var nbPoly = 0;
            var group = new THREE.Object3D();
            data.features.forEach( function(feat) {

                var bboxCenter = feat.geometry.bbox.length == 4 ? 
                    {
                        x: ( (+feat.geometry.bbox[0]) 
                             + (+feat.geometry.bbox[2]) )*.5 + object.translation.x,
                        y: ( (+feat.geometry.bbox[1]) 
                                + (+feat.geometry.bbox[3]) )*.5 +object.translation.y 
                    }
                    :
                    {
                        x: ( (+feat.geometry.bbox[0]) 
                             + (+feat.geometry.bbox[3]) )*.5 + object.translation.x,
                        y: ( (+feat.geometry.bbox[1]) 
                                + (+feat.geometry.bbox[4]) )*.5 +object.translation.y 
                    };
                if ( bboxCenter.x <= bboxTile[0]
                  || bboxCenter.y <= bboxTile[1]
                  || bboxCenter.x > bboxTile[2]
                  || bboxCenter.y > bboxTile[3] ) return; // feature will be included by another tile
                /*
                var xmin = feat.geometry.bbox[3];
                var ymin = feat.geometry.bbox[4];
                if ( (feat.geometry.bbox[3] > ext[2]) || (feat.geometry.bbox[4] > ext[3]) ) {
                    // only keep objects inside the extent
                    // and on the left and bottom border of the tile
                    return;
                }
                */

                var geom = new THREE.Geometry();

                var tex;
                var material;
                // parse because tiny ouput is not json for custom types
                if (feat.properties.tex) {

                    var texRe = /\((.*),"(.*)"\)/;
                    var texP = texRe.exec(feat.properties.tex);

                    tex = {url:texP[1],
                        uv:JSON.parse(texP[2].replace("{","[","g").replace("}","]","g"))};
                    material = new THREE.MeshLambertMaterial({
                            map: THREE.ImageUtils.loadTexture(tex.url)
                        });
                }
                else {
                    material =  new THREE.MeshLambertMaterial( 
                        { color:0x00ff00, ambient:0x00ff00, wireframe:true } );
                }

                var i = geom.vertices.length;
                var j = 0;
                feat.geometry.coordinates.forEach( function(tri) {
                    var uv = [];
                    for (var t=0; t<3; t++) {
                        geom.vertices.push( new THREE.Vector3(tri[0][t][0]+object.translation.x, 
                                                              tri[0][t][1]+object.translation.y,
                                                              tri[0][t][2]) );
                        if (tex) uv.push( new THREE.Vector2(tex.uv[j+t][0], tex.uv[j+t][1]) );
                        else uv.push( new THREE.Vector2(0, 0) );
                    }
                    geom.faces.push( new THREE.Face3(i, i+1, i+2) );
                    geom.faceVertexUvs[ 0 ].push(uv);
                    i+=3;
                    j+=4; // postgis triangles have 4 vertices :)
                });


                geom.computeBoundingBox();
                geom.computeFaceNormals();
                geom.computeVertexNormals();
                geom.computeTangents();

                group.add(new THREE.Mesh( geom, material ));
            });

            
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
