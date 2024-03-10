import bcrypt from 'bcrypt';

class UserDao {

    constructor(db) {
        this.db = db;
    }

    async login(username, password) {
        const dbres = await this.db.query('SELECT * FROM users WHERE username=$1', [username]);
        
        return dbres.rows.length == 1 && await bcrypt.compare(password, dbres.rows[0].password.replace('$2y$', '$2b$')) ?  {
                    username: dbres.rows[0].username, 
                    userid:  dbres.rows[0].id,
                    isadmin: dbres.rows[0].isadmin    
        } : null;
    }

    async signup(username, password) {
        const hashedPassword = await bcrypt.hash(password, 10);
        const dbres = await this.db.query("INSERT INTO users(username, password) VALUES ($1, $2)", [username, hashedPassword]);
    }

    async getUser(username) {
        const dbres = await this.db.query('SELECT * FROM users WHERE username=$1', [username]);
        return dbres.rows.length > 0 ? {
            userid: dbres.rows[0].id,
            username: dbres.rows[0].username,
            isadmin: dbres.rows[0].isadmin 
        }: null;
    }

    async findUserById(userid) {
        const dbres = await this.db.query('SELECT * FROM users WHERE id=$1', [userid]);
        return dbres.rows.length > 0 ? {
            userid: dbres.rows[0].id,
            username: dbres.rows[0].username,
            isadmin: dbres.rows[0].isadmin 
        }: null;
    }
}

export default UserDao;
