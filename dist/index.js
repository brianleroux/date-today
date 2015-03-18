"use strict";

var _interopRequire = function (obj) { return obj && obj.__esModule ? obj["default"] : obj; };

var _prototypeProperties = function (child, staticProps, instanceProps) { if (staticProps) Object.defineProperties(child, staticProps); if (instanceProps) Object.defineProperties(child.prototype, instanceProps); };

var _inherits = function (subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) subClass.__proto__ = superClass; };

var _classCallCheck = function (instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } };

// import the polyfill from node_modules
var CustomElements = _interopRequire(require("webcomponents.js"));

// define the class
var DateSpan = (function (HTMLSpanElement) {
  function DateSpan() {
    _classCallCheck(this, DateSpan);

    if (HTMLSpanElement != null) {
      HTMLSpanElement.apply(this, arguments);
    }
  }

  _inherits(DateSpan, HTMLSpanElement);

  _prototypeProperties(DateSpan, null, {
    createdCallback: {
      value: function createdCallback() {
        this.textContent = "Today's date: " + new Date().toJSON().slice(0, 10);
      },
      writable: true,
      configurable: true
    }
  });

  return DateSpan;
})(HTMLSpanElement);

// register the element w/ the DOM
var DateSpanElement = document.registerElement("date-today", DateSpan);

// export for other ppl to reuse!
module.exports = DateSpanElement;
