/*!
 * csurf
 * Copyright(c) 2011 Sencha Inc.
 * Copyright(c) 2014 Jonathan Ong
 * Copyright(c) 2014-2016 Douglas Christopher Wilson
 * MIT Licensed
 */

'use strict'

/**
 * Module dependencies.
 * @private
 */

var crypto = require('crypto');
var Tokens = require('./csrf');

/**
 * Module exports.
 * @public
 */

module.exports = csurf;

/**
 * CSRF protection middleware.
 *
 * This middleware adds a `req.csrfToken()` function to make a token
 * which should be added to requests which mutate
 * state, within a hidden form field, query-string etc. This
 * token is validated against the visitor's session.
 *
 * @param {Object} options
 * @return {Function} middleware
 * @public
 */

function csurf(options) {
  var opts = options || {};

  // get cookie options
  var cookie = getCookieOptions(opts.cookie);

  // get session options
  var sessionKey = opts.sessionKey || 'session';

  // get value getter
  var value = opts.value || defaultValue;

  // token repo
  var tokens = new Tokens(opts);

  // ignored methods
  var ignoreMethods = opts.ignoreMethods === undefined
    ? ['GET', 'HEAD', 'OPTIONS']
    : opts.ignoreMethods;

  if (!Array.isArray(ignoreMethods)) {
    throw new TypeError('option ignoreMethods must be an array');
  }

  // generate lookup
  var ignoreMethod = getIgnoredMethods(ignoreMethods);

  return function(req, res, next) {
    // validate the configuration against request
    if (!verifyConfiguration(req, sessionKey, cookie)) {
      return next(new Error('misconfigured csrf'));
    }

    // get the secret from the request
    var secret = getSecret(req, sessionKey, cookie);
    var token;

    // lazy-load token getter
    req.csrfToken = function() {
      var sec = !cookie
        ? getSecret(req, sessionKey, cookie)
        : secret;

      // use cached token if secret has not changed
      if (token && sec === secret) {
        return token;
      }

      // generate & set new secret
      if (sec === undefined) {
        sec = tokens.secretSync();
        setSecret(req, res, sessionKey, sec, cookie);
      }

      // update changed secret
      secret = sec;

      // create new token
      token = tokens.create(secret);

      return token;
    }

    // generate & set secret
    if (!secret) {
      secret = tokens.secretSync();
      setSecret(req, res, sessionKey, secret, cookie);
    }

    // verify the incoming token
    if (!ignoreMethod[req.method] && !tokens.verify(secret, value(req))) {
      return next(createError(403, 'Invalid csrf token', {
        code: 'EBADCSRFTOKEN'
      }));
    }

    next();
  }
}

/**
 * Default value function, checking the `req.body`
 * and `req.query` for the CSRF token.
 *
 * @param {IncomingMessage} req
 * @return {String}
 * @api private
 */

function defaultValue(req) {
  return (req.body && req.body._csrf) ||
    (req.query && req.query._csrf) ||
    (req.headers['csrf-token']) ||
    (req.headers['xsrf-token']) ||
    (req.headers['x-csrf-token']) ||
    (req.headers['x-xsrf-token']);
}

/**
 * Get options for cookie.
 *
 * @param {boolean|object} [options]
 * @returns {object}
 * @api private
 */

function getCookieOptions(options) {
  if (options !== true && typeof options !== 'object') {
    return undefined;
  }

  var opts = {
    key: '_csrf',
    path: '/'
  };

  if (options && typeof options === 'object') {
    for (var prop in options) {
      var val = options[prop];

      if (val !== undefined) {
        opts[prop] = val;
      }
    }
  }

  return opts;
}

/**
 * Get a lookup of ignored methods.
 *
 * @param {array} methods
 * @returns {object}
 * @api private
 */

function getIgnoredMethods(methods) {
  var obj = Object.create(null);

  for (var i = 0; i < methods.length; i++) {
    var method = methods[i].toUpperCase();
    obj[method] = true;
  }

  return obj;
}

/**
 * Get the token secret from the request.
 *
 * @param {IncomingMessage} req
 * @param {String} sessionKey
 * @param {Object} [cookie]
 * @api private
 */

function getSecret(req, sessionKey, cookie) {
  // get the bag & key
  var bag = getSecretBag(req, sessionKey, cookie);
  var key = cookie ? cookie.key : 'csrfSecret';

  if (!bag) {
    /* istanbul ignore next: should never actually run */
    throw new Error('misconfigured csrf');
  }

  // return secret from bag
  return bag[key];
}

/**
 * Get the token secret bag from the request.
 *
 * @param {IncomingMessage} req
 * @param {String} sessionKey
 * @param {Object} [cookie]
 * @api private
 */

function getSecretBag(req, sessionKey, cookie) {
  if (cookie) {
    // get secret from cookie
    var cookieKey = cookie.signed
      ? 'signedCookies'
      : 'cookies';

    return req[cookieKey];
  } else {
    // get secret from session
    return req[sessionKey];
  }
}

/**
 * Set a cookie on the HTTP response.
 *
 * @param {OutgoingMessage} res
 * @param {string} name
 * @param {string} val
 * @param {Object} [options]
 * @api private
 */

