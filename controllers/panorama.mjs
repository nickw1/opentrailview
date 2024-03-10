import exifr from 'exifr';
import PanoDao from '../dao/panorama.mjs';
import sharp from 'sharp';
import { promises as fs } from 'fs';

export default class PanoController {

    constructor(db) {
        this.db = db;
    }

    async findById(req, res) {
        try {
            const row = await req.panoDao.findById(req.params.id);
            if(row === null) {
                res.status(404).json({error:"Cannot find panorama with that ID"});
            } else {
                res.json(row);
            }
        } catch(e) {
            res.status(500).json({error: e});
        }
    }

    async getImage(req, res) {
        await this.doGetImage(req, res, process.env.PANO_DIR);
    }

    async getImageRawUpload(req, res) {
        await this.doGetImage(req, res, process.env.RAW_UPLOADS);
    }

    async doGetImage(req, res, dir) {
        const row = await req.panoDao.findById(req.params.id);
        console.log(row);
        if(row === null) {
            res.status(404).json({error:"Cannot find panorama with that ID"});
        } else if (row.authorised == 0 && !req.session?.user?.isadmin && req.session?.user?.userid != row.userid) {
            res.status(401).json({error:"Panorama unauthorised"});
        } else {
            
            res.sendFile(`${dir}/${req.params.id}.jpg`, { }, err => {
                if(err) {
                    if(err.code == 'ENOENT') {
                        res.status(404).json({'error': 'Cannot find that panorama'});
                    } else {
                        res.status(500).json({'error': err});
                    }
                }
            });
        }
    }

    async getImageResized(req, res) {
        await this.doGetImageResized(req, res, process.env.PANO_DIR);
    }

    async getImageResizedRawUpload(req, res) {
        await this.doGetImageResized(req, res, process.env.RAW_UPLOADS);
    }

    async doGetImageResized(req, res, dir) {
        try {
            const result = await sharp(`${dir}/${req.params.id}.jpg`)
                .resize(parseInt(req.params.width))
                .toBuffer();
            res.set('Content-Type', 'image/jpg').send(result);
        } catch(e) {
            res.status(500).json({error: e});
        }
    }

    async authorisePano(req, res) {
        try {
            const rowCount = await req.panoDao.authorisePano(req.params.id);
            if(rowCount == 1) {
                await fs.rename(`${process.env.RAW_UPLOADS}/${req.params.id}.jpg`, `${process.env.PANO_DIR}/${req.params.id}.jpg`);
            }
            res.status(rowCount > 0 ? 200 : 404).json({nAuthorised: rowCount});
        } catch(e) {
            res.status(500).json({error: e});
        }
    }

    async deletePano(req, res) {
        try {
            const authorisedFile = `${process.env.PANO_DIR}/${req.params.id}.jpg`, 
                  unauthorisedFile = `${process.env.RAW_UPLOADS}/${req.params.id}.jpg`;
            let file = null;
            try {
                await fs.access(authorisedFile);
                file = authorisedFile;
            } catch(e) {
                file = unauthorisedFile;
            }
            const rowCount = await req.panoDao.deletePano(req.params.id);
            if(rowCount == 1) {
                await fs.unlink(file);
            }
            res.status(rowCount > 0 ? 200 : 404).json({nDeleted: rowCount});
        } catch(e) {
            res.status(500).json({error: e});
        }
    }


    async findNearest(req, res) {
        try {    
            const regex = /^[\d\.\-]+$/;
            if(regex.exec(req.params.lon) && regex.exec(req.params.lat)) {
                const row = await req.panoDao.findNearest(req.params.lon, req.params.lat);
                if(row === null) {
                    res.status(404).json({error: 'No nearest pano found'});
                } else {
                    res.json(row);
                }
            } else {
                res.status(400).json({error: "Valid lat/lon not provided"});
            }
        } catch(e) {
            res.status(500).json({error: e});
        }
    }

    async findByBbox(req, res) {
        try {
            const bbox = req.query.bbox.split(',').filter( (value,i) => /^[\d\-\.]+$/.exec(value) && (value>=-90 && value<=90 || (i%2==0 && value>=-180 && value<=180))).map (value => parseFloat(value));
            if(bbox.length == 4 && bbox[0] < bbox[2] && bbox[1] < bbox[3])  {
                const rows = await req.panoDao.findByBbox(bbox);
                res.json({
                    features: rows.map ( row => {
                        const props = { };
                        Object.keys(row).forEach(k => {
                            if(['lon', 'lat'].indexOf(k) == -1) {
                                props[k] = row[k];
                            }
                        });
                        return {
                            geometry: {
                                type: "Point",
                                coordinates: [ row.lon, row.lat ]
                            },
                            properties: props,
                            type: "Feature"
                        } 
                    }),
                    type: 'FeatureCollection'
                });
            } else {
                res.status(400).json({error: 'Valid bounding box not provided'});
            }
        } catch(e) {
            res.status(500).json({error: e});
        }    
    }

