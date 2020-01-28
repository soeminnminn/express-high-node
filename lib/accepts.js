/*!
 * accepts
 * Copyright(c) 2014 Jonathan Ong
 * Copyright(c) 2015 Douglas Christopher Wilson
 * MIT Licensed
 */
const mime = require("./mime");

class PreferredCharsets {
  constructor() {
    this.simpleCharsetRegExp = /^\s*([^\s;]+)\s*(?:;(.*))?$/;
  }

  /**
   * Parse the Accept-Charset header.
   * @private
   */
  parseAcceptCharset(accept) {
    const accepts = accept.split(',');
  
    for (let i = 0, j = 0; i < accepts.length; i++) {
      const charset = this.parseCharset(accepts[i].trim(), i);
  
      if (charset) {
        accepts[j++] = charset;
      }
    }
  
    // trim accepts
    accepts.length = j;
  
    return accepts;
  }

  /**
   * Parse a charset from the Accept-Charset header.
   * @private
   */
  parseCharset(str, i) {
    const match = this.simpleCharsetRegExp.exec(str);
    if (!match) return null;
  
    const charset = match[1];
    let q = 1;
    if (match[2]) {
      const params = match[2].split(';')
      for (var j = 0; j < params.length; j++) {
        const p = params[j].trim().split('=');
        if (p[0] === 'q') {
          q = parseFloat(p[1]);
          break;
        }
      }
    }
  
    return {
      charset: charset,
      q: q,
      i: i
    };
  }

  /**
   * Get the priority of a charset.
   * @private
   */
  getCharsetPriority(charset, accepted, index) {
    let priority = {o: -1, q: 0, s: 0};
  
    for (let i = 0; i < accepted.length; i++) {
      const spec = this.specify(charset, accepted[i], index);
  
      if (spec && (priority.s - spec.s || priority.q - spec.q || priority.o - spec.o) < 0) {
        priority = spec;
      }
    }
  
    return priority;
  }

  /**
   * Get the specificity of the charset.
   * @private
   */
  specify(charset, spec, index) {
    var s = 0;
    if(spec.charset.toLowerCase() === charset.toLowerCase()){
      s |= 1;
    } else if (spec.charset !== '*' ) {
      return null
    }
  
    return {
      i: index,
      o: spec.i,
      q: spec.q,
      s: s
    }
  }

  /**
   * Get the preferred charsets from an Accept-Charset header.
   * @public
   */
  preferredCharsets(accept, provided) {
    // RFC 2616 sec 14.2: no header = *
    const accepts = this.parseAcceptCharset(accept === undefined ? '*' : accept || '');
  
    if (!provided) {
      // sorted list of all charsets
      return accepts
        .filter(this.isQuality)
        .sort(this.compareSpecs)
        .map(this.getFullCharset);
    }
  
    const priorities = provided.map((type, index) => {
      return this.getCharsetPriority(type, accepts, index);
    });
  
    // sorted list of accepted charsets
    return priorities.filter(this.isQuality).sort(this.compareSpecs).map((priority) => {
      return provided[priorities.indexOf(priority)];
    });
  }

  /**
   * Compare two specs.
   * @private
   */
  compareSpecs(a, b) {
    return (b.q - a.q) || (b.s - a.s) || (a.o - b.o) || (a.i - b.i) || 0;
  }

  /**
   * Get full charset string.
   * @private
   */
  getFullCharset(spec) {
    return spec.charset;
  }

  /**
   * Check if a spec has any quality.
   * @private
   */
  isQuality(spec) {
    return spec.q > 0;
  }
}

class PreferredEncodings {
  constructor() {
    this.simpleEncodingRegExp = /^\s*([^\s;]+)\s*(?:;(.*))?$/;
  }

  /**
   * Parse the Accept-Encoding header.
   * @private
   */
  parseAcceptEncoding(accept) {
    const accepts = accept.split(',');
    let hasIdentity = false;
    let minQuality = 1;

    for (let i = 0, j = 0; i < accepts.length; i++) {
      const encoding = this.parseEncoding(accepts[i].trim(), i);

      if (encoding) {
        accepts[j++] = encoding;
        hasIdentity = hasIdentity || this.specify('identity', encoding);
        minQuality = Math.min(minQuality, encoding.q || 1);
      }
    }

    if (!hasIdentity) {
      /*
      * If identity doesn't explicitly appear in the accept-encoding header,
      * it's added to the list of acceptable encoding with the lowest q
      */
      accepts[j++] = {
        encoding: 'identity',
        q: minQuality,
        i: i
      };
    }

    // trim accepts
    accepts.length = j;

    return accepts;
  }

