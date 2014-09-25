cuardo.translation = new THREE.Vector3(-1844098.1,-5174884.2, -150);
// tile size of the most detailed tile
// the sceneSize will be computed from this value
var MT = 700;

var urlDem = "/mapcache?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetMap&WIDTH=256&HEIGHT=256&LAYERS=mnt&STYLES=&FORMAT=image/jpeg&SRS=EPSG:3946&TILED=true&TRANSPARENT=TRUE"
var urlTex = "/mapcache?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetMap&WIDTH=1024&HEIGHT=1024&LAYERS=ortho&STYLES=&FORMAT=image/jpeg&SRS=EPSG:3946&TILED=true&TRANSPARENT=TRUE"
var urlPlan = "/mapcache?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetMap&WIDTH=1024&HEIGHT=1024&LAYERS=plan&STYLES=&FORMAT=image/jpeg&SRS=EPSG:3946&TILED=true&TRANSPARENT=TRUE"
var urlNO2 = "/mapcache?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetMap&WIDTH=1024&HEIGHT=1024&LAYERS=no2&STYLES=&FORMAT=image/jpeg&SRS=EPSG:3946&TILED=true&TRANSPARENT=TRUE"
var urlImageBase = "/w/textures/";
var baseUrl = "/cgi-bin/tinyows?SERVICE=WFS&VERSION=1.0.0&REQUEST=GetFeature&outputFormat=JSON";

// Lyon 3
var terrain = new cuardo.Terrain(urlDem, cuardo.translation);
var ortho = new cuardo.RasterLayer(urlTex, terrain);
var no2 = new cuardo.RasterLayer(urlNO2, terrain);

var urlArrond = baseUrl+"&typeName=tows:arrondissements";
var colFun = function(properties){
    switch( +properties.gid ){
    case 1: return cuardo.rgbToInt({r:.2, g:.9, b:1});
    case 2: return cuardo.rgbToInt({r:3, g:.2, b:.8});
    case 3: return cuardo.rgbToInt({r:0, g:.5, b:.8});
    case 7: return cuardo.rgbToInt({r:.2, g:.2, b:1});
    case 9: return cuardo.rgbToInt({r:1, g:.2, b:.2});
    }
    return 0xffffff;
};


var arrond = new cuardo.WfsLayer(urlArrond, terrain,
                          {zOffsetPercent:1e-3,
                           zOffset:3,
                           draping:true,
                           polygon:{
                               lineColor:0x3B0B2E,
                               lineWidth:10,
                               color: {expression: colFun.toString() },
                               opacity:.3
                           }
                          }
                        , [MT<<2,MT<<8]  // <- visibility range
                         );

//
// Color function, based on the 'hfacade' property
var buildingClass = function (prop) {
    var r = prop.no2_red;
    var g = prop.no2_green;
    var b = prop.no2_blue;
    return ((r & 0xff) << 16) + ((g & 0xff) << 8) + (b & 0xff);
         //| (prop.no2_green/255)*0x00ff00
         //| (prop.no2_blue/255)*0x0000ff;
}


var lod4_url = baseUrl+"&typeName=tows:roofs";
var lod4 = new cuardo.WfsLayer(lod4_url, terrain,
                        { zOffsetPercent:2e-3,
                          zOffset:10,
                          polygon:
                          {
                              color: {expression: buildingClass.toString() }
                          }
                        }
                        , [MT<<2,MT<<3]  // <- visibility range
                       );


var lod5_url = baseUrl+"&typeName=tows:roofs";
var lod5 = new cuardo.WfsLayer(lod5_url, terrain,
                        {polygon:{
                            extrude: {property: 'hfacade'}, 
                            color: {expression: buildingClass.toString() }
                        }
                        }
                        , [MT<<1, MT<<2]
                       );

var urlTin = baseUrl+"&typeName=tows:textured_citygml";
var tin = new cuardo.WfsTinLayer( urlTin, urlImageBase, terrain, [0, MT<<1] );


var bati = new cuardo.LayerSet([lod4,lod5, tin]);

// scene size 
var sceneSize = MT<<4;

// max depth of the quad tree
var maxLOD = 6;

var map = new cuardo.Map('container', [terrain, ortho, no2, arrond, bati], sceneSize, maxLOD);

// add menu to toggle layer visibility
var layerVisibilityControls = new cuardo.LayerVisibilityControl('layerList', map.requestRender);
layerVisibilityControls.add("Terrain", terrain);
layerVisibilityControls.add("OrthoPhoto", ortho);
layerVisibilityControls.add("NO2", no2);
layerVisibilityControls.add("Arrondissements", arrond);
layerVisibilityControls.add("Bati", bati);

// add progress bar
var progress = new cuardo.ProgressBarControl('progressInfo', notification);

// add camera controler
var controls = new cuardo.GISControls(map.camera, null, map.target );
controls.maxDistance = sceneSize * 10;
controls.addEventListener('change', map.requestRender );

map.animate();


