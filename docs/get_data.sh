#!/bin/sh

# Get data for demo setup
# =======================
# 
# You will need a postgis database, access without password and
# a PostGIS database named "lyon"

# public toilets
wget  "http://smartdata.grandlyon.com/smartdata/wp-content/plugins/wp-smartdata/proxy.php?format=Shape-zip&name=gin_nettoiement.gintoilettepublique&commune=&href=https%3A%2F%2Fdownload.data.grandlyon.com%2Fwfs%2Fgrandlyon%3FSERVICE%3DWFS%26REQUEST%3DGetFeature%26typename%3Dgin_nettoiement.gintoilettepublique%26outputformat%3DSHAPEZIP%26VERSION%3D2.0.0%26SRSNAME%3DEPSG%3A3946" -O out.zip && unzip out.zip

# streets
wget "http://smartdata.grandlyon.com/smartdata/wp-content/plugins/wp-smartdata/proxy.php?format=Shape-zip&name=adr_voie_lieu.adrnumerovoie&commune=&href=https%3A%2F%2Fdownload.data.grandlyon.com%2Fwfs%2Fgrandlyon%3FSERVICE%3DWFS%26REQUEST%3DGetFeature%26typename%3Dadr_voie_lieu.adrnumerovoie%26outputformat%3DSHAPEZIP%26VERSION%3D2.0.0%26SRSNAME%3DEPSG%3A3946" -O out.zip && unzip out.zip

# arrondissements
wget "http://smartdata.grandlyon.com/smartdata/wp-content/plugins/wp-smartdata/proxy.php?format=Shape-zip&name=adr_voie_lieu.adrarrond&commune=&href=https%3A%2F%2Fdownload.data.grandlyon.com%2Fwfs%2Fgrandlyon%3FSERVICE%3DWFS%26REQUEST%3DGetFeature%26typename%3Dadr_voie_lieu.adrarrond%26outputformat%3DSHAPEZIP%26VERSION%3D2.0.0%26SRSNAME%3DEPSG%3A3946" -O out.zip && unzip out.zip

# buildings
wget "http://smartdata.grandlyon.com/smartdata/wp-content/plugins/wp-smartdata/proxy.php?format=shape&name=fpc_fond_plan_communaut.fpctoit.zip&commune=undefined&href=https%3A%2F%2Fdownload.data.grandlyon.com%2Ffiles%2Fgrandlyon%2Flocalisation%2Ffpc_fond_plan_communaut.fpctoit.zip" -O out.zip && unzip out.zip

# public bikes
wget -O velov.zip "http://smartdata.grandlyon.com/smartdata/wp-content/plugins/wp-smartdata/proxy.php?format=Shape-zip&name=jcd_jcdecaux.jcdvelov&commune=&href=https%3A%2F%2Fdownload.data.grandlyon.com%2Fwfs%2Fsmartdata%3FSERVICE%3DWFS%26REQUEST%3DGetFeature%26typename%3Djcd_jcdecaux.jcdvelov%26outputformat%3DSHAPEZIP%26VERSION%3D2.0.0%26SRSNAME%3DEPSG%3A3946" 

unzip velov.zip
