//
// Tilers configurations
//
cuardo.translation = new THREE.Vector3(-1844098.1,-5174884.2, -150);

var urlDem = "/mapcache?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetMap&WIDTH=256&HEIGHT=256&LAYERS=mnt&STYLES=&FORMAT=image/jpeg&SRS=EPSG:3946&TILED=true&TRANSPARENT=TRUE"
var urlTex = "/mapcache?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetMap&WIDTH=1024&HEIGHT=1024&LAYERS=ortho&STYLES=&FORMAT=image/jpeg&SRS=EPSG:3946&TILED=true&TRANSPARENT=TRUE"

// Lyon 3
var terrain = new cuardo.Terrain(urlDem);
var ortho = new cuardo.RasterLayer(urlTex, terrain);

// tile size of the most detailed tile
var MT = 700;

var urlTin = "/cgi-bin/tinyows.fcgi?SERVICE=WFS&VERSION=1.0.0&REQUEST=GetFeature&outputFormat=JSON&typeName=tows:textured_citygml";
var urlImageBase0 = "/w/textures/"; // low res textures
var tin0 = new cuardo.WfsTinLayer( urlTin, urlImageBase0, terrain, [0, MT] );

// subsampled version
var urlImageBase1 = "/w/textures/"; // high res textures
var tin1 = new cuardo.WfsTinLayer( urlTin, urlImageBase1, terrain, [MT, MT<<1] );

var bati = new cuardo.LayerSet([tin0, tin1]);

// scene size 
var sceneSize = MT<<1;

// max depth of the quad tree
var maxLOD = 2;

var map = new cuardo.Map('container', [terrain, ortho, bati], sceneSize, maxLOD);

// add menu to toggle layer visibility
var layerVisibilityControls = new cuardo.LayerVisibilityControl('layerList', map.requestRender);
layerVisibilityControls.add("Terrain", terrain);
layerVisibilityControls.add("OrthoPhoto", ortho);
layerVisibilityControls.add("Buildings", bati);

// add progress bar
var progress = new cuardo.ProgressBarControl('progressInfo', notification);

// add camera controler
var controls = new cuardo.GISControls(map.camera, null, map.target );
controls.maxDistance = sceneSize * 10;
controls.addEventListener('change', map.requestRender );

map.animate();
