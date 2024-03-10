import { AuthorizationCode } from 'simple-oauth2';
import fetch from 'node-fetch';
import { XMLParser } from 'fast-xml-parser';

class OSMController {
    constructor() {
        this.config = {
            client: {
                id: process.env.OSM_ID, 
                secret: process.env.OSM_SECRET 
            },
            auth: {
                tokenHost: 'https://www.openstreetmap.org',
                tokenPath: '/oauth2/token',
                authorizePath: '/oauth2/authorize'
            }
        };

        this.client = new AuthorizationCode(this.config);
        this.authorizationUri = this.client.authorizeURL({
            redirect_uri: process.env.OSM_CALLBACK_URL, 
            scope: 'read_prefs',
        });
    }

    login(req, res) {
        res.redirect(this.authorizationUri);
    }

    async callback(req, res) {
        if(req.query.code) {
            try {
                const accessToken = await this.client.getToken({
                    code: req.query.code,
                    redirect_uri: process.env.OSM_CALLBACK_URL 
                });
                const token = accessToken.token.access_token;
                const userDetails = await this.getUserDetails(token);
                if(userDetails) {
                    req.session.user = userDetails;
                    req.session.save(() => {
                        res.redirect('../..');
                    });
                }
            } catch(e) {
                res.status(401).json({error: e.message});
            }
        } else {
            res.status(401).json({'error': 'No authorisation code obtained.'});
        }
    }

    async getUserDetails(token) {
        const response = await fetch('https://api.openstreetmap.org/api/0.6/user/details', {
            headers: {
                'Authorization' : `Bearer ${token}`
            }
        });
        const text = await response.text();
        const parser = new XMLParser({
            ignoreAttributes: false
        });
        const jObj = parser.parse(text);
        return {
            userid: `o${jObj.osm.user['@_id']}`, 
            username: jObj.osm.user['@_display_name'],
            osm: true,
            isadmin: 0
        };
    }
}

export default OSMController; 
