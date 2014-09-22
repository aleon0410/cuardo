//
// Example 1
// Simple scene with a terrain layer
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
        [
            {url:urlTex, name:'Ortho photo'} // <- URL and name of the texture
        ],
        cuardo.translation,
        nbDiv
    );

    //
    // List of layers for the UI
    var layers = [
        {
            name:'Terrain',
            levels:[terrain]
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

