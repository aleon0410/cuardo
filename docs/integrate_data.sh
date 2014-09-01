#!/bin/sh
# demo data integration to the database
#

createdb lyon
psql lyon -c 'create extension postgis'
psql lyon -c 'create extension postgis_sfcgal'
psql lyon -c 'create extension postgis_topology'


shp2pgsql -W LATIN1 -I -s 3946 gin_nettoiement.gintoilettepublique.shp toilettes_publiques| psql lyon

shp2pgsql -W LATIN1 -I -s 3946 adr_voie_lieu.adrnumerovoie.shp rues| psql lyon
shp2pgsql -W LATIN1 -I -s 3946 adr_voie_lieu.adrarrond.shp arrondissements | psql lyon
shp2pgsql -W LATIN1 -I -s 3946  fpc_fond_plan_communaut_fpctoit.shp toitures | psql lyon
shp2pgsql -W LATIN1 -s 3946 jcd_jcdecaux.jcdvelov.shp velov | psql lyon
