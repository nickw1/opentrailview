
export default class PanoDao {

    constructor(db) {
        this.db = db;
    }

    async findById(id) {
        const dbres = await this.db.query("SELECT id, userid, authorised, ele, poseheadingdegrees, pancorrection, tiltcorrection, rollcorrection, ST_ASText(the_geom) AS the_geom FROM panoramas WHERE id=$1", [ id ] );
        if(dbres.rows.length == 0) {
            return null;
        } else {
            this.extractLonLat(dbres.rows[0]);
            const seqid = await this.getSequenceForPano(id);
            if(seqid > 0) {
                dbres.rows[0].seqid = seqid;
            }
            return dbres.rows[0];
        }
    }

    async authorisePano(id) {
        const dbres = await this.db.query("UPDATE panoramas set authorised=1 WHERE id=$1", [ id ] );
        return dbres.rowCount;
    }

    async deletePano(id) {
        const dbres = await this.db.query("DELETE FROM panoramas WHERE id=$1", [ id ] );
        return dbres.rowCount;
    }


    async findNearest(lon, lat) {
        const dbres = await this.db.query(`SELECT id, ele, poseheadingdegrees, pancorrection, tiltcorrection, rollcorrection, userid, ST_AsText(the_geom) AS the_geom FROM panoramas WHERE authorised=1 ORDER BY ST_Distance(the_geom, ST_GeomFromText('POINT(${lon} ${lat})', 4326)) LIMIT 1`);
        if(dbres.rows.length == 0) {
            return null; 
        } else {
            this.extractLonLat(dbres.rows[0]);
            return dbres.rows[0];
        }
    }

    async findByBbox(bbox) {
        const dbres = await this.db.query(`SELECT id, ele, poseheadingdegrees, pancorrection, tiltcorrection, rollcorrection, userid, ST_AsText(the_geom) AS the_geom FROM panoramas WHERE authorised=1 AND the_geom && ST_MakeEnvelope(${bbox.join(',')}, 4326)`);
        dbres.rows.forEach(row => { this.extractLonLat(row); });
        return dbres.rows;
    }

    async rotate(id, pan, tilt, roll) {
        const dbres = await this.db.query("UPDATE panoramas SET pancorrection=$1, tiltcorrection=$2, rollcorrection=$3 WHERE id=$4", [ pan, tilt, roll, id ] );
        return dbres.rowCount;    
    }

    async move(id, lon, lat) {
        const updatedRows = await this.doMovePano(id, lon, lat);
        return updatedRows;
    }

    async addPano(geom, poseheadingdegrees, ele=null, user=null) {
        const dbres = await this.db.query('INSERT INTO panoramas (the_geom, timestamp, poseheadingdegrees, ele, userid) VALUES (ST_GeomFromText($1, 4326), $2, $3, $4, $5) RETURNING id', [geom, Math.round(new Date().getTime()/1000), poseheadingdegrees, ele, user]);
        return dbres.rows.length == 1 ? dbres.rows[0].id : 0;
    }

    async doMovePano(id, lon, lat) {
        const dbres = await this.db.query("UPDATE panoramas SET the_geom=ST_GeomFromText($1, 4326) WHERE id=$2", [`POINT(${lon} ${lat})`, id]);
        return dbres.rowCount;
    }

    async findNearby(lon, lat, limit) {
        const dbres = await this.db.query(`SELECT id, ele, poseheadingdegrees, pancorrection, tiltcorrection, rollcorrection, ST_AsText(the_geom) AS the_geom FROM panoramas WHERE authorised=1 AND ST_Distance(ST_GeomFromText($1, 4326)::geography, the_geom, false) < $2 ORDER BY id`, [`POINT(${lon} ${lat})`, limit]);
        dbres.rows.forEach(row => { this.extractLonLat(row); });
        return dbres.rows;
    }

    async findUnauthorised() {
        const dbres = await this.db.query('SELECT id, ele, poseheadingdegrees, pancorrection, tiltcorrection, rollcorrection, authorised, ST_AsText(the_geom) AS the_geom FROM panoramas WHERE authorised=0 AND the_geom IS NOT NULL ORDER BY id');
        dbres.rows.forEach(row => { this.extractLonLat(row); });
        return dbres.rows;
    }

