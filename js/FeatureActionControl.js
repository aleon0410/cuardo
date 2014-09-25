cuardo.FeatureActionControl = function( target, map ){
    var t =  document.getElementById(target);
    if (!t) throw 'cannot find element '+target;
    this.callbacks = [];
    this.map = map;
    this.select = document.createElement('select');
    t.appendChild(this.select);

    this.add("Select action");

    this.highlightControls = new cuardo.HighlightControl(this.map.scene);
    this.featureSelectionControls = new cuardo.FeatureSelectionControl(this.map);

    var that = this;
    this.map.target.addEventListener('click', function(event){that.onClick(event);});
}

cuardo.FeatureActionControl.prototype.onClick = function( event ){
    this.highlightControls.reset();
    if (this.isActive()){
        var position = {x:event.clientX, y:event.clientY};
        var selected = this.featureSelectionControls.select( position );
        if (selected){
            if(this.exec(selected.layer, selected.gid, position))
                this.highlightControls.highlight( selected.gid, selected.layer);
        }
    }

    this.map.requestRender();
}

cuardo.FeatureActionControl.prototype.add = function( name, callback ){
    var n = document.createElement('option');
    this.select.add(n);
    n.value = this.callbacks.length;
    n.text = name;
    this.callbacks.push( callback );
}

cuardo.FeatureActionControl.prototype.isActive = function(){
    return this.select.selectedIndex != 0 && this.callbacks[this.select.selectedIndex];
}

cuardo.FeatureActionControl.prototype.exec = function( layer, gid, mousePosition ){
    if (!this.isActive()) return false;
    return this.callbacks[this.select.selectedIndex]( layer, gid, mousePosition );
}






