-- LOD0
-- create LOD0 data in database from toitures table

alter table toitures add column lod0 Geometry(polygon,3946);
update toitures set lod0 = st_envelope(geom);

create index on toitures using gist(geom);
create index on toitures using gist(lod0);

