import turfDistance from '@turf/distance';
import { point as turfPoint }  from '@turf/helpers';

class JunctionManager {

    constructor(pathFinder) {
        this.pathFinder = pathFinder;
    }

    findNearestJunction(p) {
        const graph = this.pathFinder.serialize();
        const vertex = [ null, Number.MAX_VALUE ];
        let nEdges;

        const junctions = Object.keys(graph.vertices).filter ( k => {
            nEdges = Object.keys(graph.vertices[k]).length;
            return nEdges >= 3 || nEdges == 1;
        });

        junctions.forEach(k => {
            const dist = turfDistance(turfPoint(p), turfPoint(graph.sourceVertices[k]));
            if(dist < vertex[1]) {
                vertex[1] = dist;
                vertex[0] = graph.sourceVertices[k].slice(0);
            }
        });
        return vertex;
    }

    snapToJunction(p, distThreshold) {
        const p2 =  p.slice(0);
        const junction = this.findNearestJunction(p);
        if(junction[1] < distThreshold) {
            p2[0] = junction[0][0];
            p2[1] = junction[0][1];
        }
        return p2;
    }
}

export default JunctionManager;