  /**
   * Parse an encoding from the Accept-Encoding header.
   * @private
   */
  parseEncoding(str, i) {
    const match = this.simpleEncodingRegExp.exec(str);
    if (!match) return null;

    const encoding = match[1];
    let q = 1;
    if (match[2]) {
      const params = match[2].split(';');
      for (var j = 0; j < params.length; j++) {
        const p = params[j].trim().split('=');
        if (p[0] === 'q') {
          q = parseFloat(p[1]);
          break;
        }
      }
    }

    return {
      encoding: encoding,
      q: q,
      i: i
    };
  }

  /**
   * Get the priority of an encoding.
   * @private
   */
  getEncodingPriority(encoding, accepted, index) {
    let priority = {o: -1, q: 0, s: 0};

    for (let i = 0; i < accepted.length; i++) {
      const spec = this.specify(encoding, accepted[i], index);

      if (spec && (priority.s - spec.s || priority.q - spec.q || priority.o - spec.o) < 0) {
        priority = spec;
      }
    }

    return priority;
  }

  /**
   * Get the specificity of the encoding.
   * @private
   */
  specify(encoding, spec, index) {
    let s = 0;
    if(spec.encoding.toLowerCase() === encoding.toLowerCase()){
      s |= 1;
    } else if (spec.encoding !== '*' ) {
      return null
    }

    return {
      i: index,
      o: spec.i,
      q: spec.q,
      s: s
    }
  };

  /**
   * Get the preferred encodings from an Accept-Encoding header.
   * @public
   */
  preferredEncodings(accept, provided) {
    const accepts = this.parseAcceptEncoding(accept || '');

    if (!provided) {
      // sorted list of all encodings
      return accepts
        .filter(this.isQuality)
        .sort(this.compareSpecs)
        .map(this.getFullEncoding);
    }

    const priorities = provided.map((type, index) => {
      return getEncodingPriority(type, accepts, index);
    });

    // sorted list of accepted encodings
    return priorities.filter(this.isQuality).sort(this.compareSpecs).map((priority) => {
      return provided[priorities.indexOf(priority)];
    });
  }

  /**
   * Compare two specs.
   * @private
   */
  compareSpecs(a, b) {
    return (b.q - a.q) || (b.s - a.s) || (a.o - b.o) || (a.i - b.i) || 0;
  }

  /**
   * Get full encoding string.
   * @private
   */
  getFullEncoding(spec) {
    return spec.encoding;
  }

  /**
   * Check if a spec has any quality.
   * @private
   */
  isQuality(spec) {
    return spec.q > 0;
  }
}

class PreferredLanguages {
  constructor() {
    this.simpleLanguageRegExp = /^\s*([^\s\-;]+)(?:-([^\s;]+))?\s*(?:;(.*))?$/;
  }

  /**
   * Parse the Accept-Language header.
   * @private
   */
  parseAcceptLanguage(accept) {
    const accepts = accept.split(',');

    for (let i = 0, j = 0; i < accepts.length; i++) {
      const language = this.parseLanguage(accepts[i].trim(), i);

      if (language) {
        accepts[j++] = language;
      }
    }

    // trim accepts
    accepts.length = j;

    return accepts;
  }

  /**
   * Parse a language from the Accept-Language header.
   * @private
   */
  parseLanguage(str, i) {
    const match = this.simpleLanguageRegExp.exec(str);
    if (!match) return null;

    const prefix = match[1];
    const suffix = match[2];
    let full = prefix;

    if (suffix) full += `-${suffix}`;

    let q = 1;
    if (match[3]) {
      let params = match[3].split(';')
      for (let j = 0; j < params.length; j++) {
        const p = params[j].split('=');
        if (p[0] === 'q') q = parseFloat(p[1]);
      }
    }

    return {
      prefix: prefix,
      suffix: suffix,
      q: q,
      i: i,
      full: full
    };
  }

