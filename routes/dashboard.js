/**
 * Dashboard Router
 */
const { ExpressRouter } = require("../lib/express-application");

class DashboardRouter extends ExpressRouter {
  constructor() {
    super();
    this.route("/dashboard").all(this.onLoad).get(this.getDashboard);
  }

  onLoad(req, res, next) {
    if (req.isAuthenticated()) {
      next();
    } else {
      res.redirect(`/login?url=${req.url}`);
    }
  }

  getDashboard(req, res, next) {
    const params = { title: "Admin Dashboard" };
    if (typeof req.csrfToken == "function") {
      params.csrfToken = req.csrfToken();
    }
    res.render("dashboard/index", params);
  }
}

module.exports = new DashboardRouter();