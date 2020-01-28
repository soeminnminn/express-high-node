/**
 * JQuery Template binding.
 * Require : JQuery 1.4 or later
 *
 * var temp = $(element).Template({
 *    'template':   // (string|object)  'string': Template text.
 *                                      'object': Templete text options.
 *          {
 *            'innerHtml': false, // [optional] (boolean) Get the innerHtml of element as template
 *            'element':  // [optional] (HtmlElement) Template container element
 *          }
 *    'data':       // [optional] (string|array|object) Data for given tempete.
 *    'ajax':       // [optional] (string|object|function) 'string': ajax call Url.
 *                                                         'object': ajax settings object for $.ajax.
 *                                                         'function': Custom ajax function.
 *          {
 *            'dataSrc': // [optional] (string|function) Ajax data result custom parser.
 *          }
 *    'pager':      // [optional] (object) Define pager.
 *          {
 *            'itemOnPage':   // [number] Count of items on a page.
 *          }
 *    'clearOnLoad': false, // [optional] (boolean) Clear element when data loaded.
 *    'repeat': 1,    // [optional] (number) Repeat count.
 *    'variable':  '', // [optional] (string) Custon variable name for tempete.
 *    'emptyView':   // [optional] (string|HtmlElement)
 *    'loadingView':   // [optional] (string|HtmlElement)
 *    'imports': {}, // [optional] (object) Custom refrence object for templete.
 *    'methods': {} // [optional] (object) Same as 'imports'.
 * });
 *
 * Methods :
 * temp.ajax.reload(); // Reload call.
 *
 * temp.pager.setItemsOnPage(itemCount);
 * temp.pager.previous();
 * temp.pager.next();
 * temp.pager.moveTo(index);
 *
 * Events :
 * preRender (event, data)
 * postRender (event, data)
 * completed (event, data)
 *
 * Ajax Events :
 * ajaxSuccess (event, data)
 * ajaxError	(event, error)
 *
 * Pager Events :
 * itemChanged (event, itemCount)
 * pageChanged (event, currentIndex, oldIndex)
 *
 */

