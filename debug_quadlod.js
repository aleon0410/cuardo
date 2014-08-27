MyLayer = function( color, range, z )
{
    this.color = color;
    this.range = range;
    this.z = z;
    this.extent = [0,0,1000,1000];
};

MyLayer.prototype.tile = function( center, size, tileId, callback )
{
    if ( (size < this.range[0]) || (size >= this.range[1]) ) {
        callback();
        return;
    }
    var group = new THREE.Object3D();
    var grid = new THREE.GridHelper( size/2, size/8 );
    var color = this.color;
    grid.setColors( color, color );
    grid.rotation.x = -Math.PI/2;
    grid.position = center;
    grid.position.z = this.z;
    group.add(grid);
    callback( group );
};

function getConfig()
{
    //
    // Tilers configurations
    //

    var translation = new THREE.Vector3(0,0,0);

    var l1 = new MyLayer( 0xff0000, [250,1000], 20 );
    var l2 = new MyLayer( 0x00ff00, [0, 250], 20 );

    //
    // List of layers with tilers
    var layers = [{name:'L1', levels:[l1, l2]}]

    // scene size 
    var sceneSize = 2000;

    // max depth of the quad tree
    var maxLOD = 4;

    return {
        layers:layers,
        translation:translation,
        sceneSize:sceneSize,
        maxLOD:maxLOD
    };
}

