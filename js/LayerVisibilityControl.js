cuardo.LayerVisibilityControl = function( target, requestRenderCallback ){

    this.target =  document.getElementById(target);
    this.requestRenderCallback = requestRenderCallback;
    if (!this.target) throw 'cannot find element '+target;
}

cuardo.LayerVisibilityControl.prototype.add = function( name, layer ){
    var that = this;
    var div = document.createElement('div')
    this.target.appendChild(div);
    var chk = document.createElement('input');
    div.appendChild(chk);
    div.appendChild(document.createTextNode(name));
    chk.type = 'checkbox';
    chk.onclick = function(){ 
        layer.setVisibility(this.checked); 
        if (that.requestRenderCallback ) 
            that.requestRenderCallback(); 
    };
    chk.checked = true;
}

