const express = require('express');
const router = express.Router();

const tokenMiddleware = require("../middleware/Token.middleware");

// Controllers
const {
    register,
    getProfile,
    getLeaderboard,
    getAds,
    editUsername
} = require("../controllers/Auth.controller");

// Register
router.post("/register/:refCode?", register);

// Edit username
router.post("/:token/username/set", tokenMiddleware, editUsername);

// Get Profile
router.get("/:token/profile", tokenMiddleware, getProfile);

// Get Leaderboard
router.get("/:token/:symbol/leaderboard", getLeaderboard);

// Get Ads
router.get("/:token/ads/get", getAds);

module.exports = router;