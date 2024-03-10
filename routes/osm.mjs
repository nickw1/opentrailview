import express from 'express';
import OSMController from '../controllers/osm.mjs';

const router = express.Router();

const osmController = new OSMController();

router.get('/login', osmController.login.bind(osmController));
router.get('/callback', osmController.callback.bind(osmController));

export default router;