function setCookie(res, name, val, options) {
  var data = serialize(name, val, options);

  var prev = res.getHeader('set-cookie') || [];
  var header = Array.isArray(prev) ? prev.concat(data)
    : Array.isArray(data) ? [prev].concat(data)
    : [prev, data];

  res.setHeader('set-cookie', header);
}

/**
 * Set the token secret on the request.
 *
 * @param {IncomingMessage} req
 * @param {OutgoingMessage} res
 * @param {string} sessionKey
 * @param {string} val
 * @param {Object} [cookie]
 * @api private
 */

function setSecret(req, res, sessionKey, val, cookie) {
  if (cookie) {
    // set secret on cookie
    var value = val;

    if (cookie.signed) {
      var secret = req.secret;

      if (!secret) {
        /* istanbul ignore next: should never actually run */
        throw new Error('misconfigured csrf');
      }

      value = 's:' + sign(val, secret);
    }

    setCookie(res, cookie.key, value, cookie);
  } else if (req[sessionKey]) {
    // set secret on session
    req[sessionKey].csrfSecret = val;
  } else {
    /* istanbul ignore next: should never actually run */
    throw new Error('misconfigured csrf');
  }
}

/**
 * Verify the configuration against the request.
 * @private
 */

function verifyConfiguration(req, sessionKey, cookie) {
  if (!getSecretBag(req, sessionKey, cookie)) {
    return false;
  }

  if (cookie && cookie.signed && !req.secret) {
    return false;
  }

  return true;
}

/**
 * Sign the given `val` with `secret`.
 *
 * @param {String} val
 * @param {String} secret
 * @return {String}
 * @api private
 */

function sign(val, secret) {
  if ('string' != typeof val) throw new TypeError("Cookie value must be provided as a string.");
  if ('string' != typeof secret) throw new TypeError("Secret string must be provided.");
  return val + '.' + crypto
    .createHmac('sha256', secret)
    .update(val)
    .digest('base64')
    .replace(/\=+$/, '');
}

/**
 * Unsign and decode the given `val` with `secret`,
 * returning `false` if the signature is invalid.
 *
 * @param {String} val
 * @param {String} secret
 * @return {String|Boolean}
 * @api private
 */

function unsign(val, secret){
  if ('string' != typeof val) throw new TypeError("Signed cookie string must be provided.");
  if ('string' != typeof secret) throw new TypeError("Secret string must be provided.");
  var sha1 = function(str) {
    return crypto.createHash('sha1').update(str).digest('hex');
  };
  var str = val.slice(0, val.lastIndexOf('.'))
    , mac = exports.sign(str, secret);
  
  return sha1(mac) == sha1(val) ? str : false;
};

/**
 * Create a new HTTP Error.
 *
 * @returns {Error}
 * @public
 */

function createError(status, msg, props) {
  var err = new Error(msg);
  err.status = 403;
  Error.captureStackTrace(err, createError);
  for (var key in props) {
    if (key !== 'status' && key !== 'statusCode') {
      err[key] = props[key];
    }
  }

  return err;
}

/**
 * Serialize data into a cookie header.
 *
 * Serialize the a name value pair into a cookie string suitable for
 * http headers. An optional options object specified cookie parameters.
 *
 * serialize('foo', 'bar', { httpOnly: true })
 *   => "foo=bar; httpOnly"
 *
 * @param {string} name
 * @param {string} val
 * @param {object} [options]
 * @return {string}
 * @public
 */

function serialize(name, val, options) {
  var opt = options || {};
  var enc = opt.encode || encodeURIComponent;
  var fieldContentRegExp = /^[\u0009\u0020-\u007e\u0080-\u00ff]+$/;

  if (!fieldContentRegExp.test(name)) {
    throw new TypeError('argument name is invalid');
  }

  var value = enc(val);

  if (value && !fieldContentRegExp.test(value)) {
    throw new TypeError('argument val is invalid');
  }

  var str = name + '=' + value;

  if (null != opt.maxAge) {
    var maxAge = opt.maxAge - 0;
    if (isNaN(maxAge)) throw new Error('maxAge should be a Number');
    str += '; Max-Age=' + Math.floor(maxAge);
  }

  if (opt.domain) {
    if (!fieldContentRegExp.test(opt.domain)) {
      throw new TypeError('option domain is invalid');
    }

    str += '; Domain=' + opt.domain;
  }

  if (opt.path) {
    if (!fieldContentRegExp.test(opt.path)) {
      throw new TypeError('option path is invalid');
    }

    str += '; Path=' + opt.path;
  }

  if (opt.expires) {
    if (typeof opt.expires.toUTCString !== 'function') {
      throw new TypeError('option expires is invalid');
    }

    str += '; Expires=' + opt.expires.toUTCString();
  }

  if (opt.httpOnly) {
    str += '; HttpOnly';
  }

  if (opt.secure) {
    str += '; Secure';
  }

  if (opt.sameSite) {
    var sameSite = typeof opt.sameSite === 'string'
      ? opt.sameSite.toLowerCase() : opt.sameSite;

    switch (sameSite) {
      case true:
        str += '; SameSite=Strict';
        break;
      case 'lax':
        str += '; SameSite=Lax';
        break;
      case 'strict':
        str += '; SameSite=Strict';
        break;
      default:
        throw new TypeError('option sameSite is invalid');
    }
  }

  return str;
}
