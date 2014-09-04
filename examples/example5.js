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
    var baseUrl = "/cgi-bin/tinyows.fcgi?SERVICE=WFS&VERSION=1.0.0&REQUEST=GetFeature&outputFormat=JSON";
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

    var roofs = new WfsLayer(
        roofsUrl,
        translation,
        nbDiv,
        terrain,
        {
            zOffsetPercent:2e-3,
            zOffset:10,
            polygon:
            {
                color: { expression: buildingClass.toString() },
                lineColor: 0x000000,
                lineWidth: 3
            }
        },
        [sceneSize/2+1,10000] // <- visibility range
    );


    // use the "hfacade" property as height to extrude polygons
    var symbologyExtruded = {
        zOffsetPercent:2e-3,
        zOffset:10,
        polygon:
        {
            extrude: { property: "hfacade" },
            color: { expression: buildingClass.toString() }
        }
    };
    var extruded = new WfsLayer(
        roofsUrl,
        translation,
        nbDiv,
        terrain,
        {
            zOffsetPercent:2e-3,
            zOffset:10,
            polygon:
            {
                extrude: { property: "hfacade" },
                color: { expression: buildingClass.toString() }
            }
        },
        [sceneSize/4+1,sceneSize/2+1] // <- visibility range
    );

    //
    // textured TIN layer
    var urlTin = baseUrl+"&typeName=tows:textured_citygml";
    // base url where to find textures
    var urlImageBase = "/textures/LYON_3_Appearance/";
    
    var tin = new WfsTinLayer(
        urlTin,
        urlImageBase,
        translation,
        nbDiv,
        terrain,
        [0, sceneSize/4+1]
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
            levels:[roofs, extruded] // <- LODs
        },
        {
            name:'Buildings',
            levels:[tin]
        }
    ];

    // max depth of the quad tree
    // 2^maxLOD subdivisions
    // increase to have better quality when zooming in
    var maxLOD = 2;

    return {
        layers:layers,
        translation:translation,
        sceneSize:sceneSize,
        maxLOD:maxLOD
    };
}