    async rotate(req, res) {
        try {
            const rowCount = await req.panoDao.rotate(req.params.id, req.body.pan, req.body.tilt, req.body.roll);
            res.status(rowCount > 0 ? 200 : 404).json({'rotated': rowCount});
        } catch(e) {
            res.status(500).json({error: e});
        }
    }

    async move(req, res) {
        try {
            const updatedRows = await req.panoDao.move(req.params.id, req.body.lon, req.body.lat);
            res.status(updatedRows > 0 ? 200 : 404).json({'moved': updatedRows });
        } catch(e) {
            res.status(500).json({error: e});
        }
    }

    async moveMulti(req, res) {
        try {
            const moved = [], unmoved = [];
            for(let obj of req.body.panos) {
                const pano = await req.panoDao.findById(obj.id);
                const updatedRows = await req.panoDao.move(obj.id, obj.lon, obj.lat);
                if(updatedRows == 1) {
                    moved.push(obj.id);
                } else {
                    unmoved.push(obj.id);
                }
            }
            res.status(200).json({moved: moved, unmoved: unmoved});
        } catch(e) {
            res.status(500).json({error: e});
        }
    }

    async upload(req, res) {
        const warnings = [ ];
        if(req.files.file) {
            try {
                const data = await exifr.parse(req.files.file.tempFilePath, {
                    xmp: true
                });
                let geom;
                if(data?.latitude === undefined || data?.longitude === undefined) {
                    warnings.push("No latitude and longitude in panorama; you'll have to later position manually");
                    geom = null;
                } else {
                    geom = `POINT(${data.longitude} ${data.latitude})`;
                }
                if(data?.PoseHeadingDegrees === undefined) {
                    warnings.push("No orientation information; you'll have to later rotate manually");
                }
                const id = await req.panoDao.addPano(geom, data?.PoseHeadingDegrees || 0, null, req.session?.user?.userid || null);
                if(id > 0) {
                    const returnData = {
                        id: id
                    };
                    if(warnings.length > 0) {
                        returnData.warning = warnings;
                    }
                    req.files.file.mv(`${process.env.RAW_UPLOADS}/${returnData.id}.jpg`);
                    res.json(returnData);
                } else {
                    res.status(500).json({error: 'Panorama could not be added to database'});
                }
            } catch(e) {
                res.status(500).json({error: e.toString()});
            }
        } else {
            res.status(400).json({error: `File not uploaded successfully - ensure it is no larger than ${process.env.MAX_FILE_SIZE} MB.`});
        }
    }

    async findNearby(req, res) {
        try {
            const rows = await req.panoDao.findNearby(req.params.lon, req.params.lat, req.params.limit);
            res.json(rows);
        } catch (e) {
            res.status(500).json({error: e});    
        }
    }

    async findUnauthorised(req, res) {
        try {
            const rows = await req.panoDao.findUnauthorised();
            res.json(rows);
        } catch (e) {
            res.status(500).json({error: e});    
        }
    }

    async findUnpositioned(req, res) {
        try {
            const rows = await req.panoDao.findUnpositioned(req.session?.user?.userid);
            res.json(rows);
        } catch (e) {
            res.status(500).json({error: e});    
        }
    }


    async findMine(req, res) {
        try {
            const rows = await req.panoDao.findByUser(req.session?.user?.userid);
            res.json(rows);
        } catch(e) {
            res.status(500).json({error: e});
        }
    }

    async createSequence(req, res) {
        try {
            const panos = (await Promise.all( req.body.map ( id =>  { return req.panoDao.findById(id) } )
            )).filter(pano => pano != null);
            
            if(panos.length > 0) {
                const seqid = await req.panoDao.createSequence(panos);
                res.status(seqid>0 ? 200: 400).send({seqid: seqid});
            } else {
                res.status(404).json({error: "No pano IDs could be found."});
            }
        } catch(e) {
            res.status(500).json({error: e});    
        }
    }

    async getSequence(req, res) {
        try {
            const seq = await req.panoDao.getSequence(req.params.id);
            if(seq === null) {
                res.status(404).json({error: "No sequence with that ID could be found."});
            } else {
                res.json(seq);
            }
        } catch(e) {
            res.status(500).json({error: e});    
        }
    }
}

