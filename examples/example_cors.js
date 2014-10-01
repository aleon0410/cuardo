//
// Example 1
// Simple scene with a terrain layer
//

// global translation of the scene
// -150 : average elevation
cuardo.translation = new THREE.Vector3(-1844157, -5175124, -150);
THREE.ImageUtils.crossOrigin = "anonymous";
var sceneSize = 1500;

var urlDem = "https://secure.grandlyon.webmapping.fr/wms/grandlyon?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetMap&WIDTH=256&HEIGHT=256&LAYERS=MNT2009_ombrage_10m_CC46&STYLES=&FORMAT=image/jpeg&SRS=EPSG:3946&TILED=true&TRANSPARENT=TRUE";
var terrain = new cuardo.Terrain(urlDem);

var map = new cuardo.Map('container', [terrain], sceneSize, 0);

// add menu to toggle layer visibility
var layerVisibilityControls = new cuardo.LayerVisibilityControl('layerList', map.requestRender);
layerVisibilityControls.add("Terrain", terrain);

// add progress bar
var progress = new cuardo.ProgressBarControl('progressInfo', notification);

// add camera controler
var controls = new cuardo.GISControls(map.camera, null, map.target );
controls.maxDistance = sceneSize * 10;
controls.addEventListener('change', map.requestRender );

map.animate();