  /**
   * Get the priority of a language.
   * @private
   */
  getLanguagePriority(language, accepted, index) {
    let priority = {o: -1, q: 0, s: 0};

    for (let i = 0; i < accepted.length; i++) {
      const spec = this.specify(language, accepted[i], index);

      if (spec && (priority.s - spec.s || priority.q - spec.q || priority.o - spec.o) < 0) {
        priority = spec;
      }
    }

    return priority;
  }

  /**
   * Get the specificity of the language.
   * @private
   */
  specify(language, spec, index) {
    const p = this.parseLanguage(language)
    if (!p) return null;
    let s = 0;
    if(spec.full.toLowerCase() === p.full.toLowerCase()){
      s |= 4;
    } else if (spec.prefix.toLowerCase() === p.full.toLowerCase()) {
      s |= 2;
    } else if (spec.full.toLowerCase() === p.prefix.toLowerCase()) {
      s |= 1;
    } else if (spec.full !== '*' ) {
      return null
    }

    return {
      i: index,
      o: spec.i,
      q: spec.q,
      s: s
    }
  };

  /**
   * Get the preferred languages from an Accept-Language header.
   * @public
   */
  preferredLanguages(accept, provided) {
    // RFC 2616 sec 14.4: no header = *
    const accepts = this.parseAcceptLanguage(accept === undefined ? '*' : accept || '');

    if (!provided) {
      // sorted list of all languages
      return accepts
        .filter(this.isQuality)
        .sort(this.compareSpecs)
        .map(this.getFullLanguage);
    }

    const priorities = provided.map((type, index) => {
      return this.getLanguagePriority(type, accepts, index);
    });

    // sorted list of accepted languages
    return priorities.filter(this.isQuality).sort(compareSpecs).map((priority) => {
      return provided[priorities.indexOf(priority)];
    });
  }

  /**
   * Compare two specs.
   * @private
   */
  compareSpecs(a, b) {
    return (b.q - a.q) || (b.s - a.s) || (a.o - b.o) || (a.i - b.i) || 0;
  }

  /**
   * Get full language string.
   * @private
   */
  getFullLanguage(spec) {
    return spec.full;
  }

  /**
   * Check if a spec has any quality.
   * @private
   */
  isQuality(spec) {
    return spec.q > 0;
  }
}

class PreferredMediaTypes {
  constructor() {
    this.simpleMediaTypeRegExp = /^\s*([^\s\/;]+)\/([^;\s]+)\s*(?:;(.*))?$/;
  }

  /**
   * Parse the Accept header.
   * @private
   */
  parseAccept(accept) {
    const accepts = this.splitMediaTypes(accept);

    for (let i = 0, j = 0; i < accepts.length; i++) {
      const mediaType = this.parseMediaType(accepts[i].trim(), i);

      if (mediaType) {
        accepts[j++] = mediaType;
      }
    }

    // trim accepts
    accepts.length = j;

    return accepts;
  }

  /**
   * Parse a media type from the Accept header.
   * @private
   */
  parseMediaType(str, i) {
    const match = this.simpleMediaTypeRegExp.exec(str);
    if (!match) return null;

    const params = Object.create(null);
    let q = 1;
    const subtype = match[2];
    const type = match[1];

    if (match[3]) {
      let kvps = this.splitParameters(match[3]).map(this.splitKeyValuePair);

      for (var j = 0; j < kvps.length; j++) {
        const pair = kvps[j];
        const key = pair[0].toLowerCase();
        const val = pair[1];

        // get the value, unwrapping quotes
        const value = val && val[0] === '"' && val[val.length - 1] === '"'
          ? val.substr(1, val.length - 2)
          : val;

        if (key === 'q') {
          q = parseFloat(value);
          break;
        }

        // store parameter
        params[key] = value;
      }
    }

    return {
      type: type,
      subtype: subtype,
      params: params,
      q: q,
      i: i
    };
  }

  /**
   * Get the priority of a media type.
   * @private
   */
  getMediaTypePriority(type, accepted, index) {
    let priority = {o: -1, q: 0, s: 0};

    for (let i = 0; i < accepted.length; i++) {
      const spec = this.specify(type, accepted[i], index);

      if (spec && (priority.s - spec.s || priority.q - spec.q || priority.o - spec.o) < 0) {
        priority = spec;
      }
    }

    return priority;
  }