(function(factory) {
  "use strict";

  if (typeof define === 'function' && define.amd) {
    // AMD
    define(['jquery'], function($) {
      return factory($, window, document);
    });
  } else if (typeof exports === 'object') {
    // CommonJS
    module.exports = function(root, $) {
      if (!root) {
        // CommonJS environments without a window global must pass a
        // root. This will give an error otherwise
        root = window;
      }

      if (!$) {
        $ = typeof window !== 'undefined' ? // jQuery's factory checks for a global window
          require('jquery') :
          require('jquery')(root);
      }

      return factory($, root, root.document);
    };
  } else {
    // Browser
    factory(jQuery, window, document);
  }

}(function($, window, document, undefined) {
  "use strict";

  if (!('indexOf' in Array.prototype)) {
    Array.prototype.indexOf = function(find, i /*opt*/ ) {
      if (i === undefined) i = 0;
      if (i < 0) i += this.length;
      if (i < 0) i = 0;
      for (var n = this.length; i < n; i++)
        if (i in this && this[i] === find)
          return i;
      return -1;
    };
  }

  if (!Object.keys) {
    Object.keys = function(obj) {
      var keys = [];
      for (var k in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, k)) {
          keys.push(k);
        }
      }
      return keys;
    };
  }

  var template = function(element, opts) {
    this.$elm = $(element);
    if (!this._isHtmlElement(this.$elm)) {
      return;
    }

    this.opts = $.extend({}, $.fn.Template.defaults, opts);

    this.data = null;
    if (this.opts.data) {
      this.data = this.opts.data;
    }

    this.view = null;
    if (typeof this.opts.template === 'string' && this.opts.template != '') {
      this.view = this.compile(this.opts.template);

    } else if (typeof this.opts.template === 'object') {
      var templateStr = null;

      var $elm = $(element);
      if (this.opts.template.element) {
        $elm = $(this.opts.template.element);
      }

      if (this.opts.template.innerHtml) {
        templateStr = $elm.html();
      } else {
        templateStr = this._getOuterHtml($elm);
      }

      this.view = this.compile(templateStr);
    }

    this.ajax = {};
    if (!this.opts.repeat || typeof this.opts.repeat !== 'number') {
      this.opts.repeat = 0;
    }

    if (typeof this.opts.clearOnLoad === 'undefined') {
      this.opts.clearOnLoad = false;
    }

    this.pager = new pager(this);
    this.load();
  };

  template.prototype = {
    _getOuterHtml: function($elm) {
      if (typeof $elm.prop === 'function') {
        return $elm.prop('outerHTML');

      } else {
        var wrap = $('<div></div>');
        wrap.append($elm.clone());
        return wrap.html();
      }
    },

    _isHtmlElement: function($elm) {
      if (typeof this.$elm[0] === 'undefined') {
        return false;
      }
      var html = this._getOuterHtml(this.$elm);
      if (typeof html === 'undefined') {
        return false;
      }
      return html !== '';
    },

    _createEscaper: function() {
      var map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#x27;',
        '`': '&#x60;'
      };
      var escaper = function(match) {
        return map[match];
      };
      var keys = Object.keys(map);

      // Regexes for identifying a key that needs to be escaped
      var source = '(?:' + keys.join('|') + ')';
      var testRegexp = RegExp(source);
      var replaceRegexp = RegExp(source, 'g');
      return function(string) {
        string = string == null ? '' : '' + string;
        return testRegexp.test(string) ? string.replace(replaceRegexp, escaper) : string;
      };
    },

    compile: function(text) {
      var noMatch = /(.)^/;
      var escapes = {
        "'": "'",
        '\\': '\\',
        '\r': 'r',
        '\n': 'n',
        '\u2028': 'u2028',
        '\u2029': 'u2029'
      };
      var escaper = /\\|'|\r|\n|\u2028|\u2029/g;

      var self = this;
      self.escape = this._createEscaper();

      // Combine delimiters into one regular expression via alternation.
      var matcher = RegExp([
        (this.opts.escape || noMatch).source,
        (this.opts.interpolate || noMatch).source,
        (this.opts.evaluate || noMatch).source
      ].join('|') + '|$', 'g');

      // Compile the template source, escaping string literals appropriately.
      var index = 0;
      var source = "__p+='";
      text.replace(matcher, function(match, escape, interpolate, evaluate, offset) {
        source += text.slice(index, offset).replace(escaper, function(match) {
          return '\\' + escapes[match];
        });
        index = offset + match.length;

        if (escape) {
          source += "'+\n((__t=(" + escape + "))==null?'':__self.escape(__t))+\n'";
        } else if (interpolate) {
          source += "'+\n((__t=(" + interpolate + "))==null?'':__t)+\n'";
        } else if (evaluate) {
          source += "';\n" + evaluate + "\n__p+='";
        }

        // Adobe VMs need the match returned to produce the correct offest.
        return match;
      });
      source += "';\n";

      // If a variable is not specified, place data values in local scope.
      if (!this.opts.variable) source = 'with(obj||{}){\n' + source + '}\n';

      source = "var __t,__p='',__j=Array.prototype.join," +
        "print=function(){__p+=__j.call(arguments,'');};\n" +
        source + 'return __p;\n';
console.log(source);
      var render;
      try {
        render = new Function(this.opts.variable || 'obj', '__self', source);
      } catch (e) {
        e.source = source;
        throw e;
      }

      var result = function(data) {
        return render.call(this, data, self);
      };

      // Provide the compiled source as a convenience for precompilation.
      var argument = this.opts.variable || 'obj';
      result.source = 'function(' + argument + '){\n' + source + '}';
      //console.log(result.source);
      return result;
    },

    load: function() {
      if (this.opts.ajax) {
        this.ajax = new ajax(this);
        this.ajax.reload();

      } else if (this.data) {
        this.render();

      } else if (this.view && typeof this.view === 'function') {
        this.render();
      }
    },

    _trigger: function(event) {
      if (event && typeof event === 'string') {
        var e = $.Event(event);
        var args = [];
        if (arguments.length > 1) {
          for (var i = 1; i < arguments.length; i++) {
            args.push(arguments[i]);
          }
        }
        if (typeof this.opts[event] === 'function') {
          this.opts[event].call(this, args);
        }
        this.$elm.trigger(e, args);
      }
    },

    _triggerWait: function(event) {
      if (event && typeof event === 'string') {
        var e = $.Event(event);
        var args = [];
        if (arguments.length > 1) {
          for (var i = 1; i < arguments.length; i++) {
            args.push(arguments[i]);
          }
        }
        var self = this;
        setTimeout(function() {
          if (typeof self.opts[event] === 'function') {
            self.opts[event].call(self, args);
          }
          self.$elm.trigger(e, args);
        }, 100);
      }
    },

    _renderViewOrData: function(self, d) {
      if (typeof d === 'string') {
        return d;
      } else if (typeof d === 'object') {
        if (this.view && typeof this.view === 'function') {
          return this.view.call(self, d);

        } else {
          return JSON.stringify(d);
        }
      }
      return '';
    },

    _calculateStartEnd: function(count) {
      var start = 0;
      var end = count;
      if (this.pager.isEnabled) {
        this.pager._setItemsCount(count);
        var current = this.pager.currentPage;
        start = current * this.pager.itemsOnPage;
        end = Math.min(start + this.pager.itemsOnPage, count);
      }
      return { 'start': start, 'end': end };
    },

    _getEmptyView: function() {
      var html = $('<span>No content to display</span>');
      if (this.opts.emptyView) {
        html = $(this.opts.emptyView);
      }
      return html;
    },

    _getLoadingView: function() {
      var html = $('<span>Loading \u2026</span>');
      if (this.opts.loadingView) {
        html = $(this.opts.loadingView);
      }
      return html;
    },

    render: function() {
      var repeat = this.opts.repeat;
      var data = this.data;
      var self = this;
      this._trigger('preRender', data);

      if (this.opts.clearOnLoad) {
        this.$elm.empty();
      }

      if (typeof data === 'string') {
        var se = this._calculateStartEnd(repeat);
        for (var r = se.start; r < se.end; r++) {
          this.$elm.append(data);
        }

      } else {
        if (this.opts.imports) {
          self = $.extend({}, this, this.opts.imports);
        } else if (this.opts.methods) {
          self = $.extend({}, this, this.opts.methods);
        }

        var dataLen = 0;
        if (data && typeof data === 'object') {
          dataLen = Array.isArray(data) ? data.length : 1;
        }

        if (dataLen > 0) {
          var count = Math.max(dataLen * repeat, dataLen);
          var se = this._calculateStartEnd(count);

          var temp = '';
          if (Array.isArray(data)) {
            var c = 0;
            for (var i = 0; i < count, i < se.end; i++) {
              if (i >= se.start && i < se.end) {
                temp += this._renderViewOrData(self, data[c]);
              }
              c++;
              if (c >= dataLen) c = 0;
            }

          } else {
            for (var r = se.start; r < se.end; r++) {
              temp += this._renderViewOrData(self, data);
            }
          }

          this.$elm.append(temp);

        } else if (repeat > 0 && this.view && typeof this.view === 'function') {
          var se = this._calculateStartEnd(repeat);
          for (var r = se.start; r < se.end; r++) {
            var temp = this.view.call(self, {});
            this.$elm.append(temp);
          }

        } else {
          this.$elm.append(this._getEmptyView());
        }
      }

      this._trigger('postRender', data);
      this._triggerWait('completed', data);
    },

    on: function(e, cb) {
      this.$elm.on(e, cb);
      return this;
    }
  };

  var ajax = function(sender) {
    this.sender = sender;
    this.opts = sender.opts;
  };

  ajax.prototype.reload = function(url) {
    var self = this.sender;

    if (self.opts.clearOnLoad) {
      self.$elm.empty();
    }

    var loadingView = self._getLoadingView();
    if (loadingView) {
      self.$elm.append(loadingView);
    }

    var source = this.opts.ajax;
    var opts = null;
    if (typeof source === 'string') {
      opts = { url: source };
    } else if (typeof source === 'object') {
      if (typeof source.data === 'function') {
        opts = { 'data': {} };
        source.data(opts.data);
        for(var i in source) {
          if (i != 'data') {
            opts[i] = source[i];
          }
        }
      } else {
        opts = source;
      }
    }

    if (opts) {
      if (url && typeof url === 'string') {
        opts.url = url;
      }

      var cb = $.extend({}, opts, {
        success: function(data, textStatus, jqXHR) {
          self._trigger('ajaxSuccess', data);
          var d = null;
          if (opts.dataSrc) {
            if (typeof opts.dataSrc === 'string') {
              var arr = opts.dataSrc.split('.');
              d = data;
              while (arr.length > 0) {
                var key = arr.shift();
                if (/^[\d]+$/.test(key)) {
                  key = parseInt(key);
                }
                if (typeof d[key] === 'undefined') break;
                d = d[key];
              }

            } else if (typeof opts.dataSrc === 'function') {
              d = opts.dataSrc(data);
            }

          } else {
            d = data;
          }

          if (loadingView && typeof loadingView.remove === 'function') {
            loadingView.remove();
          }
          self.data = d;
          self.render();
        },
        error: function(jqXHR, textStatus, errorThrown) {
          self._trigger('ajaxError', errorThrown);
          console.log(errorThrown);
          if (loadingView && typeof loadingView.remove === 'function') {
            loadingView.remove();
          }
        }
      });

      $.ajax(cb);

    } else if (typeof source === 'function') {
      source(self.data, self.render, self.opts);
    }
  };

  var pager = function(sender) {
    this.sender = sender;
    this.isEnabled = (typeof sender.opts.pager === 'object');
    this.itemsOnPage = 0;
    this.currentPage = 0;
    this.items = 0;
    this.pages = 1;
    if (sender.opts.pager) {
      this.itemsOnPage = sender.opts.pager.itemsOnPage;
    }
  }

  pager.prototype = {
    _setItemsCount: function(value) {
      if (this.isEnabled && this.items != value) {
        this.items = value;
        if (this.items > 0) {
          this.pages = Math.ceil(this.items / this.itemsOnPage);
        } else {
          this.pages = 1;
        }

        this.currentPage = 0;
        this.sender._trigger('itemChanged', value);
      }
    },

    setItemsOnPage: function(value) {
      if (this.isEnabled && this.itemsOnPage != value) {
        this.itemsOnPage = value;

        if (this.items > 0) {
          this.pages = Math.ceil(this.items / this.itemsOnPage);
        } else {
          this.pages = 1;
        }

        return this.moveTo(0);
      }
      return this;
    },

    moveTo: function(index) {
      if (this.isEnabled && this.items > 0) {
        var oldIdx = this.currentPage;
        this.currentPage = Math.min(this.pages - 1, Math.max(0, index));

        this.sender._trigger('pageChanged', this.currentPage, oldIdx);
        this.sender.render();
      }
      return this;
    },

    previous: function() {
      return this.moveTo(this.currentPage - 1);
    },

    next: function() {
      return this.moveTo(this.currentPage + 1);
    }
  };

  // JQuery extension
  var Template = function(opts) {
    var self = this;
    this.api = function() {
      return new template(self, opts);
    };
    return this;
  }

  // Template.defaults = {
  //   evaluate: /<%([\s\S]+?)%>/g,
  //   interpolate: /<%=([\s\S]+?)%>/g,
  //   escape: /<%-([\s\S]+?)%>/g
  // };

  Template.defaults = {
    evaluate: /\$\{([\s\S]+?)\}/g,
    interpolate: /\$\{=([\s\S]+?)\}/g,
    escape: /\$\{-([\s\S]+?)\}/g
  };

  $.fn.template = Template;

  $.fn.Template = function(opts) {
    return $(this).template(opts).api();
  };

  $.each(Template, function(prop, val) {
    $.fn.Template[prop] = val;
  });

  return $.fn.template;
}));
