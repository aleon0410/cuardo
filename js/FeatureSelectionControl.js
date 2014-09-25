cuardo.FeatureSelectionControl = function( map ){
    this.map = map;
}

cuardo.FeatureSelectionControl.prototype.select = function( position ){
    var objects = [];

    this.map.scene.traverse( function(obj) {
        if ( obj.userData && obj.userData.vertexGidMap ) {
            objects.push( obj );
        }
    });

    var mouseRay = this.map.mouseRay(position);
    var raycaster = new THREE.Raycaster( mouseRay.position, mouseRay.direction );

    var intersects = raycaster.intersectObjects( objects );

    for (var idx = 0; idx < intersects.length; idx++ ) {
        var object = intersects[ idx ].object;
        if ( !object.visible ) continue;

        return {gid:object.userData.vertexGidMap[ intersects[ idx ].indices[0] ],
                layer:object.userData.layer};
    }
}

