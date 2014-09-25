//
// Example 2
// Simple scene with a terrain layer and some vector data
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
var symbology = {
    zOffset:4,
    polygon: { color: 0x0000ff } // <- blue
};
var roofs = new cuardo.WfsLayer(
    roofsUrl,
    terrain, // <- reference to the terrain layer (for elevation)
    symbology
);

var map = new cuardo.Map('container', [terrain, ortho, roofs], sceneSize, 0);

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

