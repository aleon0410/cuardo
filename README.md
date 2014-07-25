INSTALL DEMO
============




Create database
---------------

Install and configure postgres/postgis

    cd /tmp
    createdb lyon
    psql lyon -c 'create extension postgis'
    psql lyon -c 'create extension postgis_sfcgal'
    psql lyon -c 'create extension postgis_topology'

Couche de points (toilettes publiques)

    wget  "http://smartdata.grandlyon.com/smartdata/wp-content/plugins/wp-smartdata/proxy.php?format=Shape-zip&name=gin_nettoiement.gintoilettepublique&commune=&href=https%3A%2F%2Fdownload.data.grandlyon.com%2Fwfs%2Fgrandlyon%3FSERVICE%3DWFS%26REQUEST%3DGetFeature%26typename%3Dgin_nettoiement.gintoilettepublique%26outputformat%3DSHAPEZIP%26VERSION%3D2.0.0%26SRSNAME%3DEPSG%3A3946" -O out.zip && unzip out.zip
    shp2pgsql -W LATIN1 -I -s 3946 gin_nettoiement.gintoilettepublique.shp toilettes_publiques| psql lyon

Couche de lignes (rues)

    wget "http://smartdata.grandlyon.com/smartdata/wp-content/plugins/wp-smartdata/proxy.php?format=Shape-zip&name=adr_voie_lieu.adrnumerovoie&commune=&href=https%3A%2F%2Fdownload.data.grandlyon.com%2Fwfs%2Fgrandlyon%3FSERVICE%3DWFS%26REQUEST%3DGetFeature%26typename%3Dadr_voie_lieu.adrnumerovoie%26outputformat%3DSHAPEZIP%26VERSION%3D2.0.0%26SRSNAME%3DEPSG%3A3946" -O out.zip && unzip out.zip
    shp2pgsql -W LATIN1 -I -s 3946 adr_voie_lieu.adrnumerovoie.shp rues| psql lyon

Couche de polygones pour aplat (arrondissments)

    wget "http://smartdata.grandlyon.com/smartdata/wp-content/plugins/wp-smartdata/proxy.php?format=Shape-zip&name=adr_voie_lieu.adrarrond&commune=&href=https%3A%2F%2Fdownload.data.grandlyon.com%2Fwfs%2Fgrandlyon%3FSERVICE%3DWFS%26REQUEST%3DGetFeature%26typename%3Dadr_voie_lieu.adrarrond%26outputformat%3DSHAPEZIP%26VERSION%3D2.0.0%26SRSNAME%3DEPSG%3A3946" -O out.zip && unzip out.zip
    shp2pgsql -W LATIN1 -I -s 3946 adr_voie_lieu.adrarrond.shp arrondissements | psql lyon

Couche de polygones pour bâti

    wget "http://smartdata.grandlyon.com/smartdata/wp-content/plugins/wp-smartdata/proxy.php?format=shape&name=fpc_fond_plan_communaut.fpctoit.zip&commune=undefined&href=https%3A%2F%2Fdownload.data.grandlyon.com%2Ffiles%2Fgrandlyon%2Flocalisation%2Ffpc_fond_plan_communaut.fpctoit.zip" -O out.zip && unzip out.zip
    shp2pgsql -W LATIN1 -I -s 3946  fpc_fond_plan_communaut_fpctoit.shp toitures | psql lyon

Couche de polygones 3d texturés 

* unzip the archive LYON_CityGML.zip
* Modify LYON_3.gml, disable (comment out) the following cityObjectMember:
**  49_PREFECTURE
** LYON_3EME_00004
** LYON_3EME_00054
** LYON_3EME_00318

CityGML import :
* Download the java citygml2postgis application from http://www.3dcitydb.net
* Create a PostGIS database 'citygml'
* Initialize it with 3dcitydb/postgis/CREATE_DB.sql
* Launch 3DCityDB-Importer-Exporter
* Set preferences to:
** Import / Features Classes / Select only 'Building'
** Preferences / Appearance / Import appearance, do not import textures
** Preferences / Import / gml:id / Use UUID in case of missing gml:id (optional, for better feedback in case of errors)
* Set the proper database parameters in the 'Database' tab
* Launch the import
* Ignore missing appearance XLinks errors

Textured data loading:

Once the loading is done, execute :

<pre>
CREATE OR REPLACE FUNCTION tex2vector(varchar) RETURNS float[][] AS $$
DECLARE
    outv float[][];
    arr varchar[];
    i int;
BEGIN
    arr := string_to_array($1,' ');
    FOR i IN 0..array_length(arr,1)/2-1
    LOOP
	outv := outv || array[[arr[i*2+1]::float, arr[i*2+2]::float]];
    END LOOP;
    return outv;
END;
$$ language plpgsql;

DROP AGGREGATE IF EXISTS array_accum(float[][]);
CREATE AGGREGATE array_accum (float[][])
(
    sfunc = array_cat,
    stype = float[][],
    initcond = '{}'
);

drop type if exists texture;
create type texture as (url text,uv float[][]);

drop table if exists textured_citygml;
create table textured_citygml (gid serial primary key, geom geometry('MULTIPOLYGONZ',3946,3), tex texture);

insert into textured_citygml
select root_id as gid,
  st_collect(g.geometry order by g.id) as geom,
  ('http://localhost/textures/' || tex_image_uri, array_accum(tex2vector(texture_coordinates) order by g.id) )::texture as tex
from
   surface_geometry as g,
   surface_data as d,
   textureparam as t

where
    t.surface_data_id = d.id
and t.surface_geometry_id = g.id
group by root_id, tex_image_uri
;
</pre>

... then copy the table to the final database
pg_dump lyon -t textured_citygml | psql lyon


