export default {
    loginCheck: function(req, res, next) {
        if(req.session.user && req.session.user.userid) {    
            next();
        } else {
            res.status(401).json({error: "Must be logged in to perform this operation."});
        }
    },

    adminCheck: function(req, res, next) {
        if(req.session.user && req.session.user.isadmin === 1) {
            next();
        } else {
            res.status(401).json({error: "Must be administrator to perform this operation."});
        }
    },

    ownerOrAdminCheck : async function(req, res, next) {
        const panoInfo = await req.panoDao.findById(req.params.id);
        console.log(`pano userid: ${panoInfo.userid}. session userid: ${req.session.user.userid}`);
        if(req.session.user.isadmin === 1 || (panoInfo && panoInfo.userid == req.session.user.userid)) {
            next();
        } else {
            res.status(401).json({error: "Not authorised to perform this operation."});
        }
    }
};
