import 'dotenv/config';

import express from 'express';
import expressSession from 'express-session';
import connectPg from 'connect-pg-simple';
const pgSession = connectPg(expressSession);
import fetch from 'node-fetch';
import fileUpload from 'express-fileupload';
import UserDao  from './dao/user.mjs';

import initServer  from './helpers/initServer.mjs';

import mapRouter from './routes/map.mjs';
import userRouter from './routes/user.mjs';
import osmRouter from './routes/osm.mjs';

import auth from './middleware/authcheck.mjs';
const { loginCheck, adminCheck, ownerOrAdminCheck } = auth;

const app = express();
app.set('trust proxy', 1);

app.use(express.static('public'));


const { initDao, panoRouter } = initServer(app);
app.use('/panorama', initDao);


app.use('/map', mapRouter);

import cors from 'cors';
app.use(cors());
import db from './db/index.mjs';

app.use(expressSession({
    store: new pgSession({
        pool: db,
        tableName: 'sessions1',
        createTableIfMissing: true
    }), 
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    rolling: true,
    unset: 'destroy',
    proxy: true, 
    cookie: {
        maxAge: 600000,
        httpOnly: false
    }
}));
 
app.post('/user/login', (req, res, next) => {
    if(req.body.username == "" || req.body.password == "") {
        res.status(400).json({error: 'Missing login details.'});
    } else {
        next();
    }
});

app.use('/user', userRouter);
app.use('/osm', osmRouter);

app.post(['/panorama/:id(\\d+)/move',
        '/panorama/:id(\\d+)/rotate'], loginCheck, ownerOrAdminCheck);
app.delete('/panorama/:id', loginCheck, ownerOrAdminCheck);

app.post(['/panorama/upload', '/panorama/sequence/create', '/panorama/mine', '/panorama/unpositioned'], loginCheck);

app.get(['/panorama/unauthorised', '/panorama/:id(\\d+).r:width(\\d+).rawupload.jpg', '/panorama/:id(\\d+).rawupload.jpg'], adminCheck);
app.post(['/panorama/moveMulti', '/panorama/:id(\\d+)/authorise'], adminCheck);

app.use('/panorama', panoRouter);

app.get('/terrarium/:z(\\d+)/:x(\\d+)/:y(\\d+).png', async(req, res) => {
    const response = await fetch(`https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${req.params.z}/${req.params.x}/${req.params.y}.png`); 
    res.set({'Content-Type': 'image/png'});
    response.body.pipe(res);
});

app.get('/nomproxy', async(req, res) => {

    const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${req.query.q}`, {
        headers: {
            'User-Agent': 'OpenTrailView 4',
            'Referer': 'https://opentrailview.org'
        }
    });
    res.set({'Content-Type': 'application/json'});
    response.body.pipe(res);
});

app.get('/geoapify/:z(\\d+)/:x(\\d+)/:y(\\d+).png', async(req, res) => {
    const resp = await fetch(`https://maps.geoapify.com/v1/tile/carto/${req.params.z}/${req.params.x}/${req.params.y}.png?&apiKey=${process.env.MAPS_API_KEY}`);
    res.set({'Content-Type': 'image/png'});
    resp.body.pipe(res);

});

app.listen(3000);
