INSTALL DEMO
============




Create database
---------------

Install and configure postgres/postgis

    cd /tmp
    createdb lyon
    psql lyon -c 'create extension postgis'
    psql lyon -c 'create extension postgis_sfcgal'

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

    TODO


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
	 writable="1"
	 ns_prefix="tows"
	 ns_uri="http://www.tinyows.org/"
         name="toitures"
         title="toitures" />

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
    - http://localhost/demo/wfslayer_demo.html
    - http://localhost/demo/tiler_demo.html

