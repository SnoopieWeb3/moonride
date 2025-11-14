const psql = require("../database/connection.js");

const { ethers } = require("ethers");

const { decrypt } = require("../lib/utils.js");

// Authenticated routes
const auth = async (req, res, next) => {

    try {

        const {
            token = null
        } = req.params;

        if (token == null) {
            return res.status(401).json({
                status: "error",
                message: "A valid token must be provided"
            });
        }

        const exists = await psql.query({
            text: `SELECT * FROM accounts WHERE token = $1 LIMIT 1`,
            values: [token]
        });

        if (exists.rows.length == 0) {
            return res.status(401).json({
                status: "error",
                message: "A valid token must be provided"
            });
        }

        const user = exists.rows[0];

        req.account = user;

        next();

    } catch (error) {

        return res.status(401).json({ status: "error", message: 'Failed to validate token' });

    }
};

module.exports = auth;