// convert an integer 0xrrggbb to {r:a, g:b, b:c} 
cuardo.toRGB = function( c )
{
    return { r:((c>>16)&0xff)/255.0, g:((c>>8)&0xff)/255.0, b:(c&0xff)/255.0 };
}

cuardo.rgbToInt = function( c )
{
    return c.r << 16 | c.g << 8 | c.b;
}

// symbology expression evaluation
cuardo.evalExpression = function( e, properties )
{
    if ( e.property ) {
        // access to a property
        var c = properties[e.property]
        return c;
    }
    else if ( e.expression ) {
        // function string
        eval('var f = ' + e.expression);
        return f(properties);
    }
    // constant
    return e;
}

