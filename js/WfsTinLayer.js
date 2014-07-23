// deals only with triagulated 3D surfaces
//
WfsTinLayer = function (url, translation, nbIntervals, terrain) {
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



WfsTinLayer.prototype.tile = function( center, size, tileId, callback ) {
    var extentCenter = new THREE.Vector3().subVectors(center, this.translation );
    var ext = [extentCenter.x - size*.5,
               extentCenter.y - size*.5,
               extentCenter.x + size*.5,
               extentCenter.y + size*.5];

    var object = this;

    console.log(this.url + '&BBOX='+ext.join(','));
    jQuery.ajax(this.url + '&BBOX='+ext.join(','), {
        success: function(data, textStatus, jqXHR) {
            var geom = new THREE.Geometry();
            var nbPoly = 0;
            var group = new THREE.Object3D();
            data.features.forEach( function(feat) {

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
                        geom.vertices.push( new THREE.Vector3(tri[0][t][0]+translation.x, 
                                                              tri[0][t][1]+translation.y,
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
