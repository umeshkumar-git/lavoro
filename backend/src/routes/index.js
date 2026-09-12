const express = require("express");
const aiRoutes = require("./aiRoutes");
const authRoutes = require("./authRoutes");
const dashboardRoutes = require("./dashboardRoutes");
const integrationRoutes = require("./integrationRoutes");
const jobsRoutes = require("./jobsRoutes");
const ragRoutes = require("./ragRoutes");

const router = express.Router();

router.use("/ai", aiRoutes);
router.use("/auth", authRoutes);
router.use("/dashboard", dashboardRoutes);
router.use("/integrations", integrationRoutes);
router.use("/jobs", jobsRoutes);
router.use("/rag", ragRoutes);

module.exports = router;
