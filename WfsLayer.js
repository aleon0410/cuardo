// TODO select only the opropriate layer
WfsLayer = function (url) {
    THREE.Object3D.call( this );
    this.url = url;
    this.extend = [];
    this.srid = 0;

    var object = this;
    cpabilityUrl = url;
    jQuery.ajax(this.url+'?SERVICE=WFS&VERSION=1.1.0&REQUEST=GetCapabilities', {
        success: function(data, textStatus, jqXHR) {
            $(data).find('FeatureType').each(function() { 
                object.srid =$(this).find('DefaultSRS').text().replace(new RegExp('.*EPSG::'), '');
                object.extend = proj4(proj4.defs("EPSG:"+object.srid), $(this).find('ows\\:LowerCorner').text().split(' ')).concat(
                       proj4(proj4.defs("EPSG:"+object.srid), $(this).find('ows\\:UpperCorner').text().split(' ')));
            });
            console.log('loaded');

        },
        async:   false,
        dataType: 'xml',
        error: function(jqXHR, textStatus, errorThrown) {
            console.log(textStatus+' :'+errorThrown);
            throw errorThrown;
        }
    });
    console.log('extend ' + this.extend.join(', '));
};

WfsLayer.prototype = Object.create( THREE.Object3D.prototype );

WfsLayer.prototype.load = function (extend) {
    // get the data
};


//WfsLayer.prototype.clone = function ( object ) {
//
//	if ( object === undefined ) return object;
//
//	THREE.Object3D.prototype.clone.call( this, object );
//
//        object.url  = this.url;
//        object.extend = this.extend;
//        object.srid = this.srid;
//
//	return object;
//};