  /**
   * Get the specificity of the media type.
   * @private
   */
  specify(type, spec, index) {
    const p = this.parseMediaType(type);
    let s = 0;

    if (!p) {
      return null;
    }

    if(spec.type.toLowerCase() == p.type.toLowerCase()) {
      s |= 4
    } else if(spec.type != '*') {
      return null;
    }

    if(spec.subtype.toLowerCase() == p.subtype.toLowerCase()) {
      s |= 2
    } else if(spec.subtype != '*') {
      return null;
    }

    const keys = Object.keys(spec.params);
    if (keys.length > 0) {
      if (keys.every((k) => {
        return spec.params[k] == '*' || (spec.params[k] || '').toLowerCase() == (p.params[k] || '').toLowerCase();
      })) {
        s |= 1
      } else {
        return null
      }
    }

    return {
      i: index,
      o: spec.i,
      q: spec.q,
      s: s,
    }
  }

  /**
   * Get the preferred media types from an Accept header.
   * @public
   */
  preferredMediaTypes(accept, provided) {
    // RFC 2616 sec 14.2: no header = */*
    const accepts = this.parseAccept(accept === undefined ? '*/*' : accept || '');

    if (!provided) {
      // sorted list of all types
      return accepts
        .filter(this.isQuality)
        .sort(this.compareSpecs)
        .map(this.getFullType);
    }

    const priorities = provided.map((type, index) => {
      return this.getMediaTypePriority(type, accepts, index);
    });

    // sorted list of accepted types
    return priorities.filter(this.isQuality).sort(this.compareSpecs).map((priority) => {
      return provided[priorities.indexOf(priority)];
    });
  }

  /**
   * Compare two specs.
   * @private
   */
  compareSpecs(a, b) {
    return (b.q - a.q) || (b.s - a.s) || (a.o - b.o) || (a.i - b.i) || 0;
  }

  /**
   * Get full type string.
   * @private
   */
  getFullType(spec) {
    return `${spec.type}/${spec.subtype}`;
  }

  /**
   * Check if a spec has any quality.
   * @private
   */
  isQuality(spec) {
    return spec.q > 0;
  }

  /**
   * Count the number of quotes in a string.
   * @private
   */
  quoteCount(string) {
    let count = 0;
    let index = 0;

    while ((index = string.indexOf('"', index)) !== -1) {
      count++;
      index++;
    }

    return count;
  }

  /**
   * Split a key value pair.
   * @private
   */
  splitKeyValuePair(str) {
    const index = str.indexOf('=');
    let key;
    let val;

    if (index === -1) {
      key = str;
    } else {
      key = str.substr(0, index);
      val = str.substr(index + 1);
    }

    return [key, val];
  }

  /**
   * Split an Accept header into media types.
   * @private
   */
  splitMediaTypes(accept) {
    const accepts = accept.split(',');

    for (let i = 1, j = 0; i < accepts.length; i++) {
      if (this.quoteCount(accepts[j]) % 2 == 0) {
        accepts[++j] = accepts[i];
      } else {
        accepts[j] += `,${accepts[i]}`;
      }
    }

    // trim accepts
    accepts.length = j + 1;

    return accepts;
  }

  /**
   * Split a string of parameters.
   * @private
   */
  splitParameters(str) {
    const parameters = str.split(';');

    for (let i = 1, j = 0; i < parameters.length; i++) {
      if (this.quoteCount(parameters[j]) % 2 == 0) {
        parameters[++j] = parameters[i];
      } else {
        parameters[j] += `;${parameters[i]}`;
      }
    }

    // trim parameters
    parameters.length = j + 1;

    for (let i = 0; i < parameters.length; i++) {
      parameters[i] = parameters[i].trim();
    }

    return parameters;
  }
}

/**
 * Create a Negotiator instance from a request.
 * https://github.com/jshttp/negotiator/
 * @param {object} request
 * @public
 */
class Negotiator {
  constructor(request) {
    this.request = request;
  }

  /**
   * Get the preferred charsets from an Accept-Charset header.
   * @public
   */
  charsets(available) {
    const instance = new PreferredCharsets();
    return instance.preferredCharsets(this.request.headers['accept-charset'], available);
  }

  /**
   * Get the preferred encodings from an Accept-Encoding header.
   * @public
   */
  encodings(available) {
    const instance = new PreferredEncodings();
    return instance.preferredEncodings(this.request.headers['accept-encoding'], available);
  }

