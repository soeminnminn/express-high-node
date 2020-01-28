/**
 * Main Application
 */
const cookieParser = require("cookie-parser");
const path = require("path");
const session = require("express-session");
const { ExpressApplication } = require("./lib/express-application");
const passport = require("./config/passport-config");
const csrf = require("./lib/csrf");

class MainApp extends ExpressApplication {
  constructor() {
    super(__dirname);

    // uncomment after under construction
    // this.isUnderConstruction = true;

    this.urlencodedOptions.extended = true;
  }

  onUseViewEngine(app) {
    // view engine setup
    this.set("views", path.join(__dirname, "./views/pages"));
    this.set("view engine", "pug");
  }

  onUseMiddleWares(app) {
    this.use(cookieParser());
    this.useStatic("./public");
    this.use(session({ secret: "{session_secret}", resave: true, saveUninitialized: true })); // must change session secret

    this.use(passport.initialize());
    this.use(passport.session());

    this.use(csrf());
  }

  onUseRouter(app) {
    this.loadRouters("./routes");
  }
}

const app = new MainApp();
module.exports = app.create();