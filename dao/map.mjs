
class MapDao {

    constructor(db) {
        this.db = db;
    }

    async byTile(t) {
        const bbox = t.getBottomLeft();
        bbox.push(...t.getTopRight());
        const dbres = await this.db.query(`SELECT osm_id, ST_AsText(ST_Transform(way, 4326)) AS way, highway FROM planet_osm_line WHERE way && ST_MakeEnvelope(${bbox.join(',')}, 3857) AND (highway IN ('footway', 'bridleway', 'steps', 'track', 'service', 'cycleway', 'byway', 'path') OR designation<>'')`);
        return dbres; 
    }

    async byBbox(bbox) {
        const dbres = await this.db.query(`SELECT osm_id, ST_AsText(ST_Transform(way, 4326)) AS way, highway FROM planet_osm_line WHERE way && ST_Transform(ST_MakeEnvelope(${bbox.join(',')}, 4326), 3857) AND (highway IN ('footway', 'bridleway', 'steps', 'track', 'service', 'cycleway', 'byway', 'path') OR designation<>'')`);
        return dbres;
    }

    async findNearestHighway(lon, lat, limit) {
        const dbres = await this.db.query(`select * from (select osm_id, designation, highway, st_distance(st_transform(st_geomfromtext('POINT(${lon} ${lat})', 4326), 3857), way) as dist from planet_osm_line where way && ST_Transform(ST_MakeEnvelope(${lon-0.01}, ${lat-0.01}, ${lon+0.01}, ${lat+0.01}, 4326), 3857)) as d where dist<${limit} order by dist limit 1`);
        return dbres;
    }
}

export default MapDao;