  /**
   * Get the preferred languages from an Accept-Language header.
   * @public
   */
  languages(available) {
    const instance = new PreferredLanguages();
    return instance.preferredLanguages(this.request.headers['accept-language'], available);
  }

  /**
   * Get the preferred media types from an Accept header.
   * @public
   */
  mediaTypes(available) {
    const instance = new PreferredMediaTypes();
    return instance.preferredMediaTypes(this.request.headers.accept, available);
  }
}

/**
 * Accept Module
 */
class Accepts {
  constructor(req) {
    this.headers = req.headers;
    this.negotiator = new Negotiator(req);
  }

  /**
   * Check if the given `type(s)` is acceptable, returning
   * the best match when true, otherwise `undefined`, in which
   * case you should respond with 406 "Not Acceptable".
   *
   * The `type` value may be a single mime type string
   * such as "application/json", the extension name
   * such as "json" or an array `["json", "html", "text/plain"]`. When a list
   * or array is given the _best_ match, if any is returned.
   * @param {String|Array} types ...
   * @return {String|Array|Boolean}
   * @public
   */
  type(types) {
    // support flattened arguments
    if (types && !Array.isArray(types)) {
      types = new Array(arguments.length);
      for (var i = 0; i < types.length; i++) {
        types[i] = arguments[i];
      }
    }
  
    // no types, return all requested types
    if (!types || types.length === 0) {
      return this.negotiator.mediaTypes();
    }
  
    // no accept header, return first given type
    if (!this.headers.accept) {
      return types[0];
    }
  
    const mimes = types.map((type) => {
      return type.indexOf('/') === -1 ? mime.lookup(type) : type;
    });
    const accepts = this.negotiator.mediaTypes(
      mimes.filter((type) => {
        return typeof type === 'string';
      })
    );
    const first = accepts[0];
    return first ? types[mimes.indexOf(first)] : false;
  };

  /**
   * Return accepted encodings or best fit based on `encodings`.
   *
   * Given `Accept-Encoding: gzip, deflate`
   * an array sorted by quality is returned:
   *
   *     ['gzip', 'deflate']
   *
   * @param {String|Array} encodings...
   * @return {String|Array}
   * @public
   */
  encoding(encodings) {
    // support flattened arguments
    if (encodings && !Array.isArray(encodings)) {
      encodings = new Array(arguments.length);
      for (var i = 0; i < encodings.length; i++) {
        encodings[i] = arguments[i];
      }
    }

    // no encodings, return all requested encodings
    if (!encodings || encodings.length === 0) {
      return this.negotiator.encodings();
    }

    return this.negotiator.encodings(encodings)[0] || false;
  }

  /**
   * Return accepted charsets or best fit based on `charsets`.
   *
   * Given `Accept-Charset: utf-8, iso-8859-1;q=0.2, utf-7;q=0.5`
   * an array sorted by quality is returned:
   *
   *     ['utf-8', 'utf-7', 'iso-8859-1']
   *
   * @param {String|Array} charsets...
   * @return {String|Array}
   * @public
   */
  charset(charsets) {
    // support flattened arguments
    if (charsets && !Array.isArray(charsets)) {
      charsets = new Array(arguments.length);
      for (var i = 0; i < charsets.length; i++) {
        charsets[i] = arguments[i];
      }
    }

    // no charsets, return all requested charsets
    if (!charsets || charsets.length === 0) {
      return this.negotiator.charsets();
    }

    return this.negotiator.charsets(charsets)[0] || false;
  }

  /**
   * Return accepted languages or best fit based on `langs`.
   *
   * Given `Accept-Language: en;q=0.8, es, pt`
   * an array sorted by quality is returned:
   *
   *     ['es', 'pt', 'en']
   *
   * @param {String|Array} langs...
   * @return {Array|String}
   * @public
   */
  language(languages) {
    // support flattened arguments
    if (languages && !Array.isArray(languages)) {
      languages = new Array(arguments.length)
      for (var i = 0; i < languages.length; i++) {
        languages[i] = arguments[i]
      }
    }

    // no languages, return all requested languages
    if (!languages || languages.length === 0) {
      return this.negotiator.languages()
    }

    return this.negotiator.languages(languages)[0] || false
  }
}

module.exports = Accepts;