    async findUnpositioned(userid=null) {
        const dbres = userid === null ?
            await this.db.query('SELECT id, ele, poseheadingdegrees, pancorrection, tiltcorrection, rollcorrection, authorised, ST_AsText(the_geom) AS the_geom FROM panoramas WHERE the_geom IS NULL ORDER BY id'): 
            await this.db.query('SELECT id, ele, poseheadingdegrees, pancorrection, tiltcorrection, rollcorrection, authorised, ST_AsText(the_geom) AS the_geom FROM panoramas WHERE the_geom IS NULL AND userid=$1 ORDER BY id', [userid]);
        dbres.rows.forEach(row => { this.extractLonLat(row); });
        return dbres.rows;
    }

    async findByUser(userid) {
        const dbres = await this.db.query('SELECT id, ele, poseheadingdegrees, pancorrection, tiltcorrection, rollcorrection, authorised, ST_AsText(the_geom) AS the_geom FROM panoramas WHERE userid=$1 AND authorised=1 AND the_geom IS NOT NULL ORDER BY id', [userid]);
        dbres.rows.forEach(row => { this.extractLonLat(row); });
        return dbres.rows;
    }

    async findNoElevation() {
        const dbres = await this.db.query('SELECT id, ST_AsText(the_geom) AS the_geom FROM panoramas WHERE ele IS NULL ORDER BY id');
        dbres.rows.forEach(row => { this.extractLonLat(row); });
        return dbres.rows;
    }

    async setElevation(id, ele) {
        const dbres = await this.db.query(`UPDATE panoramas SET ele=${ele} WHERE id=${id}`);
        return dbres.rowCount;
    }

    async createSequence(panos) {
        const list = 'LINESTRING(' + panos.map ( pano => `${pano.lon} ${pano.lat}` ).join(',') + ')';
        let dbres = await this.db.query("INSERT INTO sequence_geom (the_geom) VALUES(ST_GeomFromText($1, 4326)) RETURNING id", [list]);
        const seqid = dbres.rows.length == 1 ? dbres.rows[0].id : 0;
        if(seqid > 0) {
            for(let pano of panos) {
                dbres = await this.db.query(`INSERT INTO sequence_panos (sequenceid, panoid) VALUES ($1, $2)`, [seqid, pano.id]);    
            }
        } 
        return seqid;
    }

    async getSequence(seqId) {
        const dbres = await this.db.query(`SELECT ST_AsText(p.the_geom) AS geom, p.pancorrection, p.tiltcorrection, p.rollcorrection, p.poseheadingdegrees, p.ele, s.panoid FROM sequence_panos s, panoramas p WHERE s.panoid=p.id AND sequenceid=$1 ORDER BY s.id`, [seqId]);
        return dbres.rows.length == 0 ? null : dbres.rows.map ( row => {
            const m = /POINT\(([\d\-\.]+) ([\d\-\.]+)\)/.exec(row.geom);
            return {
                panoid: row.panoid,
                lon: m[1],
                lat: m[2],
                ele: parseFloat(row.ele),
                tiltcorrection: parseFloat(row.tiltcorrection),
                pancorrection: parseFloat(row.pancorrection),
                rollcorrection: parseFloat(row.rollcorrection),
                poseheadingdegrees: parseFloat(row.poseheadingdegrees)
            }
        });
    }

    async getSequenceGeom(seqId) {
        const dbres = await this.db.query("SELECT ST_AsGeoJSON(the_geom) AS json FROM sequence_geom WHERE id=$1", [seqId]);
        if(dbres.rows.length > 0) {
            return {
                type: 'Feature',
                geometry: JSON.parse(row.json)
            };
        }
        return null;
    }

    async getSequenceForPano(panoId) {
        const dbres = await this.db.query("SELECT sequenceid FROM sequence_panos WHERE panoid=$1", [panoId]);
        return dbres.rows.length == 0 ? 0 : dbres.rows[0].sequenceid;
    }

    async getFullSequenceForPano(panoId) {
        const dbres = await this.db.query("SELECT ST_AsText(p.the_geom) as geom, s.panoid FROM sequence_panos s, panoramas p WHERE s.panoid=p.id AND sequenceid=(SELECT sequenceid FROM sequence_panos WHERE panoid=$1) ORDER BY s.id", [panoId]);
        return dbres.rows.map ( row => {
            const m = /POINT\(([\d\-\.]+) ([\d\-\.]+)\)/.exec(row.geom);
            return {
                id: row.panoid,
                lon: m[1],
                lat: m[2]
            };
        });
    }

    extractLonLat(row) {
        const results = /POINT\(([\d\-\.]+) ([\d\-\.]+)\)/.exec(row.the_geom); 
        if(results && results.length == 3) {
            row.lon = parseFloat(results[1]);
            row.lat = parseFloat(results[2]);
        } else {
            row.lon = 0;
            row.lat = 0;
        }
        delete row.the_geom;
    }
}

