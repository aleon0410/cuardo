function getConfig()
{
    //
    // Tilers configurations
    //

    var nbDiv = 32;
    var urlDem = "/mapcache?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetMap&WIDTH=256&HEIGHT=256&LAYERS=mnt&STYLES=&FORMAT=image/jpeg&SRS=EPSG:3946&TILED=true&TRANSPARENT=TRUE"
    var urlTex = "/mapcache?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetMap&WIDTH=1024&HEIGHT=1024&LAYERS=ortho&STYLES=&FORMAT=image/jpeg&SRS=EPSG:3946&TILED=true&TRANSPARENT=TRUE"
    var urlPlan = "/mapcache?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetMap&WIDTH=1024&HEIGHT=1024&LAYERS=plan&STYLES=&FORMAT=image/jpeg&SRS=EPSG:3946&TILED=true&TRANSPARENT=TRUE"
    var urlNO2 = "/mapcache?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetMap&WIDTH=1024&HEIGHT=1024&LAYERS=no2&STYLES=&FORMAT=image/jpeg&SRS=EPSG:3946&TILED=true&TRANSPARENT=TRUE"
    var urlImageBase = "/w/textures/";

    var baseUrl = "/cgi-bin/tinyows?SERVICE=WFS&VERSION=1.0.0&REQUEST=GetFeature&outputFormat=JSON";
    // Lyon 3
    cuardo.translation = new THREE.Vector3(-1844098.1,-5174884.2, -150);
    var terrain = new cuardo.Terrain(urlDem, cuardo.translation, nbDiv);

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

    // tile size of the most detailed tile
    var MT = 700;

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
        var categories = [{min: 2.0,  max: 2.74, color:0xffffff},
                          {min: 2.74, max: 4.27, color:0xafd1e7},
                          {min: 4.27, max: 20.74, color:0x3d8dc3},
                          {min: 20.74, max: 200,  color:0x08306b}];
        for ( var i = 0; i < categories.length; i++ ) {
            var klass = categories[i];
            if ( (prop.hfacade >= klass.min) && (prop.hfacade < klass.max) ) {
                return klass.color;
            }
        }
        return 0x000000;
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

    //
    // List of layers with tilers
    var layers = [{name:'Terrain', levels:[terrain]},
                  {name:'OrthoPhoto', levels:[ortho]},
                  {name:'NO2', levels:[no2]},
                  {name:'Arrondissements', levels:[arrond]},
                  {name:'Bati', levels:[new cuardo.LayerSet([lod4,lod5, tin])]}
];

    // scene size 
    var sceneSize = MT<<4;

    // max depth of the quad tree
    var maxLOD = 6;

    return {
        layers:layers,
        translation:cuardo.translation,
        sceneSize:sceneSize,
        maxLOD:maxLOD
    };
}

