import DemApplier from 'jsfreemaplib/DemApplier.js';
import { JsonTiler } from 'jsfreemaplib';
import DemTiler from 'jsfreemaplib/demtiler.js';

class OsmLoader {

    constructor(viewer, osmurl, demurl) {
        this.viewer = viewer;
        const osmTiler = new JsonTiler(osmurl);
//        const demTiler = new DemTiler(demurl);
        osmTiler.setZoom(15);
        this.osmTiler = osmTiler;
 //       demTiler.setZoom(15);
  //      this.demApplier = new DemApplier(demTiler, osmTiler);
        this.allowedTypes = ["path", "footway", "bridleway", "track", "steps"];
        this.dataReducer = (acc, curVal) => { acc.push(...curVal.data.features); return acc; };
    }

    async update(lonLat) {
//        const tiles = await this.demApplier.update(lonLat);
        const p = this.osmTiler.sphMerc.project(lonLat[0], lonLat[1]);
        const osmTiles = await this.osmTiler.update(p);
        const tiles = this.osmTiler.getCurrentTiles();
        const osmData = {
            features: tiles.reduce(this.dataReducer, []),
            type: "FeatureCollection"
        };
        /*
        tiles.forEach ( tile => {
            tile.data.features.forEach ( feature => {
                if(feature.geometry.type == 'LineString' && this.allowedTypes.indexOf(feature.properties.highway) > -1) {
                        this.viewer.addPath(feature.geometry.coordinates.filter (coord => coord[2] > 0));
                    } catch(e) { 
                        console.warn("Error occurred in OpenWanderer.Viewer.addPath() - ignoring for now as only affects rendered data"); 
                    } // TODO examine error in addPath() - squelch for now as most ways are rendered successfully
                }
            });
        });
        */
        console.log('Got OSM data with elevation. Now calculating routes to nearby...');
        return osmData;
    }

    getElevation(lon, lat) {
        return this.demApplier.demTiler.getElevationFromLonLat(lon, lat);
    }
}

export default OsmLoader;    
