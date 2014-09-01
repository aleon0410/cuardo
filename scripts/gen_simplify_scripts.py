#!/usr/bin/env python

if __name__ == "__main__":

    lods = [ # (lod_name, snap distance)
        ('lod0', 80),
        ('lod1', 40),
        ('lod2', 20),
        ('lod3', 10)
    ];
            
    for lod_name, snap_dist in lods:
        f = open('lod_simplify.sql.tmpl')
        print lod_name
        sql = f.read().replace('%lod%', lod_name).replace('%snapdist%', '%s' % snap_dist)
        fo = open(lod_name + '_simplify.sql', 'w')
        fo.write(sql)


