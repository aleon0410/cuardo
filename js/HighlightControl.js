cuardo.HighlightControl = function( scene ){
    this.scene = scene;
    this.restoreColors = [];
}

// highlight 
cuardo.HighlightControl.prototype.highlight = function(gid, layer){
    var that = this;
    this.scene.traverse( function(obj) {
        var c = new THREE.Color(0xffff00);
        if ( obj.userData && obj.userData.vertexGidMap && obj.userData.layer.url == layer.url ) {
            
            for (var i=0, end = obj.geometry.attributes.position.array.length/3; i<end; i++){
                if ( obj.userData.vertexGidMap[i] == gid ){
                    that.restoreColors.push({
                        obj: obj,
                        idx: i*3, 
                        color: { 
                            r:obj.geometry.attributes.color.array[i*3], 
                            g:obj.geometry.attributes.color.array[i*3+1], 
                            b:obj.geometry.attributes.color.array[i*3+2]}});
                    obj.geometry.attributes.color.array[i*3] = c.r;
                    obj.geometry.attributes.color.array[i*3+1] = c.g;
                    obj.geometry.attributes.color.array[i*3+2] = c.b;
                }
            }
            obj.geometry.attributes.color.needsUpdate = true;
        }
    });
}

cuardo.HighlightControl.prototype.reset = function(gid){
    this.restoreColors.forEach(function(r){
            r.obj.geometry.attributes.color.array[r.idx] = r.color.r;
            r.obj.geometry.attributes.color.array[r.idx+1] = r.color.g;
            r.obj.geometry.attributes.color.array[r.idx+2] = r.color.b;
            r.obj.geometry.attributes.color.needsUpdate = true;
        });
    this.restoreColors = [];
}

