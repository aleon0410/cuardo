function getConfig()
{
    //
    // Tilers configurations
    //

    var nbDiv = 32;
    var domain = document.location.host;
    var urlDem = "http://" + domain + "/mapcache?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetMap&WIDTH=256&HEIGHT=256&LAYERS=mnt&STYLES=&FORMAT=image/png&SRS=EPSG:3946&TILED=true&TRANSPARENT=TRUE"
    var urlTex = "http://" + domain + "/mapcache?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetMap&WIDTH=1024&HEIGHT=1024&LAYERS=ortho&STYLES=&FORMAT=image/png&SRS=EPSG:3946&TILED=true&TRANSPARENT=TRUE"
    var urlImageBase = "http://" + domain + "/textures/LYON_3_Appearance/";

    var baseUrl = "http://" + domain + "/cgi-bin/tinyows.fcgi?SERVICE=WFS&VERSION=1.0.0&REQUEST=GetFeature&outputFormat=JSON";
    // Lyon 3
    var translation = new THREE.Vector3(-1844098.1,-5174884.2, -150);
    var terrain = new Terrain(urlDem, urlTex, translation, nbDiv);

    var urlArrond = baseUrl+"&typeName=tows:arrondissements";
    var colFun = 
        'function(properties){ '+
        'switch( +properties.gid ){ '+
        'case 7: return {r:.2, g:.2, b:1}; '+
        'case 9: return {r:1, g:.2, b:.2}; '+
        '} ' +
        'return 0xaaaaaa; '+ 
        '}';

    var colFun = 'function(prop){ return { r:prop.gid/10.0, g:.5, b:.5 }; }';
    var arrond = new WfsLayer(urlArrond, translation, nbDiv, terrain,
                              {zOffsetPercent:1e-3,
                               zOffset:3,
                               draping:true,
                               polygon:{
                                   color:0xffffff,
                                   lineColor:0xff0000,
                                   lineWidth:2,
                                   colorFun:colFun,
                                   opacity:.2
                               }
                              }
                            , [500,4000]  // <- visibility range
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
                return {r:(klass.color>>16)/256.0, g:((klass.color>>8)&0xff)/256.0, b:(klass.color&0xff)/256.0};
            }
        }
        return {r:0, g:0, b:0};
    }

    var lod0_url = baseUrl+"&typeName=tows:toitures";
    var lod0 = new WfsLayer(lod0_url, translation, nbDiv, terrain,
                            { zOffsetPercent:2e-3,
                              zOffset:10,
                              polygon:
                              {
                                  color:0xaaaaaa,
                                  colorFun:buildingClass.toString()
                              }
                            }
                            , [1000,2000]  // <- visibility range
                           );


    var lod1_url = baseUrl+"&typeName=tows:toitures";
    var lod1 = new WfsLayer(lod1_url, translation, nbDiv, terrain,
                            {polygon:{
                                color:0xffffff,
                                extrude:'hfacade',
                                color:0xaaaaaa,
                                colorFun:buildingClass.toString()
                            }
                            }
                            , [500, 1000] );

    var urlTin = baseUrl+"&typeName=tows:textured_citygml";
    var tin = new WfsTinLayer( urlTin, urlImageBase, translation, 32, terrain, [0,500] );

    //
    // List of layers with tilers
    var layers = [{name:'Terrain', levels:[terrain]},
                  {name:'Arrondissements', levels:[arrond]},
                  {name:'Bati', levels:[lod0,lod1,tin]}];

    // scene size 
    var sceneSize = 16000;

    // max depth of the quad tree
    var maxLOD = 7;

    return {
        layers:layers,
        translation:translation,
        sceneSize:sceneSize,
        maxLOD:maxLOD
    };
}

