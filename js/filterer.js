import jsfreemaplib  from 'jsfreemaplib';
//import exifr from 'exifr';
// Webpack is having problems with the ES6 module provided with exifr
import exifr from 'exifr/dist/full.esm.js';

class Filterer {

    constructor(limit) {
        this.limit = limit || 20; 
        this.roads = ['motorway', 'trunk', 'primary', 'secondary', 'tertiary', 'unclassified', 'residential', 'motorway_link', 'trunk_link', 'secondary_link', 'tertiary_link', 'unclassified_link', 'residential_link' ];
        this.filterRoads = false;
        this.snap = false;
    }

    setProgressHandler(handler) {
        this.progressHandler = handler;
    }

    async fullFilter(inFiles) {
        console.log(`Filtering by size`);
        const files = Array.from(inFiles).filter (file => file.size < 8388608);
        console.log(`after size, ${files.length} left`);
        const exifs = await this.filterPanos(files); 
        console.log(`After filterPanos(), ${exifs.includedFiles.length} left`);
        let files2 = { includedFiles: [] };
        if(this.filterRoads === true || this.snap === true) {    
            this.progressHandler('Filtering out panoramas on roads...');
            files2.warnings = exifs.warnings;
            for(let i=0; i<exifs.includedFiles.length; i++) {
                if(exifs.includedFiles[i].latitude !== undefined && exifs.includedFiles[i].longitude !== undefined) {
                    const json = await fetch (`/map/nearestHighway?lat=${exifs.includedFiles[i].latitude}&lon=${exifs.includedFiles[i].longitude}&dist=20`).then(response => response.json());
                    if(!this.filterRoads || json.length == 0 || json[0].highway === undefined || this.roads.indexOf(json[0].highway) === -1) {
                        try {  
                        files2.includedFiles.push({ 
                            file: exifs.includedFiles[i].file, 
                            latitude: this.snap ? json.lat : exifs.includedFiles[i].latitude, 
                            longitude: this.snap ? json.lon : exifs.includedFiles[i].longitude,
                            PoseHeadingDegrees: json.PoseHeadingDegrees
                        });
                        } catch(e) {
                            console.error(e);
                        }
                    } 
                }
            }
            console.log(`Included ${files2.includedFiles.length} files.`);
            this.progressHandler(`${files2.length} panoramas not on roads.`);
        } else {
            files2 = exifs;//.map ( exif => exif.file );
        } 
        return files2;
    }

    async filterPanos(files) {
        this.startDate = new Date();
        let lastIncludedLat, lastIncludedLon;
        let warnings = [];
        const includedFiles = [];
        const exifs = [];
        for(let i=0; i<files.length; i++) {
            const exif = await this.getExif(files[i], i);
            if(this.progressHandler && !(i % 10)) {
                this.progressHandler(`Processing EXIF data for file ${i+1} of ${files.length}`);
            }
            exif.file = files[i];
//            if(exif.latitude !== undefined && exif.longitude !== undefined) {
                exifs.push(exif);
 //           }
        }
        exifs.sort ( (exif1, exif2) => exif1.timestamp - exif2.timestamp )
                .forEach ((exif, i) => {
            let included = true;
            if(this.progressHandler && !(i % 10)) {
                this.progressHandler(`Testing filter criteria for file ${i+1} of ${files.length}`);
            }
            if(exif.latitude === undefined || exif.latitude === undefined) {
                includedFiles.push(exif);
            } else if(lastIncludedLat !== undefined && lastIncludedLon !== undefined) {
                const dist = jsfreemaplib.haversineDist(exif.longitude, exif.latitude, lastIncludedLon, lastIncludedLat);
                if(dist >= this.limit) {
                    lastIncludedLon = exif.longitude;
                    lastIncludedLat = exif.latitude;
                    includedFiles.push(exif);
                }
            } else {
                lastIncludedLon = exif.longitude;
                lastIncludedLat = exif.latitude;
                includedFiles.push(exif);
            }
            
        });
        return {
            includedFiles : includedFiles,
            warnings: warnings
        };
    }

    async getExif(file, i) {
        try {
            const exif = await file.arrayBuffer().then(exifr.parse);
            exif.timestamp = exif.DateTimeOriginal ? new Date(exif.DateTimeOriginal).getTime(): this.startDate + i; 
            return exif;
        } catch(e) {
            return { longitude: 0, 
                     latitude: 0, 
                     timestamp: this.startDate + i 
            };
        }
    }
}

export default Filterer;

