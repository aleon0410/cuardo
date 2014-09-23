//
// Example 2
// Simple scene with a terrain layer,
// with some textured 3D data
//

function getConfig()
{
    // small extent
    var extent = [1843456.5,5174649.5,1844858.1,5175600.3];

    // "medium" extent
    //var extent = [1841372.1, 5174640.0, 1844890.8, 5176327.0];

    var width = extent[2]-extent[0];
    var height = extent[3]-extent[1];
    var sceneSize = Math.max(width,height) | 0;
    console.log(sceneSize);

    var center = [(extent[2]+extent[0])/2, (extent[3]+extent[1])/2];
    console.log(center);

    // number of terrain subdivisions, per terrain tile
    // i.e. number of sampling points for the DEM
    var nbDiv = 32;

    var urlDem = "/mapcache?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetMap&WIDTH=256&HEIGHT=256&LAYERS=mnt&STYLES=&FORMAT=image/jpeg&SRS=EPSG:3946&TILED=true&TRANSPARENT=TRUE"
    var urlTex = "/mapcache?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetMap&WIDTH=1024&HEIGHT=1024&LAYERS=ortho&STYLES=&FORMAT=image/jpeg&SRS=EPSG:3946&TILED=true&TRANSPARENT=TRUE"

    // global translation of the scene
    // -150 : average elevation
    cuardo.translation = new THREE.Vector3(-center[0], -center[1], -150);

    // the terrain layer
    var terrain = new cuardo.Terrain(
        urlDem,   // <- URL of the DEM
        cuardo.translation,
        nbDiv
    );

    // the othophoto tu put on top of the terrain
    var ortho = new cuardo.RasterLayer(urlTex, terrain);

    // base url of the WFS server
    var baseUrl = "/cgi-bin/tinyows?SERVICE=WFS&VERSION=1.0.0&REQUEST=GetFeature&outputFormat=JSON";

    //
    // textured TIN layer
    var urlTin = baseUrl+"&typeName=tows:textured_citygml";
    // base url where to find textures
    var urlImageBase = "/w/textures/";
    
    var tin = new cuardo.WfsTinLayer(
        urlTin,
        urlImageBase,
        cuardo.translation,
        nbDiv,
        terrain
    );
    
    //
    // List of layers for the UI
    var layers = [
        {
            name:'Terrain',
            levels:[terrain]
        },
        {
            name:'OrthoPhoto',
            levels:[ortho]
        },
        {
            name:'Buildings',
            levels:[tin]
        }
    ];

    // max depth of the quad tree
    // 2^maxLOD subdivisions
    // increase to have better quality when zooming in
    var maxLOD = 0;

    return {
        layers:layers,
        translation:cuardo.translation,
        sceneSize:sceneSize,
        maxLOD:maxLOD
    };
}

