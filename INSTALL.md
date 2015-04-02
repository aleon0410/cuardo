DEMO Installation instructions
==============================

Foreword
--------

There is two alternatives for setting up the desired infrastructure :
* install all components yourself, using this guide
* use a docker container already setup

The second solution is easier, if you already have an environment with Docker installed.
If you want to go the Docker way, follow INSTALL_Docker.md
Otherwise, follow the steps below.

Overview
--------

The first step is to install PostgreSQL / PostGIS, with SFCGAL support
* PostgreSQL / PostGIS, with SFCGAL support

Then we will download and integrate the required data.

And we will make sure the following software are installed on your server :
* Apache 2
* TinyOWS master from github repository
* Mapserver 6.4
* Mapcache

We also will setup all these softwares.

PostgreSQL
----------

Install PostgreSQL and PostGIS with SFCGAL support

Data integration
----------------

Follow the instructions in setup_data.md to get the required data for the demo into the database.

Apache
------

Configure apache for fastcgi:

    sudo apt-get install libapache2-mod-fcgid
    sudo a2enmod fcgid

TinyOWS
-------

Compile and install tinyows :

    git clone https://github.com/mapserver/tinyows.git
    cd tinyows && autoconf && ./configure
    make && sudo make install && sudo cp tinyows /usr/lib/cgi-bin/tinyows

Copy the given conf/tinyows.xml into /etc/tinyows.xml

Restart apache:

    sudo service apache2 restart

Test tinyOWS (in a browser) :
* http://localhost/cgi-bin/tinyows?SERVICE=WFS&VERSION=1.0.0&REQUEST=GetCapabilities

Data simplification
-------------------

In scripts/
* run gen_simplify_scripts.py
* psql lyon < lod0_simplify.sql
* psql lyon < lod1_simplify.sql
* psql lyon < lod2_simplify.sql
* psql lyon < lod3_simplify.sql

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

Mapserver Mapcache
------------------

Install Mapcache. 
From Ubuntu 14.04 packages :

  apt-get install -y libapache2-mod-mapcache apache2 apache2-utils cgi-mapserver

If using another distribution, you can look for contrib packages for your distribution, or you can compile Mapcache too. In that case, you will have to follow the "MapCache configuration" steps below. If using debian/ubuntu packages, skip it.

MapCache configuration (non-ubuntu/debian)
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

Copy conf/apache_mapcache.conf :

  cp conf/apache_mapcache.conf /etc/apache2/conf-available/mapcache.conf
  ln -s /etc/apache2/conf-available/mapcache.conf /etc/apache2/conf-enabled/mapcache.conf

Copy MapCache configuration to /var/www/

  sudo cp conf/mapcache.xml /var/www/

Restart apache :

  sudo /etc/init.d/apache2 restart


MapCache configuration (Ubuntu/debian)
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

Copy MapCache configuration :

  sudo cp conf/mapcache.xml /etc/mapcache.xml

Restart Apache :

  sudo /etc/init.d/apache2 restart

Test MapCache
~~~~~~~~~~~~~

Test (in a browser) :

* http://localhost/mapcache?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetMap&WIDTH=256&HEIGHT=256&LAYERS=mnt&STYLES=&FORMAT=image/png&SRS=EPSG:3946&TILED=true&DPI=96&MAP_RESOLUTION=96&FORMAT_OPTIONS=dpi:96&TRANSPARENT=TRUE&BBOX=1848500,5172000,1850500,5174000
* http://localhost/mapcache?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetMap&WIDTH=256&HEIGHT=256&LAYERS=ortho&STYLES=&FORMAT=image/png&SRS=EPSG:3946&TILED=true&DPI=96&MAP_RESOLUTION=96&FORMAT_OPTIONS=dpi:96&TRANSPARENT=TRUE&BBOX=1848500,5172000,1850500,5174000 

Run the demo
------------

Create a link to this directory (the one with this README in it) in your server directory:

    sudo ln -s $PWD /var/www/html/demo

Restart apache:

    sudo service apache2 restart

Now try:
* http://localhost/demo/wfslayer_textured_geom_demo.html
* http://localhost/demo/wfslayer_demo.html
* http://localhost/demo/tiler_demo.html

