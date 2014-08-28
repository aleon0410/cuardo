function getConfig()
{
    //
    // Tilers configurations
    //

    var nbDiv = 32;
    var domain = document.location.host;
    var urlDem = "http://" + domain + "/mapcache?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetMap&WIDTH=256&HEIGHT=256&LAYERS=mnt&STYLES=&FORMAT=image/jpeg&SRS=EPSG:3946&TILED=true&TRANSPARENT=TRUE"
    var urlTex = "http://" + domain + "/mapcache?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetMap&WIDTH=1024&HEIGHT=1024&LAYERS=ortho&STYLES=&FORMAT=image/jpeg&SRS=EPSG:3946&TILED=true&TRANSPARENT=TRUE"
    var urlImageBase = "http://" + domain + "/textures/LYON_3_Appearance/";

    var baseUrl = "http://" + domain + "/cgi-bin/tinyows.fcgi?SERVICE=WFS&VERSION=1.0.0&REQUEST=GetFeature&outputFormat=JSON";
    // Lyon 3
    var translation = new THREE.Vector3(-1844098.1,-5174884.2, -150);
    var terrain = new Terrain(urlDem, urlTex, translation, nbDiv);

    var urlArrond = baseUrl+"&typeName=tows:arrondissements";
    var colFun = function(properties){
        switch( +properties.gid ){
        case 1: return {r:.2, g:.9, b:1};
        case 2: return {r:3, g:.2, b:.8};
        case 3: return {r:0, g:.5, b:.8};
        case 7: return {r:.2, g:.2, b:1};
        case 9: return {r:1, g:.2, b:.2};
        }
        return {r:1, g:1, b:1};
    };

    var arrond = new WfsLayer(urlArrond, translation, nbDiv, terrain,
                              {zOffsetPercent:1e-3,
                               zOffset:3,
                               draping:true,
                               polygon:{
                                   color:0xffffff,
                                   lineColor:0x3B0B2E,
                                   lineWidth:10,
                                   colorFun:colFun.toString(),
                                   opacity:.3
                               }
                              }
                             );


    var velov_url = baseUrl+"&typeName=tows:velov";
    var velov = new WfsLayer(velov_url, translation, nbDiv, terrain,
                            {
                                zOffsetPercent:1e-3,
                                zOffset:3,
                                draping: true,
                                shape: 'bar',
                                size: { property: 'bike_stand' },
                                height: { expression: 'function(p){return p.available_ * 10.0;}' },
                                polygon:{
                                    color: 0xaaaaff,
                                    opacity: 1
                                }
                            });
    var velov2 = new WfsLayer(velov_url, translation, nbDiv, terrain,
                              {
                                  zOffsetPercent:1e-3,
                                  zOffset:{ expression: 'function(p){return p.available_ * 10.0 + 3;}' },
                                  draping: true,
                                  shape: 'bar',
                                  size: { property: 'bike_stand' },
                                  height: { expression: 'function(p){return (p.bike_stand-p.available_) * 10.0;}' },
                                  polygon:{
                                      color: 0xffaaaa,
                                      opacity: 1
                                  }
                              });

    //
    // List of layers with tilers
    var layers = [{name:'Terrain', levels:[terrain]},
                  {name:'Arrondissements', levels:[arrond]},
                  {name:"Dispo Velo'V", levels:[velov, velov2]}];

    // scene size 
    var sceneSize = 16000;

    // max depth of the quad tree
    var maxLOD = 3;

    return {
        layers:layers,
        translation:translation,
        sceneSize:sceneSize,
        maxLOD:maxLOD
    };
}

