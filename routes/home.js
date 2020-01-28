/**
 * Routes Main
 */
const { ExpressRouter } = require("../lib/express-application");

class HomeRouter extends ExpressRouter {
  constructor() {
    super();
    this.get("/", this.getHome);
  }

  getHome(req, res, next) {
    const params = { title: "Boostrap" };
    if (typeof req.csrfToken == "function") {
      params.csrfToken = req.csrfToken();
    }
    res.render("index", params);
  }
}

module.exports = new HomeRouter();