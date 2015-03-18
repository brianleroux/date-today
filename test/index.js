require=(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
/**
 * @license
 * Copyright (c) 2014 The Polymer Project Authors. All rights reserved.
 * This code may only be used under the BSD style license found at http://polymer.github.io/LICENSE.txt
 * The complete set of authors may be found at http://polymer.github.io/AUTHORS.txt
 * The complete set of contributors may be found at http://polymer.github.io/CONTRIBUTORS.txt
 * Code distributed by Google as part of the polymer project is also
 * subject to an additional IP rights grant found at http://polymer.github.io/PATENTS.txt
 */

(function() {

  // Establish scope.
  window.WebComponents = window.WebComponents || {flags:{}};

  // loading script
  var file = 'webcomponents.js';
  var script = document.querySelector('script[src*="' + file + '"]');

  // Flags. Convert url arguments to flags
  var flags = {};
  if (!flags.noOpts) {
    // from url
    location.search.slice(1).split('&').forEach(function(o) {
      o = o.split('=');
      o[0] && (flags[o[0]] = o[1] || true);
    });
    // from script
    if (script) {
      for (var i=0, a; (a=script.attributes[i]); i++) {
        if (a.name !== 'src') {
          flags[a.name] = a.value || true;
        }
      }
    }
    // log flags
    if (flags.log) {
      var parts = flags.log.split(',');
      flags.log = {};
      parts.forEach(function(f) {
        flags.log[f] = true;
      });
    } else {
      flags.log = {};
    }
  }

  // Determine default settings.
  // If any of these flags match 'native', then force native ShadowDOM; any
  // other truthy value, or failure to detect native
  // ShadowDOM, results in polyfill
  flags.shadow = (flags.shadow || flags.shadowdom || flags.polyfill);
  if (flags.shadow === 'native') {
    flags.shadow = false;
  } else {
    flags.shadow = flags.shadow || !HTMLElement.prototype.createShadowRoot;
  }

  // Load.
  var ShadowDOMNative = [
    'WebComponents/shadowdom.js'
  ];

  var ShadowDOMPolyfill = [
    'ShadowDOM/ShadowDOM.js',
    'WebComponents/shadowdom.js',
    'ShadowCSS/ShadowCSS.js'
  ];

  // select ShadowDOM impl
  var ShadowDOM = flags.shadow ? ShadowDOMPolyfill : ShadowDOMNative;

  // construct full dependency list
  var modules = [].concat(
    ShadowDOM,
    [
      'HTMLImports/HTMLImports.js',
      'CustomElements/CustomElements.js',
      'WebComponents/lang.js',
      // these scripts are loaded here due to polyfill timing issues
      'WebComponents/dom.js',
      'WebComponents/unresolved.js',
      // back compat.
      'WebComponents/bc.js'
    ]
  );

  var src = script.getAttribute('src');
  var path = src.slice(0, src.lastIndexOf(file));

  modules.forEach(function(f) {
    document.write('<script src="' + path + 'src/' + f + '"></script>');
  });

  // exports
  WebComponents.flags = flags;

})();

},{}],"date-today":[function(require,module,exports){
"use strict";

var _interopRequire = function (obj) { return obj && obj.__esModule ? obj["default"] : obj; };

var _createClass = (function () { function defineProperties(target, props) { for (var key in props) { var prop = props[key]; prop.configurable = true; if (prop.value) prop.writable = true; } Object.defineProperties(target, props); } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

var _inherits = function (subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) subClass.__proto__ = superClass; };

var _classCallCheck = function (instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } };

// import the polyfill from node_modules

var CustomElements = _interopRequire(require("webcomponents.js"));

// define the class

var DateSpan = (function (_HTMLSpanElement) {
  function DateSpan() {
    _classCallCheck(this, DateSpan);

    if (_HTMLSpanElement != null) {
      _HTMLSpanElement.apply(this, arguments);
    }
  }

  _inherits(DateSpan, _HTMLSpanElement);

  _createClass(DateSpan, {
    createdCallback: {
      value: function createdCallback() {
        this.textContent = "Today's date: " + new Date().toJSON().slice(0, 10);
      }
    }
  });

  return DateSpan;
})(HTMLSpanElement);

// register the element w/ the DOM
var DateSpanElement = document.registerElement("date-today", DateSpan);

// export for other ppl to reuse!
module.exports = DateSpanElement;

},{"webcomponents.js":1}]},{},[])
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJub2RlX21vZHVsZXMvd2ViY29tcG9uZW50cy5qcy93ZWJjb21wb25lbnRzLmpzIiwiL1VzZXJzL2JyaWFubGVyb3V4L0Rlc2t0b3AvZGF0ZS10b2RheS9zcmMvaW5kZXguanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUNBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Ozs7Ozs7Ozs7Ozs7O0lDakdPLGNBQWMsMkJBQU0sa0JBQWtCOzs7O0lBR3ZDLFFBQVE7V0FBUixRQUFROzBCQUFSLFFBQVE7Ozs7Ozs7WUFBUixRQUFROztlQUFSLFFBQVE7QUFDWixtQkFBZTthQUFBLDJCQUFHO0FBQ2hCLFlBQUksQ0FBQyxXQUFXLEdBQUcsZ0JBQWdCLEdBQUcsSUFBSSxJQUFJLEVBQUUsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxLQUFLLENBQUMsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxDQUFBO09BQ3ZFOzs7O1NBSEcsUUFBUTtHQUFTLGVBQWU7OztBQU90QyxJQUFJLGVBQWUsR0FBRyxRQUFRLENBQUMsZUFBZSxDQUFDLFlBQVksRUFBRSxRQUFRLENBQUMsQ0FBQTs7O2lCQUd2RCxlQUFlIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24gZSh0LG4scil7ZnVuY3Rpb24gcyhvLHUpe2lmKCFuW29dKXtpZighdFtvXSl7dmFyIGE9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtpZighdSYmYSlyZXR1cm4gYShvLCEwKTtpZihpKXJldHVybiBpKG8sITApO3ZhciBmPW5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIrbytcIidcIik7dGhyb3cgZi5jb2RlPVwiTU9EVUxFX05PVF9GT1VORFwiLGZ9dmFyIGw9bltvXT17ZXhwb3J0czp7fX07dFtvXVswXS5jYWxsKGwuZXhwb3J0cyxmdW5jdGlvbihlKXt2YXIgbj10W29dWzFdW2VdO3JldHVybiBzKG4/bjplKX0sbCxsLmV4cG9ydHMsZSx0LG4scil9cmV0dXJuIG5bb10uZXhwb3J0c312YXIgaT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2Zvcih2YXIgbz0wO288ci5sZW5ndGg7bysrKXMocltvXSk7cmV0dXJuIHN9KSIsIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCAoYykgMjAxNCBUaGUgUG9seW1lciBQcm9qZWN0IEF1dGhvcnMuIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiBUaGlzIGNvZGUgbWF5IG9ubHkgYmUgdXNlZCB1bmRlciB0aGUgQlNEIHN0eWxlIGxpY2Vuc2UgZm91bmQgYXQgaHR0cDovL3BvbHltZXIuZ2l0aHViLmlvL0xJQ0VOU0UudHh0XG4gKiBUaGUgY29tcGxldGUgc2V0IG9mIGF1dGhvcnMgbWF5IGJlIGZvdW5kIGF0IGh0dHA6Ly9wb2x5bWVyLmdpdGh1Yi5pby9BVVRIT1JTLnR4dFxuICogVGhlIGNvbXBsZXRlIHNldCBvZiBjb250cmlidXRvcnMgbWF5IGJlIGZvdW5kIGF0IGh0dHA6Ly9wb2x5bWVyLmdpdGh1Yi5pby9DT05UUklCVVRPUlMudHh0XG4gKiBDb2RlIGRpc3RyaWJ1dGVkIGJ5IEdvb2dsZSBhcyBwYXJ0IG9mIHRoZSBwb2x5bWVyIHByb2plY3QgaXMgYWxzb1xuICogc3ViamVjdCB0byBhbiBhZGRpdGlvbmFsIElQIHJpZ2h0cyBncmFudCBmb3VuZCBhdCBodHRwOi8vcG9seW1lci5naXRodWIuaW8vUEFURU5UUy50eHRcbiAqL1xuXG4oZnVuY3Rpb24oKSB7XG5cbiAgLy8gRXN0YWJsaXNoIHNjb3BlLlxuICB3aW5kb3cuV2ViQ29tcG9uZW50cyA9IHdpbmRvdy5XZWJDb21wb25lbnRzIHx8IHtmbGFnczp7fX07XG5cbiAgLy8gbG9hZGluZyBzY3JpcHRcbiAgdmFyIGZpbGUgPSAnd2ViY29tcG9uZW50cy5qcyc7XG4gIHZhciBzY3JpcHQgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCdzY3JpcHRbc3JjKj1cIicgKyBmaWxlICsgJ1wiXScpO1xuXG4gIC8vIEZsYWdzLiBDb252ZXJ0IHVybCBhcmd1bWVudHMgdG8gZmxhZ3NcbiAgdmFyIGZsYWdzID0ge307XG4gIGlmICghZmxhZ3Mubm9PcHRzKSB7XG4gICAgLy8gZnJvbSB1cmxcbiAgICBsb2NhdGlvbi5zZWFyY2guc2xpY2UoMSkuc3BsaXQoJyYnKS5mb3JFYWNoKGZ1bmN0aW9uKG8pIHtcbiAgICAgIG8gPSBvLnNwbGl0KCc9Jyk7XG4gICAgICBvWzBdICYmIChmbGFnc1tvWzBdXSA9IG9bMV0gfHwgdHJ1ZSk7XG4gICAgfSk7XG4gICAgLy8gZnJvbSBzY3JpcHRcbiAgICBpZiAoc2NyaXB0KSB7XG4gICAgICBmb3IgKHZhciBpPTAsIGE7IChhPXNjcmlwdC5hdHRyaWJ1dGVzW2ldKTsgaSsrKSB7XG4gICAgICAgIGlmIChhLm5hbWUgIT09ICdzcmMnKSB7XG4gICAgICAgICAgZmxhZ3NbYS5uYW1lXSA9IGEudmFsdWUgfHwgdHJ1ZTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICAvLyBsb2cgZmxhZ3NcbiAgICBpZiAoZmxhZ3MubG9nKSB7XG4gICAgICB2YXIgcGFydHMgPSBmbGFncy5sb2cuc3BsaXQoJywnKTtcbiAgICAgIGZsYWdzLmxvZyA9IHt9O1xuICAgICAgcGFydHMuZm9yRWFjaChmdW5jdGlvbihmKSB7XG4gICAgICAgIGZsYWdzLmxvZ1tmXSA9IHRydWU7XG4gICAgICB9KTtcbiAgICB9IGVsc2Uge1xuICAgICAgZmxhZ3MubG9nID0ge307XG4gICAgfVxuICB9XG5cbiAgLy8gRGV0ZXJtaW5lIGRlZmF1bHQgc2V0dGluZ3MuXG4gIC8vIElmIGFueSBvZiB0aGVzZSBmbGFncyBtYXRjaCAnbmF0aXZlJywgdGhlbiBmb3JjZSBuYXRpdmUgU2hhZG93RE9NOyBhbnlcbiAgLy8gb3RoZXIgdHJ1dGh5IHZhbHVlLCBvciBmYWlsdXJlIHRvIGRldGVjdCBuYXRpdmVcbiAgLy8gU2hhZG93RE9NLCByZXN1bHRzIGluIHBvbHlmaWxsXG4gIGZsYWdzLnNoYWRvdyA9IChmbGFncy5zaGFkb3cgfHwgZmxhZ3Muc2hhZG93ZG9tIHx8IGZsYWdzLnBvbHlmaWxsKTtcbiAgaWYgKGZsYWdzLnNoYWRvdyA9PT0gJ25hdGl2ZScpIHtcbiAgICBmbGFncy5zaGFkb3cgPSBmYWxzZTtcbiAgfSBlbHNlIHtcbiAgICBmbGFncy5zaGFkb3cgPSBmbGFncy5zaGFkb3cgfHwgIUhUTUxFbGVtZW50LnByb3RvdHlwZS5jcmVhdGVTaGFkb3dSb290O1xuICB9XG5cbiAgLy8gTG9hZC5cbiAgdmFyIFNoYWRvd0RPTU5hdGl2ZSA9IFtcbiAgICAnV2ViQ29tcG9uZW50cy9zaGFkb3dkb20uanMnXG4gIF07XG5cbiAgdmFyIFNoYWRvd0RPTVBvbHlmaWxsID0gW1xuICAgICdTaGFkb3dET00vU2hhZG93RE9NLmpzJyxcbiAgICAnV2ViQ29tcG9uZW50cy9zaGFkb3dkb20uanMnLFxuICAgICdTaGFkb3dDU1MvU2hhZG93Q1NTLmpzJ1xuICBdO1xuXG4gIC8vIHNlbGVjdCBTaGFkb3dET00gaW1wbFxuICB2YXIgU2hhZG93RE9NID0gZmxhZ3Muc2hhZG93ID8gU2hhZG93RE9NUG9seWZpbGwgOiBTaGFkb3dET01OYXRpdmU7XG5cbiAgLy8gY29uc3RydWN0IGZ1bGwgZGVwZW5kZW5jeSBsaXN0XG4gIHZhciBtb2R1bGVzID0gW10uY29uY2F0KFxuICAgIFNoYWRvd0RPTSxcbiAgICBbXG4gICAgICAnSFRNTEltcG9ydHMvSFRNTEltcG9ydHMuanMnLFxuICAgICAgJ0N1c3RvbUVsZW1lbnRzL0N1c3RvbUVsZW1lbnRzLmpzJyxcbiAgICAgICdXZWJDb21wb25lbnRzL2xhbmcuanMnLFxuICAgICAgLy8gdGhlc2Ugc2NyaXB0cyBhcmUgbG9hZGVkIGhlcmUgZHVlIHRvIHBvbHlmaWxsIHRpbWluZyBpc3N1ZXNcbiAgICAgICdXZWJDb21wb25lbnRzL2RvbS5qcycsXG4gICAgICAnV2ViQ29tcG9uZW50cy91bnJlc29sdmVkLmpzJyxcbiAgICAgIC8vIGJhY2sgY29tcGF0LlxuICAgICAgJ1dlYkNvbXBvbmVudHMvYmMuanMnXG4gICAgXVxuICApO1xuXG4gIHZhciBzcmMgPSBzY3JpcHQuZ2V0QXR0cmlidXRlKCdzcmMnKTtcbiAgdmFyIHBhdGggPSBzcmMuc2xpY2UoMCwgc3JjLmxhc3RJbmRleE9mKGZpbGUpKTtcblxuICBtb2R1bGVzLmZvckVhY2goZnVuY3Rpb24oZikge1xuICAgIGRvY3VtZW50LndyaXRlKCc8c2NyaXB0IHNyYz1cIicgKyBwYXRoICsgJ3NyYy8nICsgZiArICdcIj48L3NjcmlwdD4nKTtcbiAgfSk7XG5cbiAgLy8gZXhwb3J0c1xuICBXZWJDb21wb25lbnRzLmZsYWdzID0gZmxhZ3M7XG5cbn0pKCk7XG4iLCIvLyBpbXBvcnQgdGhlIHBvbHlmaWxsIGZyb20gbm9kZV9tb2R1bGVzXG5pbXBvcnQgQ3VzdG9tRWxlbWVudHMgZnJvbSAnd2ViY29tcG9uZW50cy5qcydcblxuLy8gZGVmaW5lIHRoZSBjbGFzc1xuY2xhc3MgRGF0ZVNwYW4gZXh0ZW5kcyBIVE1MU3BhbkVsZW1lbnQge1xuICBjcmVhdGVkQ2FsbGJhY2soKSB7XG4gICAgdGhpcy50ZXh0Q29udGVudCA9IFwiVG9kYXkncyBkYXRlOiBcIiArIG5ldyBEYXRlKCkudG9KU09OKCkuc2xpY2UoMCwgMTApXG4gIH1cbn1cblxuLy8gcmVnaXN0ZXIgdGhlIGVsZW1lbnQgdy8gdGhlIERPTVxubGV0IERhdGVTcGFuRWxlbWVudCA9IGRvY3VtZW50LnJlZ2lzdGVyRWxlbWVudCgnZGF0ZS10b2RheScsIERhdGVTcGFuKVxuXG4vLyBleHBvcnQgZm9yIG90aGVyIHBwbCB0byByZXVzZSFcbmV4cG9ydCBkZWZhdWx0IERhdGVTcGFuRWxlbWVudFxuIl19
