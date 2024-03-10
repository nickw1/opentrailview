import express from 'express';
const router = express.Router();
import db  from '../db/index.mjs';
import MapController from '../controllers/map.mjs';

const controller = new MapController(db);

router.get('/', controller.byBbox.bind(controller));
router.get('/:z(\\d+)/:x(\\d+)/:y(\\d+).json', controller.byTile.bind(controller));
router.get('/nearestHighway', controller.findNearestHighway.bind(controller));
export default router;
