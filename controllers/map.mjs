import { Tile }  from 'jsfreemaplib';
import MapDao  from '../dao/map.mjs';

class MapController {

    constructor(db) {
        this.dao = new MapDao(db);
    }

    async byTile(req, res) {
        try {
            const t = new Tile(parseInt(req.params.x), parseInt(req.params.y), parseInt(req.params.z));
            const dbres = await this.dao.byTile(t);
            res.json(this.makeGeojson(dbres));
        } catch(e) {
            res.status(500).json({error: e});
        }
    }

    async byBbox(req, res) {
        try {
            const regex = /^[\d\.\-]+$/;
            const bbox = req.query.bbox.split(',').filter(val => regex.exec(val)).map (val => parseFloat(val));
            if(bbox.length == 4) {
                const dbres = await this.dao.byBbox(bbox);
                res.json(this.makeGeojson(dbres));
            }
        } catch(e) {
            res.status(500).json({error: e});
        }
    }

    async findNearestHighway(req, res) {
        try {
            const regex = /^[\d\.\-]+$/;
            if(regex.exec(req.query.lon) && regex.exec(req.query.lat) && /^\d+$/.exec(req.query.dist)) {
                const dbres = await this.dao.findNearestHighway(parseFloat(req.query.lon), parseFloat(req.query.lat), req.query.dist);
                res.json(dbres.rows);
            } else {
                res.status(400).json({error: 'Invalid input parameters'});
            }
        } catch(e) {
            res.status(500).json({error: e});
        }
    }

    makeGeojson(dbres) {
        const regex = /LINESTRING\((.*)\)/;
        const data = {
            features: [],
            type: 'FeatureCollection'
        };
        
        dbres.rows.forEach ( row => {
            const result = regex.exec(row.way);
            if(result[1] !== undefined) {
                const coords = result[1].split(',').map ( ll => ll.split(' ').map (val => parseFloat(val)));
                data.features.push({    
                    type: "Feature",
                    properties: {
                        osm_id : row.osm_id,
                        highway: row.highway
                    },
                    geometry: {
                        type: 'LineString',
                        coordinates: coords
                    }
                });
            }
        });
        return data;
    }    
}

export default MapController;
