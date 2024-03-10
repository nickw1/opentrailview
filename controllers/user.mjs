import validator from 'validator';
import UserDao from '../dao/user.mjs';

class UserController {

    constructor(db) {
        this.dao = new UserDao(db);
    }

    async login(req, res) {
        try {
            const user = await this.dao.login(req.body.username, req.body.password);
            if(user === null) {
                res.status(401).json({error: "Invalid login"});
            } else {
                req.session.user = user;
                res.json(user);
            }
        } catch(e) {
            res.status(500).json({ error : e });
        }
    }

    async logout(req, res) {
        req.session.user = null;
        req.session = null;
        res.json({loggedout: true});
    }

    async getLogin(req, res) {
        res.json(req.session.user ? req.session.user : {username: null, userid: 0, isadmin: 0});
    }

    async signup(req, res) {
        try {
            
            if(!req.body.username || !req.body.password) {
                res.status(400).json({error: 'Please enter a username and password.'});
            } else if (!validator.isEmail(req.body.username)) {
                res.status(400).json({error: 'Not a valid email address.'});
            } else if(req.body.password != req.body.otv_password2) {
                res.status(400).json({error: 'Passwords do not match.'});
            } else {
                const dbres = await this.dao.getUser(req.body.username);
                if(dbres !== null) {
                    res.status(400).json({error: 'This username is already taken.'});
                } else {
                    await this.dao.signup(req.body.username, req.body.password);
                    res.json({username: req.body.username});
                }
            }
        } catch(e) {
            res.status(500).json({error: e});
        }
    }
}

export default UserController;
