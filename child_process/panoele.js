require('dotenv').config();
const PanoDao = require('../dao/panorama.js');
const db = require('../db');
const DemTiler = require('jsfreemaplib/demtiler');

const panoDao = new PanoDao(db);


setInterval(async() => {

    const unelevatedPanos = await panoDao.findNoElevation();

    const demTiler = new DemTiler('https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png');

    for(let i=0; i<unelevatedPanos.length; i++) {
        let pano = unelevatedPanos[i];
        await demTiler.update(demTiler.lonLatToSphMerc(pano.lon, pano.lat));
        const ele = demTiler.getElevationFromLonLat(pano.lon, pano.lat);
        if(ele != Number.NEGATIVE_INFINITY) {
            panoDao.setElevation(pano.id, ele);
        }
    }
}, 10000);
