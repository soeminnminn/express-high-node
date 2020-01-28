/**
 * User Router
 */
const { ExpressRouter } = require("../lib/express-application");
const passport = require("../config/passport-config");

class UserRouter extends ExpressRouter {
  constructor() {
    super();

    /* Login route. */
    this.route("/login").get(this.getLogin).post(this.postLogin);
    /* Log out route */
    this.route("/logout").all(this.logout);
    /* Register route */
    this.route("/register").get(this.doSomething);
    /* Change password route */
    this.route("/changepwd").get(this.getChangePassword).post(this.postChangePassword);
  }

  static buildAlert(type, message) {
    const cssClass = (type == "error") ? "danger" : type;
    const title = type.toUpperCase();
    return `<div class='alert alert-${cssClass} alert-dismissible' role='alert'><strong>${title}:</strong> ${message}
  <button class='close' type='button' data-dismiss='alert' aria-label='Close'><span aria-hidden='true'>&times;</span></button>
  </div>`;
  }

  getLogin(req, res, next) {
    const params = { title: "Login" };
    params.url = req.query.url || "/";
    if (typeof req.csrfToken == "function") {
      params.csrfToken = req.csrfToken();
    }

    res.render("auth/login", params);
  }

  postLogin(req, res, next) {
    passport.authenticate("local", (err, user) => {
      const params = { title: "Admin Dashboard" };
      params.url = req.body.url || "/dashboard";
      if (typeof req.csrfToken == "function") {
        params.csrfToken = req.csrfToken();
      }

      if (err) {
        params.message = UserRouter.buildAlert("error", err.message);
        res.render("auth/login", params);

      } else if (!user) {
        params.message = UserRouter.buildAlert("error", "Invalid login user!");
        res.render("auth/login", params);

      } else {
        req.logIn(user, { session: true }, (errLogin) => {
          if (errLogin) {
            return next(err);
          }
          return res.redirect("/dashboard");
        });
      }
    })(req, res, next);
  }

  logout(req, res, next) {
    req.logOut();
    res.redirect("/");
  }

  getChangePassword(req, res, next) {
    if (req.isAuthenticated() && req.user) {
      const params = { title: "Admin Dashboard", params: req.user };
      params.url = req.query["url"] || "/dashboard";
      if (typeof req.csrfToken == "function") {
        params.csrfToken = req.csrfToken();
      }

      res.render("auth/changepassword", params);
    } else {
      res.redirect(`/login?url=${req.url}`);
    }
  }

  postChangePassword(req, res, next) {
    const redirectUrl = req.body.redirecturl || "/dashboard";
    const outFunc = (data, msgtype, msg) => {
      const params = { title: "Admin Dashboard", params: data, url: redirectUrl };
      params.message = UserRouter.buildAlert(msgtype, msg);
      if (typeof req.csrfToken == "function") {
        params.csrfToken = req.csrfToken();
      }

      res.render("auth/changepassword", params);
    };

    if (req.isAuthenticated() && req.user) {
      const data = req.body;
      const user = req.user;
      const id = user.id || 0;
      const password = user.password || "";

      if (data.id && data.id == id) {
        const oldpassword = passport.md5(data.oldpassword);
        if (password != oldpassword) {
          outFunc(data, "error", "Old Password does not match!");

        } else if (data.password != data.repassword) {
          outFunc(data, "error", "Confirm Password does not match!");

        } else {
          const saveData = {
            id: id,
            usertype: user.usertype,
            username: user.username,
            password: passport.md5(data.password)
          };

          passport.default.updateSystemUser(saveData)
            .then((result) => {
              if (result) {
                outFunc(data, "success", "Password has changed!");
              } else {
                outFunc(data, "error", "Password can not changed!");
              }
            })
            .catch((err) => {
              outFunc(data, "error", "Password can not changed!");
            });
        }
      } else {
        res.redirect(redirectUrl);
      }

    } else {
      res.redirect(redirectUrl);
    }
  }

  doSomething(req, res, next) {
    res.send("Hello world!");
  }
}

module.exports = new UserRouter();