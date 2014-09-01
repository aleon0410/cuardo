Setting up data for 3D demo
===========================

Be sure you have PostgreSQL and POstGIS installed. See general README file for this.

Create a directory with enough room for the data and cd to it.

First layers
------------

We will first integrate the following data :

Points : public toilets
Lines : streets
Polygons to drap : arrondissements
Polygons : buildings
Point layer : Velo'v public bikes

Run the following scripts in order, to download and then integrate most data into the database.
* get_data.sh
* setup_data.sh

3D data integration
-------------------

We now integrate 3D textured buildings.

Get the file LYON_CityGML.zip from Lyon Smart Data website.

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

Once the loading is done, execute the following script inside the database : 
* texture_load.sql

Wait for this step to complete.

Then copy the table to the final database

  pg_dump lyon -t textured_citygml | psql lyon

Now create the LOD0 data from toitures table, launching the following script :
* lod0.sql


(optional) Textured geometry test
---------------------------------

This step is not mandatory for the demo to run, be is here for reference on how a simple exemple would look like.

Test for textured geometries, in psql : a simple vertical face to display a building.

Note that it's an invalid multipolygon, but tin are not yet supported by tinyows

    create type texture as (url text,uv float[][]);
    create table textured_geometry (gid serial primary key, geom geometry('MULTIPOLYGONZ',3946,3), name text, tex texture);
    insert into textured_geometry(geom, name, tex) values ('SRID=3946;MULTIPOLYGON Z (((0 0 0,6 0 0,0 0 12,0 0 0)),((0 0 12,6 0 0,6 0 12,0 0 12)))'::geometry, 'toto', ROW('http://localhost/textures/building-texture1.jpg','{{0,0},{.81,.0},{0,1},{0,0},{0,1},{.81,.0},{.81,1},{0,1}}'));
    insert into textured_geometry(geom, name, tex) values ('SRID=3946;MULTIPOLYGON Z (((0 0 0,0 6 0,0 0 12,0 0 0)),((0 0 12,0 6 0,0 6 12,0 0 12)))'::geometry, 'tata', ROW('http://localhost/textures/building-texture2.jpg','{{0,0},{.81,.0},{0,1},{0,0},{0,1},{.81,.0},{.81,1},{0,1}}'));

Then install the texture files so that they can be accessed from your browser. Here to serve them by apache:

    cd /tmp
    wget http://salzburndesigns.com/gaming/wp-content/uploads/2012/11/building-texture1.jpg 
    wget http://texturelib.com/Textures/buildings/buildings/buildings_buildings_0095_01_preview.jpg -O building-texture2.jpg
    sudo mkdir /var/www/html/textures
    sudo cp building-texture1.jpg /var/www/html/textures

Test (in the browser) that you can access http://localhost/textures/building-texture1.jpg

