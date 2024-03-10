import 'dotenv/config';
import express from 'express';
import panoramaRouter from '../routes/panorama.mjs';
import fileUpload from 'express-fileupload';
import db from '../db/index.mjs';
import PanoDao from '../dao/panorama.mjs';


export default function (app) {
    app.use(express.json());

    app.use(fileUpload({
        useTempFiles: true,
        tempFileDir: process.env.TMPDIR, 
        limits: { fileSize: process.env.MAX_FILE_SIZE * 1024 * 1024 }
    }));

    return {
        initDao: (req, res, next) => {
            req.panoDao = new PanoDao(db);
            next();
        },
        panoRouter: panoramaRouter
    };
};
