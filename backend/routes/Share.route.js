const express = require('express');
const router = express.Router();

const tokenMiddleware = require("../middleware/Token.middleware");

// Controllers
const {
    generateLink,
    shareURL,
    generateMedia
} = require("../controllers/Share.controller");

// Generate
router.post("/:token/generate", tokenMiddleware, generateLink);

// Share
router.get("/i/:id", shareURL);

// Get Image
router.get("/i/:id/media", generateMedia);

module.exports = router;