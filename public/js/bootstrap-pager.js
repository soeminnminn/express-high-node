

(function(factory) {
  "use strict";

  if (typeof define === 'function' && define.amd) {
    // AMD
    define( ['jquery'], function ($) {
      return factory($, window, document);
    } );
  }
  else if (typeof exports === 'object') {
    // CommonJS
    module.exports = function (root, $) {
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
}
(function($, window, document, undefined) {
  "use strict";

  var _pager = function(context) {
    if (!(this instanceof _pager)) {
      return new _pager(context);
    }
    $.extend(this, context);

    this.pages = Math.ceil(this.opts.items / this.opts.itemsOnPage);
    this.currentPage = 0;
    var containerStyle = this.opts.containerStyle || "pagination";

    this.container = $('<ul>', { "class": containerStyle });
    this.append(this.container);
    this.render();
  }

  _pager.prototype = {
    render: function() {
      this.container.empty();
      var self = this;
      var prevDisabled = (this.currentPage == 0 || this.pages <= 1);
      var nextDisabled = (this.currentPage == (this.pages - 1) || this.pages <= 1);

      this._appendButton(this.container, "previous", {
        text: this.opts.prevText,
        cssClass: this.opts.itemStyle,
        active: false,
        disabled: prevDisabled
      }).on('click.pager', function(ev) {
        ev.preventDefault();
        self._moveTo($(this).data('page'));
      });

      var interval = this._getInterval();
      if (this.pages > this.opts.displayedPages && interval.start > 0) {
        this._appendButton(this.container, 0, {
          text: '1',
          cssClass: this.opts.itemStyle,
          active: false,
          disabled: false
        }).on('click.pager', function(ev) {
          ev.preventDefault();
          self._moveTo(0);
        });
        this._appendButton(this.container, 'ellipsis', {
          text: this.opts.ellipseText,
          cssClass: this.opts.itemStyle,
          active: false,
          disabled: true
        });
      }

      var buttons = [];
      for(var i=interval.start; i<interval.end; i++) {
        buttons.push(this._appendButton(this.container, i, {
          text: i + 1,
          cssClass: this.opts.itemStyle,
          active: (i == this.currentPage),
          disabled: false
        }));
      }

      buttons.forEach(function(item) {
        $(item).on('click.pager', function(ev) {
          ev.preventDefault();
          self._moveTo($(this).data('page'));
        });
      });

      if (interval.end < this.pages) {
        this._appendButton(this.container, 'ellipsis', {
          text: this.opts.ellipseText,
          cssClass: this.opts.itemStyle,
          active: false,
          disabled: true
        });
        this._appendButton(this.container, this.pages - 1, {
          text: this.pages,
          cssClass: this.opts.itemStyle,
          active: false,
          disabled: false
        }).on('click.pager', function(ev) {
          ev.preventDefault();
          self._moveTo(self.pages - 1);
        });
      }

      this._appendButton(this.container, "next", {
        text: this.opts.nextText,
        cssClass: this.opts.itemStyle,
        active: false,
        disabled: nextDisabled
      }).on('click.pager', function(ev) {
        ev.preventDefault();
        self._moveTo($(this).data('page'));
      });
      return this;
    },

    setCurrent: function(index) {
      this._moveTo(index);
      return this;
    },
    getCurrent: function() {
      return this.currentPage;
    },
    setItems: function(value) {
      this._updateOpts('items', value, 'number');
      return this;
    },
    setItemsOnPage: function(value) {
      this._updateOpts('itemsOnPage', value, 'number');
      return this;
    },
    setDisplayedPages: function(value) {
      this._updateOpts('displayedPages', value, 'number');
      return this;
    },

    _updateOpts: function(key, value, type) {
      if (typeof value === type) {
        if (this.opts[key] != value) {
          this.opts[key] = value;
          if (!!~['items', 'itemsOnPage'].indexOf(key)) {
            this.pages = Math.ceil(this.opts.items / this.opts.itemsOnPage);
            this._moveTo(0);
          }
        }
      } else {
        throw new Error('Wrong value type!');
      }
    },
    _getInterval: function() {
      var pStart = 0;
      var pEnd = this.pages;
      var n1 = this.opts.displayedPages - 2;
      var n2 = Math.max(3, this.opts.displayedPages - 5);
      if (this.pages > this.opts.displayedPages) {
        if (this.currentPage < n1) {
          pStart = 0;
          pEnd = n1;
        } else if (this.currentPage >= (this.pages - n1)) {
          pStart = this.pages - n1;
          pEnd = this.pages;
        } else {
          pStart = this.currentPage - Math.floor(n2 / 2);
          pEnd = pStart + n2;
        }
      }

      return { start: pStart, end: pEnd };
    },
    _appendButton: function(parent, index, opts) {
      var text = "";
      if (typeof index === 'number') {
        index = index < 0 ? 0 : (index < this.pages ? index : this.pages - 1);
        text = opts.text || (index + 1);
      } else {
        text = opts.text || index;
      }
      if (opts.active || opts.disabled) {
        index = 'none';
      }
      var cssClass = opts.cssClass || '';
      var btn = null;
      if (opts.active) {
        btn = $('<span>', $.extend(true, {}, {
          'class': 'page-link',
          'data-page': index
        }, opts.attrs || {})).html(text);

        $('<li>', {
          "class": cssClass + " active",
          "aria-current": "page"
        }).append(btn).appendTo(parent);

      } else {
        btn = $('<a>', $.extend(true, {}, {
          'class': 'page-link',
          'href': '#',
          'data-page': index
        }, opts.attrs || {})).html(text);
        $('<li>', { 
          "class": cssClass + (opts.disabled ? " disabled" : "")
        }).append(btn).appendTo(parent);
      }
      return btn;
    },
    _moveTo: function(index) {
      var key = '' + index;
      if (key == 'none') {
        return;
      } else if (key == 'previous') {
        this.currentPage = Math.max(0, this.currentPage - 1);
      } else if (key == 'next') {
        this.currentPage = Math.min(this.pages - 1, this.currentPage + 1);
      } else {
        this.currentPage = Math.min(this.pages - 1, Math.max(0, index));
      }
      this._triggerChanged(this.currentPage);
      this.render();
    },
    _triggerChanged: function(index) {
      var e = $.Event('pagechanged');
      if (typeof this.opts.onPageClick === 'function') {
        this.opts.onPageClick(index, e);
      }
      $(this).trigger(e, [index]);
      if (this.opts.hashChange) {
        window.location.hash = index;
      }
    }
  };

  var Pager = function(opts) {
    this.opts = $.extend(true, {}, Pager.defaults, opts);
    this.api = function() {
      return new _pager(this);
    };
    return this;
  }

  Pager.defaults = {
    items: 0,
    itemsOnPage: 10,
    displayedPages: 7,
    prevText: 'Previous',
    nextText: 'Next',
    ellipseText: '&#x2026;',
    hashChange: true,
    containerStyle: 'pagination',
    itemStyle: 'paginate-button page-item',
    onPageClick: function(pageNumber, event) {
      return true;
    }
  };

  $.fn.pager = Pager;

  $.fn.Pager = function (opts) {
    return $(this).pager(opts).api();
  };

  $.each(Pager, function(prop, val) {
    $.fn.Pager[prop] = val;
  });

  return $.fn.pager;
}));
