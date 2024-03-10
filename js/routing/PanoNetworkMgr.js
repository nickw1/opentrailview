import jsFreemaplib from 'jsfreemaplib';
import PathFinder from 'geojson-path-finder-nw'
const BoundingBox = jsFreemaplib.BoundingBox;
import { point as turfPoint } from '@turf/helpers';
import turfBearing from '@turf/bearing'; 
import JunctionManager from './JunctionManager.js';

class PanoNetworkMgr {

    constructor(options) {
        this.options = options || { };
        this.options.nearbyApi = this.options.nearbyApi || 'panorama/nearby/{lon}/{lat}/500';
    }

    doLoadNearbys (curPano, geojson) {
        console.log(`GeoJSON has ${geojson.features.length} features.`);
        return new Promise ( (resolve, reject) => {
            const allPanos = [];
            curPano.lon = parseFloat(curPano.lon);
            curPano.lat = parseFloat(curPano.lat);
            curPano.ele = parseFloat(curPano.ele);
            curPano.poseheadingdegrees = parseFloat(curPano.poseheadingdegrees);

            fetch(this.options.nearbyApi.replace('{lon}',curPano.lon).replace('{lat}', curPano.lat))
                .then(resp => resp.json())
                .then(nearbys=> {
                    allPanos.push(curPano);
                    nearbys.forEach (nearby => { 
                        nearby.lon = parseFloat(nearby.lon);
                        nearby.lat = parseFloat(nearby.lat);
                        nearby.ele = parseFloat(nearby.ele);
                        allPanos.push(nearby);
                    } );    
            
                    geojson = this.insertIntoNetwork(geojson, allPanos);
                    // let includedNearbys = [];

                    const pathFinder = new PathFinder(geojson, { precision: 0.00001, edgeDataReduceFn: (e)=> { } } );
                    const jMgr = new JunctionManager(pathFinder)
                    const routingNodes = [ null, null ];
                    routingNodes[0] = jMgr.snapToJunction([curPano.lon, curPano.lat, curPano.ele], 0.005);
                    //routingNodes[0] = [curPano.lon, curPano.lat, curPano.ele, curPano.id];
                    nearbys.forEach(nearby=> {
                        nearby.lon = parseFloat(nearby.lon);
                        nearby.lat = parseFloat(nearby.lat);
                        nearby.poseheadingdegrees = parseFloat(nearby.poseheadingdegrees);
                        nearby.bearing = 720;
                        routingNodes[1] = jMgr.snapToJunction([nearby.lon, nearby.lat, nearby.ele], 0.005);
                        //routingNodes[1] = [nearby.lon, nearby.lat, nearby.ele, nearby.id];
                        
                        const route = this.calcPath(pathFinder, routingNodes);
                        
                        if(route!=null && route.path.length>=2) {
                            let bearing = turfBearing(turfPoint(route.path[0]), turfPoint(route.path[1]));

                            if(bearing < 0) bearing += 360;
                            nearby.bearing = bearing;
                            nearby.route = route;
                            nearby.route.panoIndices = [];
                            const tmpIds = [];
                            for(let i=0; i < route.path.length; i++) {
                                if(route.path[i][3] !== undefined) {
                                    nearby.route.panoIndices.push(i);
                                    tmpIds.push(route.path[i][3]);
                                }
                            }
                            nearby.route.panoIds = tmpIds.join(',');
                        }
                    });
                    const sorted = nearbys.filter((nearby)=>nearby.bearing<=360).sort((nearby1,nearby2)=>(nearby1.bearing-nearby2.bearing)); 
                    let lastBearing = 720;
                    const includedBearings = [];
                    let curNearbys = [];
                    const nearbysSortedByBearing = [];
        
                    for(let i=0; i<sorted.length; i++) {
                        if(Math.abs(sorted[i].bearing-lastBearing) >= 2) {
                        // new bearing
                            includedBearings.push(sorted[i].bearing);
                            curNearbys = [];
                            nearbysSortedByBearing.push(curNearbys);
                        }
                        curNearbys.push(sorted[i]);
                        lastBearing = sorted[i].bearing;
                    }

                    const outputPanos = { };

                    nearbysSortedByBearing.forEach ( n=> {
                        const panosForBearingSorted =  n.sort((n1, n2) => n1.route.weight - n2.route.weight).map ( pano => {
                                    return {
                                        id: pano.id,
                                        lat: pano.lat,
                                        lon: pano.lon,
                                        ele: pano.ele,
                                        bearing: Math.round(pano.bearing),
                                        route: {
                                            path: pano.route.path,
                                            weight: pano.route.weight,
                                            panoIds: pano.route.panoIds,
                                            panoIndices: pano.route.panoIndices
                                        }
                                    };
                                });
                        outputPanos[panosForBearingSorted[0].bearing] = panosForBearingSorted; 
                        
                    });
                    resolve(outputPanos);
            });
        });
    }


