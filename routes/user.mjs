import express from 'express';
const router = express.Router();
import db from '../db/index.mjs';

import UserController from '../controllers/user.mjs';
const userController = new UserController(db);

router.post('/login', userController.login.bind(userController));
router.get('/login', userController.getLogin.bind(userController));
router.post('/logout', userController.logout.bind(userController));
router.post('/signup', userController.signup.bind(userController));

export default router;
