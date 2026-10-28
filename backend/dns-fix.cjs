const dns = require("node:dns");

dns.setServers(["8.8.8.8", "1.1.1.1"]);

console.log("Custom DNS servers configured.");