//
// Example 2
// Simple scene with a terrain layer and some 3D vector data
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
    var translation = new THREE.Vector3(-center[0], -center[1], -150);

    // the terrain layer
    var terrain = new Terrain(
        urlDem,   // <- URL of the DEM
        [
            {url:urlTex, name:'Ortho photo'} // <- URL and name of the texture
        ],
        translation,
        nbDiv
    );

    // base url of the WFS server
    var baseUrl = "/cgi-bin/tinyows?SERVICE=WFS&VERSION=1.0.0&REQUEST=GetFeature&outputFormat=JSON";
    var roofsUrl = baseUrl+"&typeName=tows:toitures";

    // filling color based on a function
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

    // use the "hfacade" property as height to extrude polygons
    var symbology = {
        zOffsetPercent:2e-3, // Z fighting
        zOffset:0.5,
        polygon:
        {
            extrude: { property: "hfacade" },
            color: { expression: buildingClass.toString() }
        }
    };

    var roofs = new WfsLayer(
        roofsUrl,
        translation,
        nbDiv,
        terrain, // <- reference to the terrain layer (for elevation)
        symbology
    );
    
    //
    // List of layers for the UI
    var layers = [
        {
            name:'Terrain',
            levels:[terrain]
        },
        {
            name:'Roofs',
            levels:[roofs]
        }
    ];

    // max depth of the quad tree
    // 2^maxLOD subdivisions
    // increase to have better quality when zooming in
    var maxLOD = 0;

    return {
        layers:layers,
        translation:translation,
        sceneSize:sceneSize,
        maxLOD:maxLOD
    };
}

