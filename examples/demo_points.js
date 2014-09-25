function getConfig()
{
    //
    // Tilers configurations
    //

    var urlDem = "/mapcache?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetMap&WIDTH=256&HEIGHT=256&LAYERS=mnt&STYLES=&FORMAT=image/jpeg&SRS=EPSG:3946&TILED=true&TRANSPARENT=TRUE"
    var urlTex = "/mapcache?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetMap&WIDTH=1024&HEIGHT=1024&LAYERS=ortho&STYLES=&FORMAT=image/jpeg&SRS=EPSG:3946&TILED=true&TRANSPARENT=TRUE"
    var urlImageBase = "/w/textures/appearance";

    var baseUrl = "/cgi-bin/tinyows?SERVICE=WFS&VERSION=1.0.0&REQUEST=GetFeature&outputFormat=JSON";
    // Lyon 3
    cuardo.translation = new THREE.Vector3(-1844098.1,-5174884.2, -150);
    var terrain = new cuardo.Terrain(urlDem, cuardo.translation, 32);
    var ortho = new cuardo.RasterLayer(urlTex, terrain);

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
                                   color: {expression: colFun.toString()},
                                   opacity:.3
                               }
                              }
                             );

    var velov_url = baseUrl+"&typeName=tows:velov_stations";
    var velov1 = new cuardo.WfsLayer(velov_url, terrain,
                            {
                                zOffsetPercent:1e-3,
                                zOffset:3,
                                draping: true,
                                shape: 'bar',
                                size: { property: 'bike_stand' },
                                height: { expression: 'function(p){return p.available_ * 10.0;}' },
                                polygon:{
                                    color: 0x0000ff,
                                    opacity: 0.5
                                }
                            });
    var velov2 = new cuardo.WfsLayer(velov_url, terrain,
                              {
                                  zOffsetPercent:1e-3,
                                  zOffset:{ expression: 'function(p){return p.available_ * 10.0 + 3;}' },
                                  draping: true,
                                  shape: 'bar',
                                  size: { property: 'bike_stand' },
                                  height: { expression: 'function(p){return (p.bike_stand-p.available_) * 10.0;}' },
                                  polygon:{
                                      color: 0xff0000,
                                      opacity: 0.5
                                  }
                              });

    var velov = new cuardo.LayerSet([velov1, velov2]);
    // List of layers with tilers
    var layers = [{name:'Terrain', layer:terrain},
                  {name:'OrthoPhoto', layer:ortho},
                  {name:'Arrondissements', layer:arrond},
                  {name:"Dispo Velo'V", layer:velov}
                 ];

    //
    // Actions on identify
    var actions = [
        {
            name: "Identify", 
            action: function(layer, gid, position) {
                if (layer != velov1 && layer != velov2 && layer != arrond) return false;
                var props = layer.getFeature(gid);
                var html = '<table>';
                for ( var k in props ) {
                    html += '<tr><td>' + k + '</td><td>' + props[k] + "</td></tr>\n";
                }
                html += '</table>';
                createPopin(html, position);
                return true;
            }
        },
        {
            name: "Infos arrondissement", 
            action: function(layer, gid, position) {
                if (layer != arrond) return false;
               var props = layer.getFeature(gid);
               var n = props.nomreduit.substring(5);
               window.open("http://fr.wikipedia.org/wiki/" 
                    +(n == 1 ? '1er' : n+'e')+'_arrondissement_de_Lyon');
               return true;
            }
         }
        ];

    // scene size 
    var sceneSize = 16000;

    // max depth of the quad tree
    var maxLOD = 3;

    return {
        layers:layers,
        translation:cuardo.translation,
        sceneSize:sceneSize,
        maxLOD:maxLOD,
        actions:actions
    };
}

