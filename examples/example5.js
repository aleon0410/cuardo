//
// Example 2
// Simple scene with a terrain layer,
// with some textured 3D data
//

// global translation of the scene
// -150 : average elevation
cuardo.translation = new THREE.Vector3(-1844157, -5175424, -150);
var sceneSize = 1500;

var urlDem = "/mapcache?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetMap&WIDTH=256&HEIGHT=256&LAYERS=mnt&STYLES=&FORMAT=image/jpeg&SRS=EPSG:3946&TILED=true&TRANSPARENT=TRUE";
var terrain = new cuardo.Terrain(urlDem, cuardo.translation);

var urlTex = "/mapcache?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetMap&WIDTH=1024&HEIGHT=1024&LAYERS=ortho&STYLES=&FORMAT=image/jpeg&SRS=EPSG:3946&TILED=true&TRANSPARENT=TRUE";
var ortho = new cuardo.RasterLayer(urlTex, terrain);

// textured TIN layer
var urlTin = "/cgi-bin/tinyows?SERVICE=WFS&VERSION=1.0.0&REQUEST=GetFeature&outputFormat=JSON&typeName=tows:textured_citygml";
// base url where to find textures
var urlImageBase = "/w/textures/";
var buildings = new cuardo.WfsTinLayer(urlTin, urlImageBase, terrain);

var map = new cuardo.Map('container', [terrain, ortho, buildings], sceneSize, 0);

// add menu to toggle layer visibility
var layerVisibilityControls = new cuardo.LayerVisibilityControl('layerList', map.requestRender);
layerVisibilityControls.add("Terrain", terrain);
layerVisibilityControls.add("OrthoPhoto", ortho);
layerVisibilityControls.add("Buildings", buildings);

// add progress bar
var progress = new cuardo.ProgressBarControl('progressInfo', notification);

// add camera controler
var controls = new cuardo.GISControls(map.camera, null, map.target );
controls.maxDistance = sceneSize * 10;
controls.addEventListener('change', map.requestRender );

map.animate();

