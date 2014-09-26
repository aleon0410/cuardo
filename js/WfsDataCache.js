cuardo.WfsDataCache = function(){
    this.loaded = {};
}

cuardo.WfsDataCache.instance = function()
{
    if (cuardo.WfsDataCache.instance__ === undefined ) {
        cuardo.WfsDataCache.instance__ = new cuardo.WfsDataCache();
    }
    return cuardo.WfsDataCache.instance__;
}

cuardo.WfsDataCache.prototype.add = function(url, center, size, data){
    if ( !this.loaded[url] ) this.loaded[url] = [];
    this.loaded[url].push({center:center, size:size, data:data});
}

cuardo.WfsDataCache.prototype.get = function(url, center, size){
    var loaded = this.loaded[url];
    if (loaded){
        for (var i=0; i<loaded.length; i++){
            if ( Math.abs(loaded[i].center.x - center.x) < loaded[i].size/2 &&
                 Math.abs(loaded[i].center.y - center.y) < loaded[i].size/2 ){
                    return loaded[i].data;
             }
        }
    }
    return undefined;
}
