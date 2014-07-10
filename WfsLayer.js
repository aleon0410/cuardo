WfsLayer = function (url) {
    THREE.Object3D.call( this );
    this.url = url;
    this.bbox = [];
    this.srid = 0;

    var object = this;
    jQuery.ajax(this.url+'?SERVICE=WFS&VERSION=1.1.0&REQUEST=GetCapabilities', {
        success: function(data, textStatus, jqXHR) {
            $(data).find('FeatureType').each(function() { 
                object.srid =$(this).find('DefaultSRS').text().replace(new RegExp('.*EPSG::'), '');
                object.bbox = proj4(proj4.defs("EPSG:"+object.srid), $(this).find('ows\\:LowerCorner').text().split(' ')).concat(
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
    console.log('bbox ' + this.bbox.join(', '));
};

WfsLayer.prototype = Object.create( THREE.Object3D.prototype );

WfsLayer.prototype.load = function () {
};


//WfsLayer.prototype.clone = function ( object ) {
//
//	if ( object === undefined ) return object;
//
//	THREE.Object3D.prototype.clone.call( this, object );
//
//        object.url  = this.url;
//        object.bbox = this.bbox;
//        object.srid = this.srid;
//
//	return object;
//};
