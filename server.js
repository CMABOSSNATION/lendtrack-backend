const express = require("express");
const cors = require("cors");
require("dotenv").config();

const app = express();

app.use(cors({ origin: process.env.FRONTEND_URL || "*" }));
// Increase JSON body limit to 10MB to accommodate base64 photos
app.use(express.json({ limit: "10mb" }));

// Routes
app.use("/api/auth", require("./routes/auth_UG"));
app.use("/api/borrowers", require("./routes/borrowers"));
app.use("/api/loans", require("./routes/loans"));
app.use("/api/payments", require("./routes/payments"));
app.use("/api/dashboard", require("./routes/dashboard"));

app.get("/", (req, res) => res.json({ status: "LendTrack API running" }));

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`LendTrack API on port ${PORT}`));
