//
// Example 2
// Simple scene with a terrain layer,
// some 2D and 3D vector data with different LODs
//

// global translation of the scene
// -150 : average elevation
cuardo.translation = new THREE.Vector3(-1844157, -5175424, -150);
var sceneSize = 1500;

var urlDem = "/mapcache?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetMap&WIDTH=256&HEIGHT=256&LAYERS=mnt&STYLES=&FORMAT=image/jpeg&SRS=EPSG:3946&TILED=true&TRANSPARENT=TRUE";
var terrain = new cuardo.Terrain(urlDem, cuardo.translation);

var urlTex = "/mapcache?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetMap&WIDTH=1024&HEIGHT=1024&LAYERS=ortho&STYLES=&FORMAT=image/jpeg&SRS=EPSG:3946&TILED=true&TRANSPARENT=TRUE";
var ortho = new cuardo.RasterLayer(urlTex, terrain);

var roofsUrl = "/cgi-bin/tinyows?SERVICE=WFS&VERSION=1.0.0&REQUEST=GetFeature&outputFormat=JSON&typeName=tows:roofs";

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

var filledSymbology = {
    zOffsetPercent:1e-3,
    zOffset:0.5,
    polygon:
    {
        color: { expression: buildingClass.toString() },
        lineColor: 0x000000,
        lineWidth: 3
    }
};

// use the "hfacade" property as height to extrude polygons
var extrudedSymbology = {
    zOffsetPercent:2e-3, // Z fighting
    zOffset:0.5,
    polygon:
    {
        extrude: { property: "hfacade" },
        color: { expression: buildingClass.toString() }
    }
};

var filled = new cuardo.WfsLayer(
    roofsUrl,
    terrain, // <- reference to the terrain layer (for elevation)
    filledSymbology,
    [sceneSize/2+1,10000] // <- visibility range
);

var extruded = new cuardo.WfsLayer(
    roofsUrl,
    terrain, // <- reference to the terrain layer (for elevation)
    extrudedSymbology,
    [0,sceneSize/2+1] // <- visibility range
);

var roofs = new cuardo.LayerSet([filled, extruded]);

var maxLOD = 2;
var map = new cuardo.Map('container', [terrain, ortho, roofs], sceneSize, maxLOD);

// add menu to toggle layer visibility
var layerVisibilityControls = new cuardo.LayerVisibilityControl('layerList', map.requestRender);
layerVisibilityControls.add("Terrain", terrain);
layerVisibilityControls.add("OrthoPhoto", ortho);
layerVisibilityControls.add("Roofs", roofs);

// add progress bar
var progress = new cuardo.ProgressBarControl('progressInfo', notification);

// add camera controler
var controls = new cuardo.GISControls(map.camera, null, map.target );
controls.maxDistance = sceneSize * 10;
controls.addEventListener('change', map.requestRender );

map.animate();


