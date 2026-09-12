const app = require("./src/app");
const config = require("./src/config");

app.listen(config.port, "0.0.0.0", () => {
console.log("-----------------------------------------");
console.log(`Lavoro is running at http://localhost:${config.port}`);
console.log(`Health check: http://localhost:${config.port}/api/health`);
console.log("-----------------------------------------");
});
