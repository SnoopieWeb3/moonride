const asyncHandler = require("express-async-handler");
const psql = require("../database/connection");
const { pointsDistribution, metadataURL } = require("../lib/utils");
const { generatePnLCard } = require("../lib/generator");

const generateLink = asyncHandler(async (req, res) => {

    const {
        data = null
    } = req.body;

    const marketStore = req.app.locals.marketStore;

    try {

        if (data == null) {
            return res.status(401).json({
                status: "error",
                message: "Data must be provided"
            });
        }

        const marketSymbol = data?.symbol?.toUpperCase() || null;

        if (!marketStore?.markets.hasOwnProperty(marketSymbol)) {
            return res.status(200).json({
                status: "error",
                message: "Market symbol must be associated with a registered market"
            });
        }

        const user = req.account;

        const time = Math.floor(new Date().getTime() / 1000);

        try {

            await psql.query('BEGIN');

            const winQuery = await psql.query({
                text: `INSERT INTO win_shares (outcome_index, address, symbol, stake, won, round, direction, date_created)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                    ON CONFLICT (address, symbol, round) 
                    DO UPDATE SET address = EXCLUDED.address
                    RETURNING id, (xmax = 0) AS inserted
                `,
                values: [data.index, user.address, data.symbol, (data.stake * 1e18), (data.amountWon * 1e18), data.round, data.resolution, time]
            });

            const marketRound = marketStore.markets[marketSymbol].round;

            const userRound = parseFloat(data.round);

            const result = winQuery.rows[0];

            const id = result.id;

            if (result.inserted == true) {
                const difference = (marketRound - userRound);
                if (difference <= 3) {
                    if (data.index == "won") {
                        await psql.query({
                            text: `UPDATE accounts SET points = points + $1, leaderboard_points = leaderboard_points + $1 WHERE address = $2`,
                            values: [pointsDistribution.forSharing, user.address]
                        });
                    }
                }
            }

            await psql.query('COMMIT');

            const url = `${req.protocol}://${req.get('host')}/share/i/${id}`;

            return res.status(200).json({
                status: "success",
                url
            });

        }
        catch (error) {

            await psql.query('ROLLBACK');
            throw error;

        }

    }
    catch (error) {

        console.log(error);

        return res.status(401).json({
            status: "error",
            message: "Failed to generate share link"
        });

    }

});

const shareURL = asyncHandler(async (req, res) => {

    const {
        id = null
    } = req.params;

    const shareId = parseFloat(id) || null;

    try {

        const exists = await psql.query({
            text: `SELECT * FROM win_shares WHERE id = $1 LIMIT 1`,
            values: [shareId]
        });

        if (exists.rows.length == 0) {
            return res.status(401).json({
                status: "error",
                message: "Invalid url"
            });
        }

        const result = exists.rows[0];

        const url = `${req.protocol}://${req.get('host')}/share/i/${id}/media`;

        res.send(`
            <!DOCTYPE html>
            <html>
                <head>
                    <title>📈 PNL Card | moonride.fun</title>
                    <link rel="shortcut icon" href="${metadataURL}/logo.png"/>
                    <meta name="twitter:card" content="summary_large_image" />
                    <meta name="twitter:site" content="${metadataURL}" />
                    <meta property="og:url" content="${metadataURL}/" />
                    <meta property="og:type" content="website" />
                    <meta name="twitter:title" content="📈 PNL Card | moonride.fun" />
                    <meta property="og:description" content="Staked: ${(result.stake / 1e18).toLocaleString(undefined, { maximumFractionDigits: 6 })} → Won: ${(result.won / 1e18).toLocaleString(undefined, { maximumFractionDigits: 6 })}" />
                    <meta name="twitter:image" content="${url}" />
                    <meta property="og:image" content="${url}" />
                </head>
                <body>
                    <script>window.location.replace("${metadataURL}/")</script>
                </body>
            </html>
        `);

    }
    catch (error) {

        console.log(error);

        return res.status(401).json({
            status: "error",
            message: "Invalid url"
        });

    }

});


const generateMedia = asyncHandler(async (req, res) => {

    const {
        id = null
    } = req.params;

    const shareId = parseFloat(id) || null;

    try {

        const exists = await psql.query({
            text: `SELECT * FROM win_shares WHERE id = $1 LIMIT 1`,
            values: [shareId]
        });

        if (exists.rows.length == 0) {
            return res.status(401).json({
                status: "error",
                message: "Invalid url"
            });
        }

        const result = exists.rows[0];

        const image = await generatePnLCard(result);

        res.set('Content-Type', 'image/png');
        res.send(image);

    }
    catch (error) {

        console.log(error);

        return res.status(401).json({
            status: "error",
            message: "Invalid url"
        });

    }

});

module.exports = {
    generateLink,
    shareURL,
    generateMedia
};