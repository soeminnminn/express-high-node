const dotenv = require('dotenv');

const config = dotenv.config();
if (config.error) {
  throw config.error;
}
module.exports = config.parsed;