LOD0

alter table toitures add column lod0 Geometry(polygon,3946);
update toitures set lod0 = st_envelope(geom);

create index on toitures using gist(geom);
create index on toitures using gist(lod0);

Test for textured geometries, in psql (a simple vertical face to display a building, note that it's an invalid multipolygon, but tin are not yet supported by tinyows):

    create type texture as (url text,uv float[][]);
    create table textured_geometry (gid serial primary key, geom geometry('MULTIPOLYGONZ',3946,3), name text, tex texture);
    insert into textured_geometry(geom, name, tex) values ('SRID=3946;MULTIPOLYGON Z (((0 0 0,6 0 0,0 0 12,0 0 0)),((0 0 12,6 0 0,6 0 12,0 0 12)))'::geometry, 'toto', ROW('http://localhost/textures/building-texture1.jpg','{{0,0},{.81,.0},{0,1},{0,0},{0,1},{.81,.0},{.81,1},{0,1}}'));
    insert into textured_geometry(geom, name, tex) values ('SRID=3946;MULTIPOLYGON Z (((0 0 0,0 6 0,0 0 12,0 0 0)),((0 0 12,0 6 0,0 6 12,0 0 12)))'::geometry, 'tata', ROW('http://localhost/textures/building-texture2.jpg','{{0,0},{.81,.0},{0,1},{0,0},{0,1},{.81,.0},{.81,1},{0,1}}'));

Then install texture so that it can be served by apache:

    cd /tmp
    wget http://salzburndesigns.com/gaming/wp-content/uploads/2012/11/building-texture1.jpg 
    wget http://texturelib.com/Textures/buildings/buildings/buildings_buildings_0095_01_preview.jpg -O building-texture2.jpg
    sudo mkdir /var/www/html/textures
    sudo cp building-texture1.jpg /var/www/html/textures

Test (in browser) that you can access http://localhost/textures/building-texture1.jpg


Configure tinows
----------------

Compile and install tinyows http://mapserver.org/fr/tinyows/serverinstallation.html

Configure apache for fastcgi:

    sudo apt-get install libapache2-mod-fcgid
    sudo a2enmod fcgid

Fichier /etc/tinyows.xml:

<pre>
<tinyows online_resource="http://127.0.0.1/cgi-bin/tinyows"
	 schema_dir="/usr/local/share/tinyows/schema/" estimated_extent="1">

  <pg host="127.0.0.1" user="postgres" password="postgres" dbname="lyon" port="5432"/>

  <metadata name="TinyOWS Server"
	    title="TinyOWS Server - Demo Service" />

  <layer retrievable="1"
	 writable="0"
	 ns_prefix="tows"
	 ns_uri="http://www.tinyows.org/"
         include_items="hfacade,geom"
         name="toitures"
         title="toitures"
         />

  <layer retrievable="1"
	 writable="0"
	 ns_prefix="tows"
	 ns_uri="http://www.tinyows.org/"
         include_items="hfacade,lod0"
         name="toitures_lod0"
         title="toitures_lod0"
         table="toitures"
         />

  <layer retrievable="1"
	 writable="1"
	 ns_prefix="tows"
	 ns_uri="http://www.tinyows.org/"
         name="arrondissements"
         title="arrondissements" />

  <layer retrievable="1"
	 writable="1"
	 ns_prefix="tows"
	 ns_uri="http://www.tinyows.org/"
         name="rues"
         title="rues" />

  <layer retrievable="1"
	 writable="1"
	 ns_prefix="tows"
	 ns_uri="http://www.tinyows.org/"
         name="toilettes_publiques"
         title="toilettes_publiques" />

  <layer retrievable="1"
	 writable="1"
	 ns_prefix="tows"
	 ns_uri="http://www.tinyows.org/"
         name="textured_geometry"
         title="textured_geometry" />
</tinyows>
</pre>

Restart apache:

    sudo service apache2 restart

Test (in browser) http://localhost/cgi-bin/tinyows.fcgi?SERVICE=WFS&VERSION=1.0.0&REQUEST=GetCapabilities

Install three.js
----------------

In this directory (the one with this README in it):

    git clone https://github.com/mrdoob/three.js.git


Configure mapcache
------------------

In /etc/apache2/apache2.conf, after your "Directory" sections, add:

<pre>
<IfModule mapcache_module>
   <Directory /var/www>
      Require all granted
   </Directory>
   MapCacheAlias /mapcache "/var/www/mapcache.xml"
</IfModule>
</pre>

Add a link to the mapcache config:

    sudo ln -s $PWD/mapcache.xml /var/www/

Restart apache.

Test (in browser) http://localhost/mapcache?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetMap&WIDTH=256&HEIGHT=256&LAYERS=mnt&STYLES=&FORMAT=image/png&SRS=EPSG:3946&TILED=true&DPI=96&MAP_RESOLUTION=96&FORMAT_OPTIONS=dpi:96&TRANSPARENT=TRUE&BBOX=1848500,5172000,1850500,5174000 http://localhost/mapcache?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetMap&WIDTH=256&HEIGHT=256&LAYERS=ortho&STYLES=&FORMAT=image/png&SRS=EPSG:3946&TILED=true&DPI=96&MAP_RESOLUTION=96&FORMAT_OPTIONS=dpi:96&TRANSPARENT=TRUE&BBOX=1848500,5172000,1850500,5174000 

Run the demo
------------

Create a link to this directory (the one with this README in it) in your server directory:

    sudo ln -s $PWD /var/www/html/demo

Restart apache:

    sudo service apache2 restart

Now try:
    - http://localhost/demo/wfslayer_textured_geom_demo.html
    - http://localhost/demo/wfslayer_demo.html
    - http://localhost/demo/tiler_demo.html

