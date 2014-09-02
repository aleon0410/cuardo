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

    // tile size of the most detailed tile
    var MT = 700;

    var urlTin = baseUrl+"&typeName=tows:textured_citygml";
    var tin = new WfsTinLayer( urlTin, urlImageBase, translation, 32, terrain, [0, MT<<1] );

    //
    // List of layers with tilers
    var layers = [{name:'Terrain', levels:[terrain]},
                  {name:'Bati', levels:[tin]}
];

    // scene size 
    var sceneSize = MT<<1;

    // max depth of the quad tree
    var maxLOD = 2;

    return {
        layers:layers,
        translation:translation,
        sceneSize:sceneSize,
        maxLOD:maxLOD
    };
}

