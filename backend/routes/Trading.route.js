const express = require('express');
const router = express.Router();

const tokenMiddleware = require("../middleware/Token.middleware");

// Controllers
const {
    withdraw,
    order,
    getOrders,
    cancelAuto,
    getEntryStatus,
    batchWithdrawals,
    getHistory
} = require("../controllers/Trading.controller");

// Withdraw
router.post("/:token/withdraw", tokenMiddleware, withdraw);

// Execute order
router.post("/:token/order/:symbol/:direction/:betType", tokenMiddleware, order);

// Cancel Auto-stake
router.post("/:token/auto/stake/:symbol/cancel", tokenMiddleware, cancelAuto);

// Get orders
router.get("/orders/:symbol/get", getOrders);

// Get History
router.get("/:token/history/:transactionType/get", tokenMiddleware, getHistory);

// Get entry status
router.get("/:token/entry/:symbol/get", tokenMiddleware, getEntryStatus);

// Batch withdraw
router.get("/withdraw/users/all", batchWithdrawals);

module.exports = router;