    insertIntoNetwork (json, allPanos) {
        let newFeatures = [];
        let k = 0, z = 0;
        json.features.forEach( way => { way.bbox = jsFreemaplib.getBoundingBox(way.geometry.coordinates); });
        allPanos.forEach(poi => {
            let point = [poi.lon, poi.lat, poi.ele];
            poi.overallLowestDist= { distance: Number.MAX_VALUE };
            json.features.filter(way => way.bbox.contains(point)).forEach(way => {
                
                let lowestDist = {distance: Number.MAX_VALUE}, idx = -1, curDist;
                for(let j=0; j<way.geometry.coordinates.length-1; j++) {
                    curDist = jsFreemaplib.haversineDistToLine(
                            poi.lon,     
                            poi.lat, 
                            way.geometry.coordinates[j], 
                            way.geometry.coordinates[j+1]);    
                    if(curDist!==null && curDist.distance >=0 && curDist.distance < lowestDist.distance) {
                        lowestDist=curDist;
                        idx=j;
                    }
                }    

                
                if(idx >=0 && lowestDist.distance < 10.0) {
                    // it has to be within 10m of a way 
                    // We don't yet actually try and split the way though
                    // We need to ensure the POI is inserted into the
                    // CORRECT way (the closest) - aka the "panorama 16
                    // problem". So for the moment we
                    // just create an array of POTENTIAL splits for this
                    // POI, and take the one closest to a way later.
                    if(lowestDist.distance < poi.overallLowestDist.distance) {
                        poi.overallLowestDist.distance = lowestDist.distance;
                        poi.overallLowestDist.idx = idx + lowestDist.proportion;
                        poi.overallLowestDist.way = way;
                    }
                }
            }); 
        } ); 

        const allSplits = {};

        // allSplits will now contain all COUNTED splits (one split per POI),
        // indexed by way ID, so we can then go on and consider all real splits
        // for a way, as we did before.
        // don't need this now 
        allPanos.filter(poi => poi.overallLowestDist.distance < Number.MAX_VALUE).forEach(poi => {
            const way = poi.overallLowestDist.way;
            if(allSplits[way.properties.osm_id] === undefined) allSplits[way.properties.osm_id] = [];
            allSplits[way.properties.osm_id].push({idx: poi.overallLowestDist.idx, poi: poi, way: way});
        });

        // now we need to loop through the ways again 
        json.features.forEach ( way => {
            let splits = allSplits[way.properties.osm_id];    
            // this was originally in the ways loop
            if(splits && splits.length>0) {
                splits = splits.sort((a,b)=>a.idx-b.idx);
                let splitIdx = 0;
                let newWay = this.makeNewWay(way); 
                let i = 0;
                while (i < way.geometry.coordinates.length) {
                    newWay.geometry.coordinates.push([way.geometry.coordinates[i][0], way.geometry.coordinates[i][1]]);
                    while(splitIdx < splits.length && Math.floor(splits[splitIdx].idx) == i) {

                        newWay.geometry.coordinates.push([splits[splitIdx].poi.lon, splits[splitIdx].poi.lat, splits[splitIdx].poi.ele, splits[splitIdx].poi.id]);
                        splitIdx++;
                    }
                    i++;    
                }
                newFeatures[k++] = newWay;
            } else {
                newFeatures[k++] = way;
            }
        });
        json.features = newFeatures;
        return json;
    }

    calcPath (pathFinder, points) {

        const f1 = { geometry: { type: 'Point',
            coordinates: points[0] }},
            f2 = { geometry: { type: 'Point',
            coordinates: points[1] }};

        return pathFinder.findPath(f1, f2);
    }

    makeNewWay(way) {
        const newWay = {type:'Feature'};
        newWay.properties =  way.properties; 
        newWay.geometry = {};
        newWay.geometry.type =  'LineString';
        newWay.geometry.coordinates = [];
        return newWay;
    }
}

export default PanoNetworkMgr;

