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
// @version 0.5.4
if (typeof WeakMap === "undefined") {
  (function() {
    var defineProperty = Object.defineProperty;
    var counter = Date.now() % 1e9;
    var WeakMap = function() {
      this.name = "__st" + (Math.random() * 1e9 >>> 0) + (counter++ + "__");
    };
    WeakMap.prototype = {
      set: function(key, value) {
        var entry = key[this.name];
        if (entry && entry[0] === key) entry[1] = value; else defineProperty(key, this.name, {
          value: [ key, value ],
          writable: true
        });
        return this;
      },
      get: function(key) {
        var entry;
        return (entry = key[this.name]) && entry[0] === key ? entry[1] : undefined;
      },
      "delete": function(key) {
        var entry = key[this.name];
        if (!entry || entry[0] !== key) return false;
        entry[0] = entry[1] = undefined;
        return true;
      },
      has: function(key) {
        var entry = key[this.name];
        if (!entry) return false;
        return entry[0] === key;
      }
    };
    window.WeakMap = WeakMap;
  })();
}

(function(global) {
  var registrationsTable = new WeakMap();
  var setImmediate;
  if (/Trident|Edge/.test(navigator.userAgent)) {
    setImmediate = setTimeout;
  } else if (window.setImmediate) {
    setImmediate = window.setImmediate;
  } else {
    var setImmediateQueue = [];
    var sentinel = String(Math.random());
    window.addEventListener("message", function(e) {
      if (e.data === sentinel) {
        var queue = setImmediateQueue;
        setImmediateQueue = [];
        queue.forEach(function(func) {
          func();
        });
      }
    });
    setImmediate = function(func) {
      setImmediateQueue.push(func);
      window.postMessage(sentinel, "*");
    };
  }
  var isScheduled = false;
  var scheduledObservers = [];
  function scheduleCallback(observer) {
    scheduledObservers.push(observer);
    if (!isScheduled) {
      isScheduled = true;
      setImmediate(dispatchCallbacks);
    }
  }
  function wrapIfNeeded(node) {
    return window.ShadowDOMPolyfill && window.ShadowDOMPolyfill.wrapIfNeeded(node) || node;
  }
  function dispatchCallbacks() {
    isScheduled = false;
    var observers = scheduledObservers;
    scheduledObservers = [];
    observers.sort(function(o1, o2) {
      return o1.uid_ - o2.uid_;
    });
    var anyNonEmpty = false;
    observers.forEach(function(observer) {
      var queue = observer.takeRecords();
      removeTransientObserversFor(observer);
      if (queue.length) {
        observer.callback_(queue, observer);
        anyNonEmpty = true;
      }
    });
    if (anyNonEmpty) dispatchCallbacks();
  }
  function removeTransientObserversFor(observer) {
    observer.nodes_.forEach(function(node) {
      var registrations = registrationsTable.get(node);
      if (!registrations) return;
      registrations.forEach(function(registration) {
        if (registration.observer === observer) registration.removeTransientObservers();
      });
    });
  }
  function forEachAncestorAndObserverEnqueueRecord(target, callback) {
    for (var node = target; node; node = node.parentNode) {
      var registrations = registrationsTable.get(node);
      if (registrations) {
        for (var j = 0; j < registrations.length; j++) {
          var registration = registrations[j];
          var options = registration.options;
          if (node !== target && !options.subtree) continue;
          var record = callback(options);
          if (record) registration.enqueue(record);
        }
      }
    }
  }
  var uidCounter = 0;
  function JsMutationObserver(callback) {
    this.callback_ = callback;
    this.nodes_ = [];
    this.records_ = [];
    this.uid_ = ++uidCounter;
  }
  JsMutationObserver.prototype = {
    observe: function(target, options) {
      target = wrapIfNeeded(target);
      if (!options.childList && !options.attributes && !options.characterData || options.attributeOldValue && !options.attributes || options.attributeFilter && options.attributeFilter.length && !options.attributes || options.characterDataOldValue && !options.characterData) {
        throw new SyntaxError();
      }
      var registrations = registrationsTable.get(target);
      if (!registrations) registrationsTable.set(target, registrations = []);
      var registration;
      for (var i = 0; i < registrations.length; i++) {
        if (registrations[i].observer === this) {
          registration = registrations[i];
          registration.removeListeners();
          registration.options = options;
          break;
        }
      }
      if (!registration) {
        registration = new Registration(this, target, options);
        registrations.push(registration);
        this.nodes_.push(target);
      }
      registration.addListeners();
    },
    disconnect: function() {
      this.nodes_.forEach(function(node) {
        var registrations = registrationsTable.get(node);
        for (var i = 0; i < registrations.length; i++) {
          var registration = registrations[i];
          if (registration.observer === this) {
            registration.removeListeners();
            registrations.splice(i, 1);
            break;
          }
        }
      }, this);
      this.records_ = [];
    },
    takeRecords: function() {
      var copyOfRecords = this.records_;
      this.records_ = [];
      return copyOfRecords;
    }
  };
  function MutationRecord(type, target) {
    this.type = type;
    this.target = target;
    this.addedNodes = [];
    this.removedNodes = [];
    this.previousSibling = null;
    this.nextSibling = null;
    this.attributeName = null;
    this.attributeNamespace = null;
    this.oldValue = null;
  }
  function copyMutationRecord(original) {
    var record = new MutationRecord(original.type, original.target);
    record.addedNodes = original.addedNodes.slice();
    record.removedNodes = original.removedNodes.slice();
    record.previousSibling = original.previousSibling;
    record.nextSibling = original.nextSibling;
    record.attributeName = original.attributeName;
    record.attributeNamespace = original.attributeNamespace;
    record.oldValue = original.oldValue;
    return record;
  }
  var currentRecord, recordWithOldValue;
  function getRecord(type, target) {
    return currentRecord = new MutationRecord(type, target);
  }
  function getRecordWithOldValue(oldValue) {
    if (recordWithOldValue) return recordWithOldValue;
    recordWithOldValue = copyMutationRecord(currentRecord);
    recordWithOldValue.oldValue = oldValue;
    return recordWithOldValue;
  }
  function clearRecords() {
    currentRecord = recordWithOldValue = undefined;
  }
  function recordRepresentsCurrentMutation(record) {
    return record === recordWithOldValue || record === currentRecord;
  }
  function selectRecord(lastRecord, newRecord) {
    if (lastRecord === newRecord) return lastRecord;
    if (recordWithOldValue && recordRepresentsCurrentMutation(lastRecord)) return recordWithOldValue;
    return null;
  }
  function Registration(observer, target, options) {
    this.observer = observer;
    this.target = target;
    this.options = options;
    this.transientObservedNodes = [];
  }
  Registration.prototype = {
    enqueue: function(record) {
      var records = this.observer.records_;
      var length = records.length;
      if (records.length > 0) {
        var lastRecord = records[length - 1];
        var recordToReplaceLast = selectRecord(lastRecord, record);
        if (recordToReplaceLast) {
          records[length - 1] = recordToReplaceLast;
          return;
        }
      } else {
        scheduleCallback(this.observer);
      }
      records[length] = record;
    },
    addListeners: function() {
      this.addListeners_(this.target);
    },
    addListeners_: function(node) {
      var options = this.options;
      if (options.attributes) node.addEventListener("DOMAttrModified", this, true);
      if (options.characterData) node.addEventListener("DOMCharacterDataModified", this, true);
      if (options.childList) node.addEventListener("DOMNodeInserted", this, true);
      if (options.childList || options.subtree) node.addEventListener("DOMNodeRemoved", this, true);
    },
    removeListeners: function() {
      this.removeListeners_(this.target);
    },
    removeListeners_: function(node) {
      var options = this.options;
      if (options.attributes) node.removeEventListener("DOMAttrModified", this, true);
      if (options.characterData) node.removeEventListener("DOMCharacterDataModified", this, true);
      if (options.childList) node.removeEventListener("DOMNodeInserted", this, true);
      if (options.childList || options.subtree) node.removeEventListener("DOMNodeRemoved", this, true);
    },
    addTransientObserver: function(node) {
      if (node === this.target) return;
      this.addListeners_(node);
      this.transientObservedNodes.push(node);
      var registrations = registrationsTable.get(node);
      if (!registrations) registrationsTable.set(node, registrations = []);
      registrations.push(this);
    },
    removeTransientObservers: function() {
      var transientObservedNodes = this.transientObservedNodes;
      this.transientObservedNodes = [];
      transientObservedNodes.forEach(function(node) {
        this.removeListeners_(node);
        var registrations = registrationsTable.get(node);
        for (var i = 0; i < registrations.length; i++) {
          if (registrations[i] === this) {
            registrations.splice(i, 1);
            break;
          }
        }
      }, this);
    },
    handleEvent: function(e) {
      e.stopImmediatePropagation();
      switch (e.type) {
       case "DOMAttrModified":
        var name = e.attrName;
        var namespace = e.relatedNode.namespaceURI;
        var target = e.target;
        var record = new getRecord("attributes", target);
        record.attributeName = name;
        record.attributeNamespace = namespace;
        var oldValue = e.attrChange === MutationEvent.ADDITION ? null : e.prevValue;
        forEachAncestorAndObserverEnqueueRecord(target, function(options) {
          if (!options.attributes) return;
          if (options.attributeFilter && options.attributeFilter.length && options.attributeFilter.indexOf(name) === -1 && options.attributeFilter.indexOf(namespace) === -1) {
            return;
          }
          if (options.attributeOldValue) return getRecordWithOldValue(oldValue);
          return record;
        });
        break;

       case "DOMCharacterDataModified":
        var target = e.target;
        var record = getRecord("characterData", target);
        var oldValue = e.prevValue;
        forEachAncestorAndObserverEnqueueRecord(target, function(options) {
          if (!options.characterData) return;
          if (options.characterDataOldValue) return getRecordWithOldValue(oldValue);
          return record;
        });
        break;

       case "DOMNodeRemoved":
        this.addTransientObserver(e.target);

       case "DOMNodeInserted":
        var target = e.relatedNode;
        var changedNode = e.target;
        var addedNodes, removedNodes;
        if (e.type === "DOMNodeInserted") {
          addedNodes = [ changedNode ];
          removedNodes = [];
        } else {
          addedNodes = [];
          removedNodes = [ changedNode ];
        }
        var previousSibling = changedNode.previousSibling;
        var nextSibling = changedNode.nextSibling;
        var record = getRecord("childList", target);
        record.addedNodes = addedNodes;
        record.removedNodes = removedNodes;
        record.previousSibling = previousSibling;
        record.nextSibling = nextSibling;
        forEachAncestorAndObserverEnqueueRecord(target, function(options) {
          if (!options.childList) return;
          return record;
        });
      }
      clearRecords();
    }
  };
  global.JsMutationObserver = JsMutationObserver;
  if (!global.MutationObserver) global.MutationObserver = JsMutationObserver;
})(this);

window.CustomElements = window.CustomElements || {
  flags: {}
};

(function(scope) {
  var flags = scope.flags;
  var modules = [];
  var addModule = function(module) {
    modules.push(module);
  };
  var initializeModules = function() {
    modules.forEach(function(module) {
      module(scope);
    });
  };
  scope.addModule = addModule;
  scope.initializeModules = initializeModules;
  scope.hasNative = Boolean(document.registerElement);
  scope.useNative = !flags.register && scope.hasNative && !window.ShadowDOMPolyfill && (!window.HTMLImports || HTMLImports.useNative);
})(CustomElements);

CustomElements.addModule(function(scope) {
  var IMPORT_LINK_TYPE = window.HTMLImports ? HTMLImports.IMPORT_LINK_TYPE : "none";
  function forSubtree(node, cb) {
    findAllElements(node, function(e) {
      if (cb(e)) {
        return true;
      }
      forRoots(e, cb);
    });
    forRoots(node, cb);
  }
  function findAllElements(node, find, data) {
    var e = node.firstElementChild;
    if (!e) {
      e = node.firstChild;
      while (e && e.nodeType !== Node.ELEMENT_NODE) {
        e = e.nextSibling;
      }
    }
    while (e) {
      if (find(e, data) !== true) {
        findAllElements(e, find, data);
      }
      e = e.nextElementSibling;
    }
    return null;
  }
  function forRoots(node, cb) {
    var root = node.shadowRoot;
    while (root) {
      forSubtree(root, cb);
      root = root.olderShadowRoot;
    }
  }
  var processingDocuments;
  function forDocumentTree(doc, cb) {
    processingDocuments = [];
    _forDocumentTree(doc, cb);
    processingDocuments = null;
  }
  function _forDocumentTree(doc, cb) {
    doc = wrap(doc);
    if (processingDocuments.indexOf(doc) >= 0) {
      return;
    }
    processingDocuments.push(doc);
    var imports = doc.querySelectorAll("link[rel=" + IMPORT_LINK_TYPE + "]");
    for (var i = 0, l = imports.length, n; i < l && (n = imports[i]); i++) {
      if (n.import) {
        _forDocumentTree(n.import, cb);
      }
    }
    cb(doc);
  }
  scope.forDocumentTree = forDocumentTree;
  scope.forSubtree = forSubtree;
});

CustomElements.addModule(function(scope) {
  var flags = scope.flags;
  var forSubtree = scope.forSubtree;
  var forDocumentTree = scope.forDocumentTree;
  function addedNode(node) {
    return added(node) || addedSubtree(node);
  }
  function added(node) {
    if (scope.upgrade(node)) {
      return true;
    }
    attached(node);
  }
  function addedSubtree(node) {
    forSubtree(node, function(e) {
      if (added(e)) {
        return true;
      }
    });
  }
  function attachedNode(node) {
    attached(node);
    if (inDocument(node)) {
      forSubtree(node, function(e) {
        attached(e);
      });
    }
  }
  var hasPolyfillMutations = !window.MutationObserver || window.MutationObserver === window.JsMutationObserver;
  scope.hasPolyfillMutations = hasPolyfillMutations;
  var isPendingMutations = false;
  var pendingMutations = [];
  function deferMutation(fn) {
    pendingMutations.push(fn);
    if (!isPendingMutations) {
      isPendingMutations = true;
      setTimeout(takeMutations);
    }
  }
  function takeMutations() {
    isPendingMutations = false;
    var $p = pendingMutations;
    for (var i = 0, l = $p.length, p; i < l && (p = $p[i]); i++) {
      p();
    }
    pendingMutations = [];
  }
  function attached(element) {
    if (hasPolyfillMutations) {
      deferMutation(function() {
        _attached(element);
      });
    } else {
      _attached(element);
    }
  }
  function _attached(element) {
    if (element.__upgraded__ && (element.attachedCallback || element.detachedCallback)) {
      if (!element.__attached && inDocument(element)) {
        element.__attached = true;
        if (element.attachedCallback) {
          element.attachedCallback();
        }
      }
    }
  }
  function detachedNode(node) {
    detached(node);
    forSubtree(node, function(e) {
      detached(e);
    });
  }
  function detached(element) {
    if (hasPolyfillMutations) {
      deferMutation(function() {
        _detached(element);
      });
    } else {
      _detached(element);
    }
  }
  function _detached(element) {
    if (element.__upgraded__ && (element.attachedCallback || element.detachedCallback)) {
      if (element.__attached && !inDocument(element)) {
        element.__attached = false;
        if (element.detachedCallback) {
          element.detachedCallback();
        }
      }
    }
  }
  function inDocument(element) {
    var p = element;
    var doc = wrap(document);
    while (p) {
      if (p == doc) {
        return true;
      }
      p = p.parentNode || p.host;
    }
  }
  function watchShadow(node) {
    if (node.shadowRoot && !node.shadowRoot.__watched) {
      flags.dom && console.log("watching shadow-root for: ", node.localName);
      var root = node.shadowRoot;
      while (root) {
        observe(root);
        root = root.olderShadowRoot;
      }
    }
  }
  function handler(mutations) {
    if (flags.dom) {
      var mx = mutations[0];
      if (mx && mx.type === "childList" && mx.addedNodes) {
        if (mx.addedNodes) {
          var d = mx.addedNodes[0];
          while (d && d !== document && !d.host) {
            d = d.parentNode;
          }
          var u = d && (d.URL || d._URL || d.host && d.host.localName) || "";
          u = u.split("/?").shift().split("/").pop();
        }
      }
      console.group("mutations (%d) [%s]", mutations.length, u || "");
    }
    mutations.forEach(function(mx) {
      if (mx.type === "childList") {
        forEach(mx.addedNodes, function(n) {
          if (!n.localName) {
            return;
          }
          addedNode(n);
        });
        forEach(mx.removedNodes, function(n) {
          if (!n.localName) {
            return;
          }
          detachedNode(n);
        });
      }
    });
    flags.dom && console.groupEnd();
  }
  function takeRecords(node) {
    node = wrap(node);
    if (!node) {
      node = wrap(document);
    }
    while (node.parentNode) {
      node = node.parentNode;
    }
    var observer = node.__observer;
    if (observer) {
      handler(observer.takeRecords());
      takeMutations();
    }
  }
  var forEach = Array.prototype.forEach.call.bind(Array.prototype.forEach);
  function observe(inRoot) {
    if (inRoot.__observer) {
      return;
    }
    var observer = new MutationObserver(handler);
    observer.observe(inRoot, {
      childList: true,
      subtree: true
    });
    inRoot.__observer = observer;
  }
  function upgradeDocument(doc) {
    doc = wrap(doc);
    flags.dom && console.group("upgradeDocument: ", doc.baseURI.split("/").pop());
    addedNode(doc);
    observe(doc);
    flags.dom && console.groupEnd();
  }
  function upgradeDocumentTree(doc) {
    forDocumentTree(doc, upgradeDocument);
  }
  var originalCreateShadowRoot = Element.prototype.createShadowRoot;
  Element.prototype.createShadowRoot = function() {
    var root = originalCreateShadowRoot.call(this);
    CustomElements.watchShadow(this);
    return root;
  };
  scope.watchShadow = watchShadow;
  scope.upgradeDocumentTree = upgradeDocumentTree;
  scope.upgradeSubtree = addedSubtree;
  scope.upgradeAll = addedNode;
  scope.attachedNode = attachedNode;
  scope.takeRecords = takeRecords;
});

CustomElements.addModule(function(scope) {
  var flags = scope.flags;
  function upgrade(node) {
    if (!node.__upgraded__ && node.nodeType === Node.ELEMENT_NODE) {
      var is = node.getAttribute("is");
      var definition = scope.getRegisteredDefinition(is || node.localName);
      if (definition) {
        if (is && definition.tag == node.localName) {
          return upgradeWithDefinition(node, definition);
        } else if (!is && !definition.extends) {
          return upgradeWithDefinition(node, definition);
        }
      }
    }
  }
  function upgradeWithDefinition(element, definition) {
    flags.upgrade && console.group("upgrade:", element.localName);
    if (definition.is) {
      element.setAttribute("is", definition.is);
    }
    implementPrototype(element, definition);
    element.__upgraded__ = true;
    created(element);
    scope.attachedNode(element);
    scope.upgradeSubtree(element);
    flags.upgrade && console.groupEnd();
    return element;
  }
  function implementPrototype(element, definition) {
    if (Object.__proto__) {
      element.__proto__ = definition.prototype;
    } else {
      customMixin(element, definition.prototype, definition.native);
      element.__proto__ = definition.prototype;
    }
  }
  function customMixin(inTarget, inSrc, inNative) {
    var used = {};
    var p = inSrc;
    while (p !== inNative && p !== HTMLElement.prototype) {
      var keys = Object.getOwnPropertyNames(p);
      for (var i = 0, k; k = keys[i]; i++) {
        if (!used[k]) {
          Object.defineProperty(inTarget, k, Object.getOwnPropertyDescriptor(p, k));
          used[k] = 1;
        }
      }
      p = Object.getPrototypeOf(p);
    }
  }
  function created(element) {
    if (element.createdCallback) {
      element.createdCallback();
    }
  }
  scope.upgrade = upgrade;
  scope.upgradeWithDefinition = upgradeWithDefinition;
  scope.implementPrototype = implementPrototype;
});

CustomElements.addModule(function(scope) {
  var upgradeDocumentTree = scope.upgradeDocumentTree;
  var upgrade = scope.upgrade;
  var upgradeWithDefinition = scope.upgradeWithDefinition;
  var implementPrototype = scope.implementPrototype;
  var useNative = scope.useNative;
  function register(name, options) {
    var definition = options || {};
    if (!name) {
      throw new Error("document.registerElement: first argument `name` must not be empty");
    }
    if (name.indexOf("-") < 0) {
      throw new Error("document.registerElement: first argument ('name') must contain a dash ('-'). Argument provided was '" + String(name) + "'.");
    }
    if (isReservedTag(name)) {
      throw new Error("Failed to execute 'registerElement' on 'Document': Registration failed for type '" + String(name) + "'. The type name is invalid.");
    }
    if (getRegisteredDefinition(name)) {
      throw new Error("DuplicateDefinitionError: a type with name '" + String(name) + "' is already registered");
    }
    if (!definition.prototype) {
      definition.prototype = Object.create(HTMLElement.prototype);
    }
    definition.__name = name.toLowerCase();
    definition.lifecycle = definition.lifecycle || {};
    definition.ancestry = ancestry(definition.extends);
    resolveTagName(definition);
    resolvePrototypeChain(definition);
    overrideAttributeApi(definition.prototype);
    registerDefinition(definition.__name, definition);
    definition.ctor = generateConstructor(definition);
    definition.ctor.prototype = definition.prototype;
    definition.prototype.constructor = definition.ctor;
    if (scope.ready) {
      upgradeDocumentTree(document);
    }
    return definition.ctor;
  }
  function overrideAttributeApi(prototype) {
    if (prototype.setAttribute._polyfilled) {
      return;
    }
    var setAttribute = prototype.setAttribute;
    prototype.setAttribute = function(name, value) {
      changeAttribute.call(this, name, value, setAttribute);
    };
    var removeAttribute = prototype.removeAttribute;
    prototype.removeAttribute = function(name) {
      changeAttribute.call(this, name, null, removeAttribute);
    };
    prototype.setAttribute._polyfilled = true;
  }
  function changeAttribute(name, value, operation) {
    name = name.toLowerCase();
    var oldValue = this.getAttribute(name);
    operation.apply(this, arguments);
    var newValue = this.getAttribute(name);
    if (this.attributeChangedCallback && newValue !== oldValue) {
      this.attributeChangedCallback(name, oldValue, newValue);
    }
  }
  function isReservedTag(name) {
    for (var i = 0; i < reservedTagList.length; i++) {
      if (name === reservedTagList[i]) {
        return true;
      }
    }
  }
  var reservedTagList = [ "annotation-xml", "color-profile", "font-face", "font-face-src", "font-face-uri", "font-face-format", "font-face-name", "missing-glyph" ];
  function ancestry(extnds) {
    var extendee = getRegisteredDefinition(extnds);
    if (extendee) {
      return ancestry(extendee.extends).concat([ extendee ]);
    }
    return [];
  }
  function resolveTagName(definition) {
    var baseTag = definition.extends;
    for (var i = 0, a; a = definition.ancestry[i]; i++) {
      baseTag = a.is && a.tag;
    }
    definition.tag = baseTag || definition.__name;
    if (baseTag) {
      definition.is = definition.__name;
    }
  }
  function resolvePrototypeChain(definition) {
    if (!Object.__proto__) {
      var nativePrototype = HTMLElement.prototype;
      if (definition.is) {
        var inst = document.createElement(definition.tag);
        var expectedPrototype = Object.getPrototypeOf(inst);
        if (expectedPrototype === definition.prototype) {
          nativePrototype = expectedPrototype;
        }
      }
      var proto = definition.prototype, ancestor;
      while (proto && proto !== nativePrototype) {
        ancestor = Object.getPrototypeOf(proto);
        proto.__proto__ = ancestor;
        proto = ancestor;
      }
      definition.native = nativePrototype;
    }
  }
  function instantiate(definition) {
    return upgradeWithDefinition(domCreateElement(definition.tag), definition);
  }
  var registry = {};
  function getRegisteredDefinition(name) {
    if (name) {
      return registry[name.toLowerCase()];
    }
  }
  function registerDefinition(name, definition) {
    registry[name] = definition;
  }
  function generateConstructor(definition) {
    return function() {
      return instantiate(definition);
    };
  }
  var HTML_NAMESPACE = "http://www.w3.org/1999/xhtml";
  function createElementNS(namespace, tag, typeExtension) {
    if (namespace === HTML_NAMESPACE) {
      return createElement(tag, typeExtension);
    } else {
      return domCreateElementNS(namespace, tag);
    }
  }
  function createElement(tag, typeExtension) {
    var definition = getRegisteredDefinition(typeExtension || tag);
    if (definition) {
      if (tag == definition.tag && typeExtension == definition.is) {
        return new definition.ctor();
      }
      if (!typeExtension && !definition.is) {
        return new definition.ctor();
      }
    }
    var element;
    if (typeExtension) {
      element = createElement(tag);
      element.setAttribute("is", typeExtension);
      return element;
    }
    element = domCreateElement(tag);
    if (tag.indexOf("-") >= 0) {
      implementPrototype(element, HTMLElement);
    }
    return element;
  }
  function cloneNode(deep) {
    var n = domCloneNode.call(this, deep);
    upgrade(n);
    return n;
  }
  var domCreateElement = document.createElement.bind(document);
  var domCreateElementNS = document.createElementNS.bind(document);
  var domCloneNode = Node.prototype.cloneNode;
  var isInstance;
  if (!Object.__proto__ && !useNative) {
    isInstance = function(obj, ctor) {
      var p = obj;
      while (p) {
        if (p === ctor.prototype) {
          return true;
        }
        p = p.__proto__;
      }
      return false;
    };
  } else {
    isInstance = function(obj, base) {
      return obj instanceof base;
    };
  }
  document.registerElement = register;
  document.createElement = createElement;
  document.createElementNS = createElementNS;
  Node.prototype.cloneNode = cloneNode;
  scope.registry = registry;
  scope.instanceof = isInstance;
  scope.reservedTagList = reservedTagList;
  scope.getRegisteredDefinition = getRegisteredDefinition;
  document.register = document.registerElement;
});

(function(scope) {
  var useNative = scope.useNative;
  var initializeModules = scope.initializeModules;
  var isIE11OrOlder = /Trident/.test(navigator.userAgent);
  if (useNative) {
    var nop = function() {};
    scope.watchShadow = nop;
    scope.upgrade = nop;
    scope.upgradeAll = nop;
    scope.upgradeDocumentTree = nop;
    scope.upgradeSubtree = nop;
    scope.takeRecords = nop;
    scope.instanceof = function(obj, base) {
      return obj instanceof base;
    };
  } else {
    initializeModules();
  }
  var upgradeDocumentTree = scope.upgradeDocumentTree;
  if (!window.wrap) {
    if (window.ShadowDOMPolyfill) {
      window.wrap = ShadowDOMPolyfill.wrapIfNeeded;
      window.unwrap = ShadowDOMPolyfill.unwrapIfNeeded;
    } else {
      window.wrap = window.unwrap = function(node) {
        return node;
      };
    }
  }
  function bootstrap() {
    upgradeDocumentTree(wrap(document));
    if (window.HTMLImports) {
      HTMLImports.__importsParsingHook = function(elt) {
        upgradeDocumentTree(wrap(elt.import));
      };
    }
    CustomElements.ready = true;
    setTimeout(function() {
      CustomElements.readyTime = Date.now();
      if (window.HTMLImports) {
        CustomElements.elapsed = CustomElements.readyTime - HTMLImports.readyTime;
      }
      document.dispatchEvent(new CustomEvent("WebComponentsReady", {
        bubbles: true
      }));
    });
  }
  if (isIE11OrOlder && typeof window.CustomEvent !== "function") {
    window.CustomEvent = function(inType, params) {
      params = params || {};
      var e = document.createEvent("CustomEvent");
      e.initCustomEvent(inType, Boolean(params.bubbles), Boolean(params.cancelable), params.detail);
      return e;
    };
    window.CustomEvent.prototype = window.Event.prototype;
  }
  if (document.readyState === "complete" || scope.flags.eager) {
    bootstrap();
  } else if (document.readyState === "interactive" && !window.attachEvent && (!window.HTMLImports || window.HTMLImports.ready)) {
    bootstrap();
  } else {
    var loadEvent = window.HTMLImports && !HTMLImports.ready ? "HTMLImportsLoaded" : "DOMContentLoaded";
    window.addEventListener(loadEvent, bootstrap);
  }
})(window.CustomElements);
},{}],"date-today":[function(require,module,exports){
"use strict";

var _interopRequire = function (obj) { return obj && obj.__esModule ? obj["default"] : obj; };

var _prototypeProperties = function (child, staticProps, instanceProps) { if (staticProps) Object.defineProperties(child, staticProps); if (instanceProps) Object.defineProperties(child.prototype, instanceProps); };

var _inherits = function (subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) subClass.__proto__ = superClass; };

// import the polyfill from node_modules
var CustomElements = _interopRequire(require("webcomponents.js/CustomElements"));

// define the class
var DateSpan = (function (HTMLSpanElement) {
  function DateSpan() {
    if (Object.getPrototypeOf(DateSpan) !== null) {
      Object.getPrototypeOf(DateSpan).apply(this, arguments);
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

},{"webcomponents.js/CustomElements":1}]},{},[])
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJub2RlX21vZHVsZXMvd2ViY29tcG9uZW50cy5qcy9DdXN0b21FbGVtZW50cy5qcyIsIi9Vc2Vycy9icmlhbmxlcm91eC9EZXNrdG9wL3RtcC9zcmMvaW5kZXguanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUNBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7Ozs7Ozs7OztJQ2w2Qk8sY0FBYywyQkFBTSxpQ0FBaUM7OztJQUd0RCxRQUFRLGNBQVMsZUFBZTtXQUFoQyxRQUFROzhCQUFSLFFBQVE7NEJBQVIsUUFBUTs7OztZQUFSLFFBQVEsRUFBUyxlQUFlOzt1QkFBaEMsUUFBUTtBQUNYLG1CQUFlO2FBQUEsMkJBQUc7QUFDaEIsWUFBSSxDQUFDLFdBQVcsR0FBRyxnQkFBZ0IsR0FBRyxJQUFJLElBQUksRUFBRSxDQUFDLE1BQU0sRUFBRSxDQUFDLEtBQUssQ0FBQyxDQUFDLEVBQUUsRUFBRSxDQUFDLENBQUE7T0FDdkU7Ozs7OztTQUhFLFFBQVE7R0FBUyxlQUFlOzs7QUFPdEMsSUFBSSxlQUFlLEdBQUcsUUFBUSxDQUFDLGVBQWUsQ0FBQyxZQUFZLEVBQUUsUUFBUSxDQUFDLENBQUE7OztpQkFHdkQsZUFBZSIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uIGUodCxuLHIpe2Z1bmN0aW9uIHMobyx1KXtpZighbltvXSl7aWYoIXRbb10pe3ZhciBhPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7aWYoIXUmJmEpcmV0dXJuIGEobywhMCk7aWYoaSlyZXR1cm4gaShvLCEwKTt2YXIgZj1uZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK28rXCInXCIpO3Rocm93IGYuY29kZT1cIk1PRFVMRV9OT1RfRk9VTkRcIixmfXZhciBsPW5bb109e2V4cG9ydHM6e319O3Rbb11bMF0uY2FsbChsLmV4cG9ydHMsZnVuY3Rpb24oZSl7dmFyIG49dFtvXVsxXVtlXTtyZXR1cm4gcyhuP246ZSl9LGwsbC5leHBvcnRzLGUsdCxuLHIpfXJldHVybiBuW29dLmV4cG9ydHN9dmFyIGk9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtmb3IodmFyIG89MDtvPHIubGVuZ3RoO28rKylzKHJbb10pO3JldHVybiBzfSkiLCIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgKGMpIDIwMTQgVGhlIFBvbHltZXIgUHJvamVjdCBBdXRob3JzLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogVGhpcyBjb2RlIG1heSBvbmx5IGJlIHVzZWQgdW5kZXIgdGhlIEJTRCBzdHlsZSBsaWNlbnNlIGZvdW5kIGF0IGh0dHA6Ly9wb2x5bWVyLmdpdGh1Yi5pby9MSUNFTlNFLnR4dFxuICogVGhlIGNvbXBsZXRlIHNldCBvZiBhdXRob3JzIG1heSBiZSBmb3VuZCBhdCBodHRwOi8vcG9seW1lci5naXRodWIuaW8vQVVUSE9SUy50eHRcbiAqIFRoZSBjb21wbGV0ZSBzZXQgb2YgY29udHJpYnV0b3JzIG1heSBiZSBmb3VuZCBhdCBodHRwOi8vcG9seW1lci5naXRodWIuaW8vQ09OVFJJQlVUT1JTLnR4dFxuICogQ29kZSBkaXN0cmlidXRlZCBieSBHb29nbGUgYXMgcGFydCBvZiB0aGUgcG9seW1lciBwcm9qZWN0IGlzIGFsc29cbiAqIHN1YmplY3QgdG8gYW4gYWRkaXRpb25hbCBJUCByaWdodHMgZ3JhbnQgZm91bmQgYXQgaHR0cDovL3BvbHltZXIuZ2l0aHViLmlvL1BBVEVOVFMudHh0XG4gKi9cbi8vIEB2ZXJzaW9uIDAuNS40XG5pZiAodHlwZW9mIFdlYWtNYXAgPT09IFwidW5kZWZpbmVkXCIpIHtcbiAgKGZ1bmN0aW9uKCkge1xuICAgIHZhciBkZWZpbmVQcm9wZXJ0eSA9IE9iamVjdC5kZWZpbmVQcm9wZXJ0eTtcbiAgICB2YXIgY291bnRlciA9IERhdGUubm93KCkgJSAxZTk7XG4gICAgdmFyIFdlYWtNYXAgPSBmdW5jdGlvbigpIHtcbiAgICAgIHRoaXMubmFtZSA9IFwiX19zdFwiICsgKE1hdGgucmFuZG9tKCkgKiAxZTkgPj4+IDApICsgKGNvdW50ZXIrKyArIFwiX19cIik7XG4gICAgfTtcbiAgICBXZWFrTWFwLnByb3RvdHlwZSA9IHtcbiAgICAgIHNldDogZnVuY3Rpb24oa2V5LCB2YWx1ZSkge1xuICAgICAgICB2YXIgZW50cnkgPSBrZXlbdGhpcy5uYW1lXTtcbiAgICAgICAgaWYgKGVudHJ5ICYmIGVudHJ5WzBdID09PSBrZXkpIGVudHJ5WzFdID0gdmFsdWU7IGVsc2UgZGVmaW5lUHJvcGVydHkoa2V5LCB0aGlzLm5hbWUsIHtcbiAgICAgICAgICB2YWx1ZTogWyBrZXksIHZhbHVlIF0sXG4gICAgICAgICAgd3JpdGFibGU6IHRydWVcbiAgICAgICAgfSk7XG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgICAgfSxcbiAgICAgIGdldDogZnVuY3Rpb24oa2V5KSB7XG4gICAgICAgIHZhciBlbnRyeTtcbiAgICAgICAgcmV0dXJuIChlbnRyeSA9IGtleVt0aGlzLm5hbWVdKSAmJiBlbnRyeVswXSA9PT0ga2V5ID8gZW50cnlbMV0gOiB1bmRlZmluZWQ7XG4gICAgICB9LFxuICAgICAgXCJkZWxldGVcIjogZnVuY3Rpb24oa2V5KSB7XG4gICAgICAgIHZhciBlbnRyeSA9IGtleVt0aGlzLm5hbWVdO1xuICAgICAgICBpZiAoIWVudHJ5IHx8IGVudHJ5WzBdICE9PSBrZXkpIHJldHVybiBmYWxzZTtcbiAgICAgICAgZW50cnlbMF0gPSBlbnRyeVsxXSA9IHVuZGVmaW5lZDtcbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICB9LFxuICAgICAgaGFzOiBmdW5jdGlvbihrZXkpIHtcbiAgICAgICAgdmFyIGVudHJ5ID0ga2V5W3RoaXMubmFtZV07XG4gICAgICAgIGlmICghZW50cnkpIHJldHVybiBmYWxzZTtcbiAgICAgICAgcmV0dXJuIGVudHJ5WzBdID09PSBrZXk7XG4gICAgICB9XG4gICAgfTtcbiAgICB3aW5kb3cuV2Vha01hcCA9IFdlYWtNYXA7XG4gIH0pKCk7XG59XG5cbihmdW5jdGlvbihnbG9iYWwpIHtcbiAgdmFyIHJlZ2lzdHJhdGlvbnNUYWJsZSA9IG5ldyBXZWFrTWFwKCk7XG4gIHZhciBzZXRJbW1lZGlhdGU7XG4gIGlmICgvVHJpZGVudHxFZGdlLy50ZXN0KG5hdmlnYXRvci51c2VyQWdlbnQpKSB7XG4gICAgc2V0SW1tZWRpYXRlID0gc2V0VGltZW91dDtcbiAgfSBlbHNlIGlmICh3aW5kb3cuc2V0SW1tZWRpYXRlKSB7XG4gICAgc2V0SW1tZWRpYXRlID0gd2luZG93LnNldEltbWVkaWF0ZTtcbiAgfSBlbHNlIHtcbiAgICB2YXIgc2V0SW1tZWRpYXRlUXVldWUgPSBbXTtcbiAgICB2YXIgc2VudGluZWwgPSBTdHJpbmcoTWF0aC5yYW5kb20oKSk7XG4gICAgd2luZG93LmFkZEV2ZW50TGlzdGVuZXIoXCJtZXNzYWdlXCIsIGZ1bmN0aW9uKGUpIHtcbiAgICAgIGlmIChlLmRhdGEgPT09IHNlbnRpbmVsKSB7XG4gICAgICAgIHZhciBxdWV1ZSA9IHNldEltbWVkaWF0ZVF1ZXVlO1xuICAgICAgICBzZXRJbW1lZGlhdGVRdWV1ZSA9IFtdO1xuICAgICAgICBxdWV1ZS5mb3JFYWNoKGZ1bmN0aW9uKGZ1bmMpIHtcbiAgICAgICAgICBmdW5jKCk7XG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgIH0pO1xuICAgIHNldEltbWVkaWF0ZSA9IGZ1bmN0aW9uKGZ1bmMpIHtcbiAgICAgIHNldEltbWVkaWF0ZVF1ZXVlLnB1c2goZnVuYyk7XG4gICAgICB3aW5kb3cucG9zdE1lc3NhZ2Uoc2VudGluZWwsIFwiKlwiKTtcbiAgICB9O1xuICB9XG4gIHZhciBpc1NjaGVkdWxlZCA9IGZhbHNlO1xuICB2YXIgc2NoZWR1bGVkT2JzZXJ2ZXJzID0gW107XG4gIGZ1bmN0aW9uIHNjaGVkdWxlQ2FsbGJhY2sob2JzZXJ2ZXIpIHtcbiAgICBzY2hlZHVsZWRPYnNlcnZlcnMucHVzaChvYnNlcnZlcik7XG4gICAgaWYgKCFpc1NjaGVkdWxlZCkge1xuICAgICAgaXNTY2hlZHVsZWQgPSB0cnVlO1xuICAgICAgc2V0SW1tZWRpYXRlKGRpc3BhdGNoQ2FsbGJhY2tzKTtcbiAgICB9XG4gIH1cbiAgZnVuY3Rpb24gd3JhcElmTmVlZGVkKG5vZGUpIHtcbiAgICByZXR1cm4gd2luZG93LlNoYWRvd0RPTVBvbHlmaWxsICYmIHdpbmRvdy5TaGFkb3dET01Qb2x5ZmlsbC53cmFwSWZOZWVkZWQobm9kZSkgfHwgbm9kZTtcbiAgfVxuICBmdW5jdGlvbiBkaXNwYXRjaENhbGxiYWNrcygpIHtcbiAgICBpc1NjaGVkdWxlZCA9IGZhbHNlO1xuICAgIHZhciBvYnNlcnZlcnMgPSBzY2hlZHVsZWRPYnNlcnZlcnM7XG4gICAgc2NoZWR1bGVkT2JzZXJ2ZXJzID0gW107XG4gICAgb2JzZXJ2ZXJzLnNvcnQoZnVuY3Rpb24obzEsIG8yKSB7XG4gICAgICByZXR1cm4gbzEudWlkXyAtIG8yLnVpZF87XG4gICAgfSk7XG4gICAgdmFyIGFueU5vbkVtcHR5ID0gZmFsc2U7XG4gICAgb2JzZXJ2ZXJzLmZvckVhY2goZnVuY3Rpb24ob2JzZXJ2ZXIpIHtcbiAgICAgIHZhciBxdWV1ZSA9IG9ic2VydmVyLnRha2VSZWNvcmRzKCk7XG4gICAgICByZW1vdmVUcmFuc2llbnRPYnNlcnZlcnNGb3Iob2JzZXJ2ZXIpO1xuICAgICAgaWYgKHF1ZXVlLmxlbmd0aCkge1xuICAgICAgICBvYnNlcnZlci5jYWxsYmFja18ocXVldWUsIG9ic2VydmVyKTtcbiAgICAgICAgYW55Tm9uRW1wdHkgPSB0cnVlO1xuICAgICAgfVxuICAgIH0pO1xuICAgIGlmIChhbnlOb25FbXB0eSkgZGlzcGF0Y2hDYWxsYmFja3MoKTtcbiAgfVxuICBmdW5jdGlvbiByZW1vdmVUcmFuc2llbnRPYnNlcnZlcnNGb3Iob2JzZXJ2ZXIpIHtcbiAgICBvYnNlcnZlci5ub2Rlc18uZm9yRWFjaChmdW5jdGlvbihub2RlKSB7XG4gICAgICB2YXIgcmVnaXN0cmF0aW9ucyA9IHJlZ2lzdHJhdGlvbnNUYWJsZS5nZXQobm9kZSk7XG4gICAgICBpZiAoIXJlZ2lzdHJhdGlvbnMpIHJldHVybjtcbiAgICAgIHJlZ2lzdHJhdGlvbnMuZm9yRWFjaChmdW5jdGlvbihyZWdpc3RyYXRpb24pIHtcbiAgICAgICAgaWYgKHJlZ2lzdHJhdGlvbi5vYnNlcnZlciA9PT0gb2JzZXJ2ZXIpIHJlZ2lzdHJhdGlvbi5yZW1vdmVUcmFuc2llbnRPYnNlcnZlcnMoKTtcbiAgICAgIH0pO1xuICAgIH0pO1xuICB9XG4gIGZ1bmN0aW9uIGZvckVhY2hBbmNlc3RvckFuZE9ic2VydmVyRW5xdWV1ZVJlY29yZCh0YXJnZXQsIGNhbGxiYWNrKSB7XG4gICAgZm9yICh2YXIgbm9kZSA9IHRhcmdldDsgbm9kZTsgbm9kZSA9IG5vZGUucGFyZW50Tm9kZSkge1xuICAgICAgdmFyIHJlZ2lzdHJhdGlvbnMgPSByZWdpc3RyYXRpb25zVGFibGUuZ2V0KG5vZGUpO1xuICAgICAgaWYgKHJlZ2lzdHJhdGlvbnMpIHtcbiAgICAgICAgZm9yICh2YXIgaiA9IDA7IGogPCByZWdpc3RyYXRpb25zLmxlbmd0aDsgaisrKSB7XG4gICAgICAgICAgdmFyIHJlZ2lzdHJhdGlvbiA9IHJlZ2lzdHJhdGlvbnNbal07XG4gICAgICAgICAgdmFyIG9wdGlvbnMgPSByZWdpc3RyYXRpb24ub3B0aW9ucztcbiAgICAgICAgICBpZiAobm9kZSAhPT0gdGFyZ2V0ICYmICFvcHRpb25zLnN1YnRyZWUpIGNvbnRpbnVlO1xuICAgICAgICAgIHZhciByZWNvcmQgPSBjYWxsYmFjayhvcHRpb25zKTtcbiAgICAgICAgICBpZiAocmVjb3JkKSByZWdpc3RyYXRpb24uZW5xdWV1ZShyZWNvcmQpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9XG4gIHZhciB1aWRDb3VudGVyID0gMDtcbiAgZnVuY3Rpb24gSnNNdXRhdGlvbk9ic2VydmVyKGNhbGxiYWNrKSB7XG4gICAgdGhpcy5jYWxsYmFja18gPSBjYWxsYmFjaztcbiAgICB0aGlzLm5vZGVzXyA9IFtdO1xuICAgIHRoaXMucmVjb3Jkc18gPSBbXTtcbiAgICB0aGlzLnVpZF8gPSArK3VpZENvdW50ZXI7XG4gIH1cbiAgSnNNdXRhdGlvbk9ic2VydmVyLnByb3RvdHlwZSA9IHtcbiAgICBvYnNlcnZlOiBmdW5jdGlvbih0YXJnZXQsIG9wdGlvbnMpIHtcbiAgICAgIHRhcmdldCA9IHdyYXBJZk5lZWRlZCh0YXJnZXQpO1xuICAgICAgaWYgKCFvcHRpb25zLmNoaWxkTGlzdCAmJiAhb3B0aW9ucy5hdHRyaWJ1dGVzICYmICFvcHRpb25zLmNoYXJhY3RlckRhdGEgfHwgb3B0aW9ucy5hdHRyaWJ1dGVPbGRWYWx1ZSAmJiAhb3B0aW9ucy5hdHRyaWJ1dGVzIHx8IG9wdGlvbnMuYXR0cmlidXRlRmlsdGVyICYmIG9wdGlvbnMuYXR0cmlidXRlRmlsdGVyLmxlbmd0aCAmJiAhb3B0aW9ucy5hdHRyaWJ1dGVzIHx8IG9wdGlvbnMuY2hhcmFjdGVyRGF0YU9sZFZhbHVlICYmICFvcHRpb25zLmNoYXJhY3RlckRhdGEpIHtcbiAgICAgICAgdGhyb3cgbmV3IFN5bnRheEVycm9yKCk7XG4gICAgICB9XG4gICAgICB2YXIgcmVnaXN0cmF0aW9ucyA9IHJlZ2lzdHJhdGlvbnNUYWJsZS5nZXQodGFyZ2V0KTtcbiAgICAgIGlmICghcmVnaXN0cmF0aW9ucykgcmVnaXN0cmF0aW9uc1RhYmxlLnNldCh0YXJnZXQsIHJlZ2lzdHJhdGlvbnMgPSBbXSk7XG4gICAgICB2YXIgcmVnaXN0cmF0aW9uO1xuICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCByZWdpc3RyYXRpb25zLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIGlmIChyZWdpc3RyYXRpb25zW2ldLm9ic2VydmVyID09PSB0aGlzKSB7XG4gICAgICAgICAgcmVnaXN0cmF0aW9uID0gcmVnaXN0cmF0aW9uc1tpXTtcbiAgICAgICAgICByZWdpc3RyYXRpb24ucmVtb3ZlTGlzdGVuZXJzKCk7XG4gICAgICAgICAgcmVnaXN0cmF0aW9uLm9wdGlvbnMgPSBvcHRpb25zO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICBpZiAoIXJlZ2lzdHJhdGlvbikge1xuICAgICAgICByZWdpc3RyYXRpb24gPSBuZXcgUmVnaXN0cmF0aW9uKHRoaXMsIHRhcmdldCwgb3B0aW9ucyk7XG4gICAgICAgIHJlZ2lzdHJhdGlvbnMucHVzaChyZWdpc3RyYXRpb24pO1xuICAgICAgICB0aGlzLm5vZGVzXy5wdXNoKHRhcmdldCk7XG4gICAgICB9XG4gICAgICByZWdpc3RyYXRpb24uYWRkTGlzdGVuZXJzKCk7XG4gICAgfSxcbiAgICBkaXNjb25uZWN0OiBmdW5jdGlvbigpIHtcbiAgICAgIHRoaXMubm9kZXNfLmZvckVhY2goZnVuY3Rpb24obm9kZSkge1xuICAgICAgICB2YXIgcmVnaXN0cmF0aW9ucyA9IHJlZ2lzdHJhdGlvbnNUYWJsZS5nZXQobm9kZSk7XG4gICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgcmVnaXN0cmF0aW9ucy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgIHZhciByZWdpc3RyYXRpb24gPSByZWdpc3RyYXRpb25zW2ldO1xuICAgICAgICAgIGlmIChyZWdpc3RyYXRpb24ub2JzZXJ2ZXIgPT09IHRoaXMpIHtcbiAgICAgICAgICAgIHJlZ2lzdHJhdGlvbi5yZW1vdmVMaXN0ZW5lcnMoKTtcbiAgICAgICAgICAgIHJlZ2lzdHJhdGlvbnMuc3BsaWNlKGksIDEpO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9LCB0aGlzKTtcbiAgICAgIHRoaXMucmVjb3Jkc18gPSBbXTtcbiAgICB9LFxuICAgIHRha2VSZWNvcmRzOiBmdW5jdGlvbigpIHtcbiAgICAgIHZhciBjb3B5T2ZSZWNvcmRzID0gdGhpcy5yZWNvcmRzXztcbiAgICAgIHRoaXMucmVjb3Jkc18gPSBbXTtcbiAgICAgIHJldHVybiBjb3B5T2ZSZWNvcmRzO1xuICAgIH1cbiAgfTtcbiAgZnVuY3Rpb24gTXV0YXRpb25SZWNvcmQodHlwZSwgdGFyZ2V0KSB7XG4gICAgdGhpcy50eXBlID0gdHlwZTtcbiAgICB0aGlzLnRhcmdldCA9IHRhcmdldDtcbiAgICB0aGlzLmFkZGVkTm9kZXMgPSBbXTtcbiAgICB0aGlzLnJlbW92ZWROb2RlcyA9IFtdO1xuICAgIHRoaXMucHJldmlvdXNTaWJsaW5nID0gbnVsbDtcbiAgICB0aGlzLm5leHRTaWJsaW5nID0gbnVsbDtcbiAgICB0aGlzLmF0dHJpYnV0ZU5hbWUgPSBudWxsO1xuICAgIHRoaXMuYXR0cmlidXRlTmFtZXNwYWNlID0gbnVsbDtcbiAgICB0aGlzLm9sZFZhbHVlID0gbnVsbDtcbiAgfVxuICBmdW5jdGlvbiBjb3B5TXV0YXRpb25SZWNvcmQob3JpZ2luYWwpIHtcbiAgICB2YXIgcmVjb3JkID0gbmV3IE11dGF0aW9uUmVjb3JkKG9yaWdpbmFsLnR5cGUsIG9yaWdpbmFsLnRhcmdldCk7XG4gICAgcmVjb3JkLmFkZGVkTm9kZXMgPSBvcmlnaW5hbC5hZGRlZE5vZGVzLnNsaWNlKCk7XG4gICAgcmVjb3JkLnJlbW92ZWROb2RlcyA9IG9yaWdpbmFsLnJlbW92ZWROb2Rlcy5zbGljZSgpO1xuICAgIHJlY29yZC5wcmV2aW91c1NpYmxpbmcgPSBvcmlnaW5hbC5wcmV2aW91c1NpYmxpbmc7XG4gICAgcmVjb3JkLm5leHRTaWJsaW5nID0gb3JpZ2luYWwubmV4dFNpYmxpbmc7XG4gICAgcmVjb3JkLmF0dHJpYnV0ZU5hbWUgPSBvcmlnaW5hbC5hdHRyaWJ1dGVOYW1lO1xuICAgIHJlY29yZC5hdHRyaWJ1dGVOYW1lc3BhY2UgPSBvcmlnaW5hbC5hdHRyaWJ1dGVOYW1lc3BhY2U7XG4gICAgcmVjb3JkLm9sZFZhbHVlID0gb3JpZ2luYWwub2xkVmFsdWU7XG4gICAgcmV0dXJuIHJlY29yZDtcbiAgfVxuICB2YXIgY3VycmVudFJlY29yZCwgcmVjb3JkV2l0aE9sZFZhbHVlO1xuICBmdW5jdGlvbiBnZXRSZWNvcmQodHlwZSwgdGFyZ2V0KSB7XG4gICAgcmV0dXJuIGN1cnJlbnRSZWNvcmQgPSBuZXcgTXV0YXRpb25SZWNvcmQodHlwZSwgdGFyZ2V0KTtcbiAgfVxuICBmdW5jdGlvbiBnZXRSZWNvcmRXaXRoT2xkVmFsdWUob2xkVmFsdWUpIHtcbiAgICBpZiAocmVjb3JkV2l0aE9sZFZhbHVlKSByZXR1cm4gcmVjb3JkV2l0aE9sZFZhbHVlO1xuICAgIHJlY29yZFdpdGhPbGRWYWx1ZSA9IGNvcHlNdXRhdGlvblJlY29yZChjdXJyZW50UmVjb3JkKTtcbiAgICByZWNvcmRXaXRoT2xkVmFsdWUub2xkVmFsdWUgPSBvbGRWYWx1ZTtcbiAgICByZXR1cm4gcmVjb3JkV2l0aE9sZFZhbHVlO1xuICB9XG4gIGZ1bmN0aW9uIGNsZWFyUmVjb3JkcygpIHtcbiAgICBjdXJyZW50UmVjb3JkID0gcmVjb3JkV2l0aE9sZFZhbHVlID0gdW5kZWZpbmVkO1xuICB9XG4gIGZ1bmN0aW9uIHJlY29yZFJlcHJlc2VudHNDdXJyZW50TXV0YXRpb24ocmVjb3JkKSB7XG4gICAgcmV0dXJuIHJlY29yZCA9PT0gcmVjb3JkV2l0aE9sZFZhbHVlIHx8IHJlY29yZCA9PT0gY3VycmVudFJlY29yZDtcbiAgfVxuICBmdW5jdGlvbiBzZWxlY3RSZWNvcmQobGFzdFJlY29yZCwgbmV3UmVjb3JkKSB7XG4gICAgaWYgKGxhc3RSZWNvcmQgPT09IG5ld1JlY29yZCkgcmV0dXJuIGxhc3RSZWNvcmQ7XG4gICAgaWYgKHJlY29yZFdpdGhPbGRWYWx1ZSAmJiByZWNvcmRSZXByZXNlbnRzQ3VycmVudE11dGF0aW9uKGxhc3RSZWNvcmQpKSByZXR1cm4gcmVjb3JkV2l0aE9sZFZhbHVlO1xuICAgIHJldHVybiBudWxsO1xuICB9XG4gIGZ1bmN0aW9uIFJlZ2lzdHJhdGlvbihvYnNlcnZlciwgdGFyZ2V0LCBvcHRpb25zKSB7XG4gICAgdGhpcy5vYnNlcnZlciA9IG9ic2VydmVyO1xuICAgIHRoaXMudGFyZ2V0ID0gdGFyZ2V0O1xuICAgIHRoaXMub3B0aW9ucyA9IG9wdGlvbnM7XG4gICAgdGhpcy50cmFuc2llbnRPYnNlcnZlZE5vZGVzID0gW107XG4gIH1cbiAgUmVnaXN0cmF0aW9uLnByb3RvdHlwZSA9IHtcbiAgICBlbnF1ZXVlOiBmdW5jdGlvbihyZWNvcmQpIHtcbiAgICAgIHZhciByZWNvcmRzID0gdGhpcy5vYnNlcnZlci5yZWNvcmRzXztcbiAgICAgIHZhciBsZW5ndGggPSByZWNvcmRzLmxlbmd0aDtcbiAgICAgIGlmIChyZWNvcmRzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgdmFyIGxhc3RSZWNvcmQgPSByZWNvcmRzW2xlbmd0aCAtIDFdO1xuICAgICAgICB2YXIgcmVjb3JkVG9SZXBsYWNlTGFzdCA9IHNlbGVjdFJlY29yZChsYXN0UmVjb3JkLCByZWNvcmQpO1xuICAgICAgICBpZiAocmVjb3JkVG9SZXBsYWNlTGFzdCkge1xuICAgICAgICAgIHJlY29yZHNbbGVuZ3RoIC0gMV0gPSByZWNvcmRUb1JlcGxhY2VMYXN0O1xuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgc2NoZWR1bGVDYWxsYmFjayh0aGlzLm9ic2VydmVyKTtcbiAgICAgIH1cbiAgICAgIHJlY29yZHNbbGVuZ3RoXSA9IHJlY29yZDtcbiAgICB9LFxuICAgIGFkZExpc3RlbmVyczogZnVuY3Rpb24oKSB7XG4gICAgICB0aGlzLmFkZExpc3RlbmVyc18odGhpcy50YXJnZXQpO1xuICAgIH0sXG4gICAgYWRkTGlzdGVuZXJzXzogZnVuY3Rpb24obm9kZSkge1xuICAgICAgdmFyIG9wdGlvbnMgPSB0aGlzLm9wdGlvbnM7XG4gICAgICBpZiAob3B0aW9ucy5hdHRyaWJ1dGVzKSBub2RlLmFkZEV2ZW50TGlzdGVuZXIoXCJET01BdHRyTW9kaWZpZWRcIiwgdGhpcywgdHJ1ZSk7XG4gICAgICBpZiAob3B0aW9ucy5jaGFyYWN0ZXJEYXRhKSBub2RlLmFkZEV2ZW50TGlzdGVuZXIoXCJET01DaGFyYWN0ZXJEYXRhTW9kaWZpZWRcIiwgdGhpcywgdHJ1ZSk7XG4gICAgICBpZiAob3B0aW9ucy5jaGlsZExpc3QpIG5vZGUuYWRkRXZlbnRMaXN0ZW5lcihcIkRPTU5vZGVJbnNlcnRlZFwiLCB0aGlzLCB0cnVlKTtcbiAgICAgIGlmIChvcHRpb25zLmNoaWxkTGlzdCB8fCBvcHRpb25zLnN1YnRyZWUpIG5vZGUuYWRkRXZlbnRMaXN0ZW5lcihcIkRPTU5vZGVSZW1vdmVkXCIsIHRoaXMsIHRydWUpO1xuICAgIH0sXG4gICAgcmVtb3ZlTGlzdGVuZXJzOiBmdW5jdGlvbigpIHtcbiAgICAgIHRoaXMucmVtb3ZlTGlzdGVuZXJzXyh0aGlzLnRhcmdldCk7XG4gICAgfSxcbiAgICByZW1vdmVMaXN0ZW5lcnNfOiBmdW5jdGlvbihub2RlKSB7XG4gICAgICB2YXIgb3B0aW9ucyA9IHRoaXMub3B0aW9ucztcbiAgICAgIGlmIChvcHRpb25zLmF0dHJpYnV0ZXMpIG5vZGUucmVtb3ZlRXZlbnRMaXN0ZW5lcihcIkRPTUF0dHJNb2RpZmllZFwiLCB0aGlzLCB0cnVlKTtcbiAgICAgIGlmIChvcHRpb25zLmNoYXJhY3RlckRhdGEpIG5vZGUucmVtb3ZlRXZlbnRMaXN0ZW5lcihcIkRPTUNoYXJhY3RlckRhdGFNb2RpZmllZFwiLCB0aGlzLCB0cnVlKTtcbiAgICAgIGlmIChvcHRpb25zLmNoaWxkTGlzdCkgbm9kZS5yZW1vdmVFdmVudExpc3RlbmVyKFwiRE9NTm9kZUluc2VydGVkXCIsIHRoaXMsIHRydWUpO1xuICAgICAgaWYgKG9wdGlvbnMuY2hpbGRMaXN0IHx8IG9wdGlvbnMuc3VidHJlZSkgbm9kZS5yZW1vdmVFdmVudExpc3RlbmVyKFwiRE9NTm9kZVJlbW92ZWRcIiwgdGhpcywgdHJ1ZSk7XG4gICAgfSxcbiAgICBhZGRUcmFuc2llbnRPYnNlcnZlcjogZnVuY3Rpb24obm9kZSkge1xuICAgICAgaWYgKG5vZGUgPT09IHRoaXMudGFyZ2V0KSByZXR1cm47XG4gICAgICB0aGlzLmFkZExpc3RlbmVyc18obm9kZSk7XG4gICAgICB0aGlzLnRyYW5zaWVudE9ic2VydmVkTm9kZXMucHVzaChub2RlKTtcbiAgICAgIHZhciByZWdpc3RyYXRpb25zID0gcmVnaXN0cmF0aW9uc1RhYmxlLmdldChub2RlKTtcbiAgICAgIGlmICghcmVnaXN0cmF0aW9ucykgcmVnaXN0cmF0aW9uc1RhYmxlLnNldChub2RlLCByZWdpc3RyYXRpb25zID0gW10pO1xuICAgICAgcmVnaXN0cmF0aW9ucy5wdXNoKHRoaXMpO1xuICAgIH0sXG4gICAgcmVtb3ZlVHJhbnNpZW50T2JzZXJ2ZXJzOiBmdW5jdGlvbigpIHtcbiAgICAgIHZhciB0cmFuc2llbnRPYnNlcnZlZE5vZGVzID0gdGhpcy50cmFuc2llbnRPYnNlcnZlZE5vZGVzO1xuICAgICAgdGhpcy50cmFuc2llbnRPYnNlcnZlZE5vZGVzID0gW107XG4gICAgICB0cmFuc2llbnRPYnNlcnZlZE5vZGVzLmZvckVhY2goZnVuY3Rpb24obm9kZSkge1xuICAgICAgICB0aGlzLnJlbW92ZUxpc3RlbmVyc18obm9kZSk7XG4gICAgICAgIHZhciByZWdpc3RyYXRpb25zID0gcmVnaXN0cmF0aW9uc1RhYmxlLmdldChub2RlKTtcbiAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCByZWdpc3RyYXRpb25zLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgaWYgKHJlZ2lzdHJhdGlvbnNbaV0gPT09IHRoaXMpIHtcbiAgICAgICAgICAgIHJlZ2lzdHJhdGlvbnMuc3BsaWNlKGksIDEpO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9LCB0aGlzKTtcbiAgICB9LFxuICAgIGhhbmRsZUV2ZW50OiBmdW5jdGlvbihlKSB7XG4gICAgICBlLnN0b3BJbW1lZGlhdGVQcm9wYWdhdGlvbigpO1xuICAgICAgc3dpdGNoIChlLnR5cGUpIHtcbiAgICAgICBjYXNlIFwiRE9NQXR0ck1vZGlmaWVkXCI6XG4gICAgICAgIHZhciBuYW1lID0gZS5hdHRyTmFtZTtcbiAgICAgICAgdmFyIG5hbWVzcGFjZSA9IGUucmVsYXRlZE5vZGUubmFtZXNwYWNlVVJJO1xuICAgICAgICB2YXIgdGFyZ2V0ID0gZS50YXJnZXQ7XG4gICAgICAgIHZhciByZWNvcmQgPSBuZXcgZ2V0UmVjb3JkKFwiYXR0cmlidXRlc1wiLCB0YXJnZXQpO1xuICAgICAgICByZWNvcmQuYXR0cmlidXRlTmFtZSA9IG5hbWU7XG4gICAgICAgIHJlY29yZC5hdHRyaWJ1dGVOYW1lc3BhY2UgPSBuYW1lc3BhY2U7XG4gICAgICAgIHZhciBvbGRWYWx1ZSA9IGUuYXR0ckNoYW5nZSA9PT0gTXV0YXRpb25FdmVudC5BRERJVElPTiA/IG51bGwgOiBlLnByZXZWYWx1ZTtcbiAgICAgICAgZm9yRWFjaEFuY2VzdG9yQW5kT2JzZXJ2ZXJFbnF1ZXVlUmVjb3JkKHRhcmdldCwgZnVuY3Rpb24ob3B0aW9ucykge1xuICAgICAgICAgIGlmICghb3B0aW9ucy5hdHRyaWJ1dGVzKSByZXR1cm47XG4gICAgICAgICAgaWYgKG9wdGlvbnMuYXR0cmlidXRlRmlsdGVyICYmIG9wdGlvbnMuYXR0cmlidXRlRmlsdGVyLmxlbmd0aCAmJiBvcHRpb25zLmF0dHJpYnV0ZUZpbHRlci5pbmRleE9mKG5hbWUpID09PSAtMSAmJiBvcHRpb25zLmF0dHJpYnV0ZUZpbHRlci5pbmRleE9mKG5hbWVzcGFjZSkgPT09IC0xKSB7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgfVxuICAgICAgICAgIGlmIChvcHRpb25zLmF0dHJpYnV0ZU9sZFZhbHVlKSByZXR1cm4gZ2V0UmVjb3JkV2l0aE9sZFZhbHVlKG9sZFZhbHVlKTtcbiAgICAgICAgICByZXR1cm4gcmVjb3JkO1xuICAgICAgICB9KTtcbiAgICAgICAgYnJlYWs7XG5cbiAgICAgICBjYXNlIFwiRE9NQ2hhcmFjdGVyRGF0YU1vZGlmaWVkXCI6XG4gICAgICAgIHZhciB0YXJnZXQgPSBlLnRhcmdldDtcbiAgICAgICAgdmFyIHJlY29yZCA9IGdldFJlY29yZChcImNoYXJhY3RlckRhdGFcIiwgdGFyZ2V0KTtcbiAgICAgICAgdmFyIG9sZFZhbHVlID0gZS5wcmV2VmFsdWU7XG4gICAgICAgIGZvckVhY2hBbmNlc3RvckFuZE9ic2VydmVyRW5xdWV1ZVJlY29yZCh0YXJnZXQsIGZ1bmN0aW9uKG9wdGlvbnMpIHtcbiAgICAgICAgICBpZiAoIW9wdGlvbnMuY2hhcmFjdGVyRGF0YSkgcmV0dXJuO1xuICAgICAgICAgIGlmIChvcHRpb25zLmNoYXJhY3RlckRhdGFPbGRWYWx1ZSkgcmV0dXJuIGdldFJlY29yZFdpdGhPbGRWYWx1ZShvbGRWYWx1ZSk7XG4gICAgICAgICAgcmV0dXJuIHJlY29yZDtcbiAgICAgICAgfSk7XG4gICAgICAgIGJyZWFrO1xuXG4gICAgICAgY2FzZSBcIkRPTU5vZGVSZW1vdmVkXCI6XG4gICAgICAgIHRoaXMuYWRkVHJhbnNpZW50T2JzZXJ2ZXIoZS50YXJnZXQpO1xuXG4gICAgICAgY2FzZSBcIkRPTU5vZGVJbnNlcnRlZFwiOlxuICAgICAgICB2YXIgdGFyZ2V0ID0gZS5yZWxhdGVkTm9kZTtcbiAgICAgICAgdmFyIGNoYW5nZWROb2RlID0gZS50YXJnZXQ7XG4gICAgICAgIHZhciBhZGRlZE5vZGVzLCByZW1vdmVkTm9kZXM7XG4gICAgICAgIGlmIChlLnR5cGUgPT09IFwiRE9NTm9kZUluc2VydGVkXCIpIHtcbiAgICAgICAgICBhZGRlZE5vZGVzID0gWyBjaGFuZ2VkTm9kZSBdO1xuICAgICAgICAgIHJlbW92ZWROb2RlcyA9IFtdO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGFkZGVkTm9kZXMgPSBbXTtcbiAgICAgICAgICByZW1vdmVkTm9kZXMgPSBbIGNoYW5nZWROb2RlIF07XG4gICAgICAgIH1cbiAgICAgICAgdmFyIHByZXZpb3VzU2libGluZyA9IGNoYW5nZWROb2RlLnByZXZpb3VzU2libGluZztcbiAgICAgICAgdmFyIG5leHRTaWJsaW5nID0gY2hhbmdlZE5vZGUubmV4dFNpYmxpbmc7XG4gICAgICAgIHZhciByZWNvcmQgPSBnZXRSZWNvcmQoXCJjaGlsZExpc3RcIiwgdGFyZ2V0KTtcbiAgICAgICAgcmVjb3JkLmFkZGVkTm9kZXMgPSBhZGRlZE5vZGVzO1xuICAgICAgICByZWNvcmQucmVtb3ZlZE5vZGVzID0gcmVtb3ZlZE5vZGVzO1xuICAgICAgICByZWNvcmQucHJldmlvdXNTaWJsaW5nID0gcHJldmlvdXNTaWJsaW5nO1xuICAgICAgICByZWNvcmQubmV4dFNpYmxpbmcgPSBuZXh0U2libGluZztcbiAgICAgICAgZm9yRWFjaEFuY2VzdG9yQW5kT2JzZXJ2ZXJFbnF1ZXVlUmVjb3JkKHRhcmdldCwgZnVuY3Rpb24ob3B0aW9ucykge1xuICAgICAgICAgIGlmICghb3B0aW9ucy5jaGlsZExpc3QpIHJldHVybjtcbiAgICAgICAgICByZXR1cm4gcmVjb3JkO1xuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICAgIGNsZWFyUmVjb3JkcygpO1xuICAgIH1cbiAgfTtcbiAgZ2xvYmFsLkpzTXV0YXRpb25PYnNlcnZlciA9IEpzTXV0YXRpb25PYnNlcnZlcjtcbiAgaWYgKCFnbG9iYWwuTXV0YXRpb25PYnNlcnZlcikgZ2xvYmFsLk11dGF0aW9uT2JzZXJ2ZXIgPSBKc011dGF0aW9uT2JzZXJ2ZXI7XG59KSh0aGlzKTtcblxud2luZG93LkN1c3RvbUVsZW1lbnRzID0gd2luZG93LkN1c3RvbUVsZW1lbnRzIHx8IHtcbiAgZmxhZ3M6IHt9XG59O1xuXG4oZnVuY3Rpb24oc2NvcGUpIHtcbiAgdmFyIGZsYWdzID0gc2NvcGUuZmxhZ3M7XG4gIHZhciBtb2R1bGVzID0gW107XG4gIHZhciBhZGRNb2R1bGUgPSBmdW5jdGlvbihtb2R1bGUpIHtcbiAgICBtb2R1bGVzLnB1c2gobW9kdWxlKTtcbiAgfTtcbiAgdmFyIGluaXRpYWxpemVNb2R1bGVzID0gZnVuY3Rpb24oKSB7XG4gICAgbW9kdWxlcy5mb3JFYWNoKGZ1bmN0aW9uKG1vZHVsZSkge1xuICAgICAgbW9kdWxlKHNjb3BlKTtcbiAgICB9KTtcbiAgfTtcbiAgc2NvcGUuYWRkTW9kdWxlID0gYWRkTW9kdWxlO1xuICBzY29wZS5pbml0aWFsaXplTW9kdWxlcyA9IGluaXRpYWxpemVNb2R1bGVzO1xuICBzY29wZS5oYXNOYXRpdmUgPSBCb29sZWFuKGRvY3VtZW50LnJlZ2lzdGVyRWxlbWVudCk7XG4gIHNjb3BlLnVzZU5hdGl2ZSA9ICFmbGFncy5yZWdpc3RlciAmJiBzY29wZS5oYXNOYXRpdmUgJiYgIXdpbmRvdy5TaGFkb3dET01Qb2x5ZmlsbCAmJiAoIXdpbmRvdy5IVE1MSW1wb3J0cyB8fCBIVE1MSW1wb3J0cy51c2VOYXRpdmUpO1xufSkoQ3VzdG9tRWxlbWVudHMpO1xuXG5DdXN0b21FbGVtZW50cy5hZGRNb2R1bGUoZnVuY3Rpb24oc2NvcGUpIHtcbiAgdmFyIElNUE9SVF9MSU5LX1RZUEUgPSB3aW5kb3cuSFRNTEltcG9ydHMgPyBIVE1MSW1wb3J0cy5JTVBPUlRfTElOS19UWVBFIDogXCJub25lXCI7XG4gIGZ1bmN0aW9uIGZvclN1YnRyZWUobm9kZSwgY2IpIHtcbiAgICBmaW5kQWxsRWxlbWVudHMobm9kZSwgZnVuY3Rpb24oZSkge1xuICAgICAgaWYgKGNiKGUpKSB7XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgfVxuICAgICAgZm9yUm9vdHMoZSwgY2IpO1xuICAgIH0pO1xuICAgIGZvclJvb3RzKG5vZGUsIGNiKTtcbiAgfVxuICBmdW5jdGlvbiBmaW5kQWxsRWxlbWVudHMobm9kZSwgZmluZCwgZGF0YSkge1xuICAgIHZhciBlID0gbm9kZS5maXJzdEVsZW1lbnRDaGlsZDtcbiAgICBpZiAoIWUpIHtcbiAgICAgIGUgPSBub2RlLmZpcnN0Q2hpbGQ7XG4gICAgICB3aGlsZSAoZSAmJiBlLm5vZGVUeXBlICE9PSBOb2RlLkVMRU1FTlRfTk9ERSkge1xuICAgICAgICBlID0gZS5uZXh0U2libGluZztcbiAgICAgIH1cbiAgICB9XG4gICAgd2hpbGUgKGUpIHtcbiAgICAgIGlmIChmaW5kKGUsIGRhdGEpICE9PSB0cnVlKSB7XG4gICAgICAgIGZpbmRBbGxFbGVtZW50cyhlLCBmaW5kLCBkYXRhKTtcbiAgICAgIH1cbiAgICAgIGUgPSBlLm5leHRFbGVtZW50U2libGluZztcbiAgICB9XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cbiAgZnVuY3Rpb24gZm9yUm9vdHMobm9kZSwgY2IpIHtcbiAgICB2YXIgcm9vdCA9IG5vZGUuc2hhZG93Um9vdDtcbiAgICB3aGlsZSAocm9vdCkge1xuICAgICAgZm9yU3VidHJlZShyb290LCBjYik7XG4gICAgICByb290ID0gcm9vdC5vbGRlclNoYWRvd1Jvb3Q7XG4gICAgfVxuICB9XG4gIHZhciBwcm9jZXNzaW5nRG9jdW1lbnRzO1xuICBmdW5jdGlvbiBmb3JEb2N1bWVudFRyZWUoZG9jLCBjYikge1xuICAgIHByb2Nlc3NpbmdEb2N1bWVudHMgPSBbXTtcbiAgICBfZm9yRG9jdW1lbnRUcmVlKGRvYywgY2IpO1xuICAgIHByb2Nlc3NpbmdEb2N1bWVudHMgPSBudWxsO1xuICB9XG4gIGZ1bmN0aW9uIF9mb3JEb2N1bWVudFRyZWUoZG9jLCBjYikge1xuICAgIGRvYyA9IHdyYXAoZG9jKTtcbiAgICBpZiAocHJvY2Vzc2luZ0RvY3VtZW50cy5pbmRleE9mKGRvYykgPj0gMCkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBwcm9jZXNzaW5nRG9jdW1lbnRzLnB1c2goZG9jKTtcbiAgICB2YXIgaW1wb3J0cyA9IGRvYy5xdWVyeVNlbGVjdG9yQWxsKFwibGlua1tyZWw9XCIgKyBJTVBPUlRfTElOS19UWVBFICsgXCJdXCIpO1xuICAgIGZvciAodmFyIGkgPSAwLCBsID0gaW1wb3J0cy5sZW5ndGgsIG47IGkgPCBsICYmIChuID0gaW1wb3J0c1tpXSk7IGkrKykge1xuICAgICAgaWYgKG4uaW1wb3J0KSB7XG4gICAgICAgIF9mb3JEb2N1bWVudFRyZWUobi5pbXBvcnQsIGNiKTtcbiAgICAgIH1cbiAgICB9XG4gICAgY2IoZG9jKTtcbiAgfVxuICBzY29wZS5mb3JEb2N1bWVudFRyZWUgPSBmb3JEb2N1bWVudFRyZWU7XG4gIHNjb3BlLmZvclN1YnRyZWUgPSBmb3JTdWJ0cmVlO1xufSk7XG5cbkN1c3RvbUVsZW1lbnRzLmFkZE1vZHVsZShmdW5jdGlvbihzY29wZSkge1xuICB2YXIgZmxhZ3MgPSBzY29wZS5mbGFncztcbiAgdmFyIGZvclN1YnRyZWUgPSBzY29wZS5mb3JTdWJ0cmVlO1xuICB2YXIgZm9yRG9jdW1lbnRUcmVlID0gc2NvcGUuZm9yRG9jdW1lbnRUcmVlO1xuICBmdW5jdGlvbiBhZGRlZE5vZGUobm9kZSkge1xuICAgIHJldHVybiBhZGRlZChub2RlKSB8fCBhZGRlZFN1YnRyZWUobm9kZSk7XG4gIH1cbiAgZnVuY3Rpb24gYWRkZWQobm9kZSkge1xuICAgIGlmIChzY29wZS51cGdyYWRlKG5vZGUpKSB7XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG4gICAgYXR0YWNoZWQobm9kZSk7XG4gIH1cbiAgZnVuY3Rpb24gYWRkZWRTdWJ0cmVlKG5vZGUpIHtcbiAgICBmb3JTdWJ0cmVlKG5vZGUsIGZ1bmN0aW9uKGUpIHtcbiAgICAgIGlmIChhZGRlZChlKSkge1xuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgIH1cbiAgICB9KTtcbiAgfVxuICBmdW5jdGlvbiBhdHRhY2hlZE5vZGUobm9kZSkge1xuICAgIGF0dGFjaGVkKG5vZGUpO1xuICAgIGlmIChpbkRvY3VtZW50KG5vZGUpKSB7XG4gICAgICBmb3JTdWJ0cmVlKG5vZGUsIGZ1bmN0aW9uKGUpIHtcbiAgICAgICAgYXR0YWNoZWQoZSk7XG4gICAgICB9KTtcbiAgICB9XG4gIH1cbiAgdmFyIGhhc1BvbHlmaWxsTXV0YXRpb25zID0gIXdpbmRvdy5NdXRhdGlvbk9ic2VydmVyIHx8IHdpbmRvdy5NdXRhdGlvbk9ic2VydmVyID09PSB3aW5kb3cuSnNNdXRhdGlvbk9ic2VydmVyO1xuICBzY29wZS5oYXNQb2x5ZmlsbE11dGF0aW9ucyA9IGhhc1BvbHlmaWxsTXV0YXRpb25zO1xuICB2YXIgaXNQZW5kaW5nTXV0YXRpb25zID0gZmFsc2U7XG4gIHZhciBwZW5kaW5nTXV0YXRpb25zID0gW107XG4gIGZ1bmN0aW9uIGRlZmVyTXV0YXRpb24oZm4pIHtcbiAgICBwZW5kaW5nTXV0YXRpb25zLnB1c2goZm4pO1xuICAgIGlmICghaXNQZW5kaW5nTXV0YXRpb25zKSB7XG4gICAgICBpc1BlbmRpbmdNdXRhdGlvbnMgPSB0cnVlO1xuICAgICAgc2V0VGltZW91dCh0YWtlTXV0YXRpb25zKTtcbiAgICB9XG4gIH1cbiAgZnVuY3Rpb24gdGFrZU11dGF0aW9ucygpIHtcbiAgICBpc1BlbmRpbmdNdXRhdGlvbnMgPSBmYWxzZTtcbiAgICB2YXIgJHAgPSBwZW5kaW5nTXV0YXRpb25zO1xuICAgIGZvciAodmFyIGkgPSAwLCBsID0gJHAubGVuZ3RoLCBwOyBpIDwgbCAmJiAocCA9ICRwW2ldKTsgaSsrKSB7XG4gICAgICBwKCk7XG4gICAgfVxuICAgIHBlbmRpbmdNdXRhdGlvbnMgPSBbXTtcbiAgfVxuICBmdW5jdGlvbiBhdHRhY2hlZChlbGVtZW50KSB7XG4gICAgaWYgKGhhc1BvbHlmaWxsTXV0YXRpb25zKSB7XG4gICAgICBkZWZlck11dGF0aW9uKGZ1bmN0aW9uKCkge1xuICAgICAgICBfYXR0YWNoZWQoZWxlbWVudCk7XG4gICAgICB9KTtcbiAgICB9IGVsc2Uge1xuICAgICAgX2F0dGFjaGVkKGVsZW1lbnQpO1xuICAgIH1cbiAgfVxuICBmdW5jdGlvbiBfYXR0YWNoZWQoZWxlbWVudCkge1xuICAgIGlmIChlbGVtZW50Ll9fdXBncmFkZWRfXyAmJiAoZWxlbWVudC5hdHRhY2hlZENhbGxiYWNrIHx8IGVsZW1lbnQuZGV0YWNoZWRDYWxsYmFjaykpIHtcbiAgICAgIGlmICghZWxlbWVudC5fX2F0dGFjaGVkICYmIGluRG9jdW1lbnQoZWxlbWVudCkpIHtcbiAgICAgICAgZWxlbWVudC5fX2F0dGFjaGVkID0gdHJ1ZTtcbiAgICAgICAgaWYgKGVsZW1lbnQuYXR0YWNoZWRDYWxsYmFjaykge1xuICAgICAgICAgIGVsZW1lbnQuYXR0YWNoZWRDYWxsYmFjaygpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9XG4gIGZ1bmN0aW9uIGRldGFjaGVkTm9kZShub2RlKSB7XG4gICAgZGV0YWNoZWQobm9kZSk7XG4gICAgZm9yU3VidHJlZShub2RlLCBmdW5jdGlvbihlKSB7XG4gICAgICBkZXRhY2hlZChlKTtcbiAgICB9KTtcbiAgfVxuICBmdW5jdGlvbiBkZXRhY2hlZChlbGVtZW50KSB7XG4gICAgaWYgKGhhc1BvbHlmaWxsTXV0YXRpb25zKSB7XG4gICAgICBkZWZlck11dGF0aW9uKGZ1bmN0aW9uKCkge1xuICAgICAgICBfZGV0YWNoZWQoZWxlbWVudCk7XG4gICAgICB9KTtcbiAgICB9IGVsc2Uge1xuICAgICAgX2RldGFjaGVkKGVsZW1lbnQpO1xuICAgIH1cbiAgfVxuICBmdW5jdGlvbiBfZGV0YWNoZWQoZWxlbWVudCkge1xuICAgIGlmIChlbGVtZW50Ll9fdXBncmFkZWRfXyAmJiAoZWxlbWVudC5hdHRhY2hlZENhbGxiYWNrIHx8IGVsZW1lbnQuZGV0YWNoZWRDYWxsYmFjaykpIHtcbiAgICAgIGlmIChlbGVtZW50Ll9fYXR0YWNoZWQgJiYgIWluRG9jdW1lbnQoZWxlbWVudCkpIHtcbiAgICAgICAgZWxlbWVudC5fX2F0dGFjaGVkID0gZmFsc2U7XG4gICAgICAgIGlmIChlbGVtZW50LmRldGFjaGVkQ2FsbGJhY2spIHtcbiAgICAgICAgICBlbGVtZW50LmRldGFjaGVkQ2FsbGJhY2soKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfVxuICBmdW5jdGlvbiBpbkRvY3VtZW50KGVsZW1lbnQpIHtcbiAgICB2YXIgcCA9IGVsZW1lbnQ7XG4gICAgdmFyIGRvYyA9IHdyYXAoZG9jdW1lbnQpO1xuICAgIHdoaWxlIChwKSB7XG4gICAgICBpZiAocCA9PSBkb2MpIHtcbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICB9XG4gICAgICBwID0gcC5wYXJlbnROb2RlIHx8IHAuaG9zdDtcbiAgICB9XG4gIH1cbiAgZnVuY3Rpb24gd2F0Y2hTaGFkb3cobm9kZSkge1xuICAgIGlmIChub2RlLnNoYWRvd1Jvb3QgJiYgIW5vZGUuc2hhZG93Um9vdC5fX3dhdGNoZWQpIHtcbiAgICAgIGZsYWdzLmRvbSAmJiBjb25zb2xlLmxvZyhcIndhdGNoaW5nIHNoYWRvdy1yb290IGZvcjogXCIsIG5vZGUubG9jYWxOYW1lKTtcbiAgICAgIHZhciByb290ID0gbm9kZS5zaGFkb3dSb290O1xuICAgICAgd2hpbGUgKHJvb3QpIHtcbiAgICAgICAgb2JzZXJ2ZShyb290KTtcbiAgICAgICAgcm9vdCA9IHJvb3Qub2xkZXJTaGFkb3dSb290O1xuICAgICAgfVxuICAgIH1cbiAgfVxuICBmdW5jdGlvbiBoYW5kbGVyKG11dGF0aW9ucykge1xuICAgIGlmIChmbGFncy5kb20pIHtcbiAgICAgIHZhciBteCA9IG11dGF0aW9uc1swXTtcbiAgICAgIGlmIChteCAmJiBteC50eXBlID09PSBcImNoaWxkTGlzdFwiICYmIG14LmFkZGVkTm9kZXMpIHtcbiAgICAgICAgaWYgKG14LmFkZGVkTm9kZXMpIHtcbiAgICAgICAgICB2YXIgZCA9IG14LmFkZGVkTm9kZXNbMF07XG4gICAgICAgICAgd2hpbGUgKGQgJiYgZCAhPT0gZG9jdW1lbnQgJiYgIWQuaG9zdCkge1xuICAgICAgICAgICAgZCA9IGQucGFyZW50Tm9kZTtcbiAgICAgICAgICB9XG4gICAgICAgICAgdmFyIHUgPSBkICYmIChkLlVSTCB8fCBkLl9VUkwgfHwgZC5ob3N0ICYmIGQuaG9zdC5sb2NhbE5hbWUpIHx8IFwiXCI7XG4gICAgICAgICAgdSA9IHUuc3BsaXQoXCIvP1wiKS5zaGlmdCgpLnNwbGl0KFwiL1wiKS5wb3AoKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgY29uc29sZS5ncm91cChcIm11dGF0aW9ucyAoJWQpIFslc11cIiwgbXV0YXRpb25zLmxlbmd0aCwgdSB8fCBcIlwiKTtcbiAgICB9XG4gICAgbXV0YXRpb25zLmZvckVhY2goZnVuY3Rpb24obXgpIHtcbiAgICAgIGlmIChteC50eXBlID09PSBcImNoaWxkTGlzdFwiKSB7XG4gICAgICAgIGZvckVhY2gobXguYWRkZWROb2RlcywgZnVuY3Rpb24obikge1xuICAgICAgICAgIGlmICghbi5sb2NhbE5hbWUpIHtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICB9XG4gICAgICAgICAgYWRkZWROb2RlKG4pO1xuICAgICAgICB9KTtcbiAgICAgICAgZm9yRWFjaChteC5yZW1vdmVkTm9kZXMsIGZ1bmN0aW9uKG4pIHtcbiAgICAgICAgICBpZiAoIW4ubG9jYWxOYW1lKSB7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgfVxuICAgICAgICAgIGRldGFjaGVkTm9kZShuKTtcbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgfSk7XG4gICAgZmxhZ3MuZG9tICYmIGNvbnNvbGUuZ3JvdXBFbmQoKTtcbiAgfVxuICBmdW5jdGlvbiB0YWtlUmVjb3Jkcyhub2RlKSB7XG4gICAgbm9kZSA9IHdyYXAobm9kZSk7XG4gICAgaWYgKCFub2RlKSB7XG4gICAgICBub2RlID0gd3JhcChkb2N1bWVudCk7XG4gICAgfVxuICAgIHdoaWxlIChub2RlLnBhcmVudE5vZGUpIHtcbiAgICAgIG5vZGUgPSBub2RlLnBhcmVudE5vZGU7XG4gICAgfVxuICAgIHZhciBvYnNlcnZlciA9IG5vZGUuX19vYnNlcnZlcjtcbiAgICBpZiAob2JzZXJ2ZXIpIHtcbiAgICAgIGhhbmRsZXIob2JzZXJ2ZXIudGFrZVJlY29yZHMoKSk7XG4gICAgICB0YWtlTXV0YXRpb25zKCk7XG4gICAgfVxuICB9XG4gIHZhciBmb3JFYWNoID0gQXJyYXkucHJvdG90eXBlLmZvckVhY2guY2FsbC5iaW5kKEFycmF5LnByb3RvdHlwZS5mb3JFYWNoKTtcbiAgZnVuY3Rpb24gb2JzZXJ2ZShpblJvb3QpIHtcbiAgICBpZiAoaW5Sb290Ll9fb2JzZXJ2ZXIpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgdmFyIG9ic2VydmVyID0gbmV3IE11dGF0aW9uT2JzZXJ2ZXIoaGFuZGxlcik7XG4gICAgb2JzZXJ2ZXIub2JzZXJ2ZShpblJvb3QsIHtcbiAgICAgIGNoaWxkTGlzdDogdHJ1ZSxcbiAgICAgIHN1YnRyZWU6IHRydWVcbiAgICB9KTtcbiAgICBpblJvb3QuX19vYnNlcnZlciA9IG9ic2VydmVyO1xuICB9XG4gIGZ1bmN0aW9uIHVwZ3JhZGVEb2N1bWVudChkb2MpIHtcbiAgICBkb2MgPSB3cmFwKGRvYyk7XG4gICAgZmxhZ3MuZG9tICYmIGNvbnNvbGUuZ3JvdXAoXCJ1cGdyYWRlRG9jdW1lbnQ6IFwiLCBkb2MuYmFzZVVSSS5zcGxpdChcIi9cIikucG9wKCkpO1xuICAgIGFkZGVkTm9kZShkb2MpO1xuICAgIG9ic2VydmUoZG9jKTtcbiAgICBmbGFncy5kb20gJiYgY29uc29sZS5ncm91cEVuZCgpO1xuICB9XG4gIGZ1bmN0aW9uIHVwZ3JhZGVEb2N1bWVudFRyZWUoZG9jKSB7XG4gICAgZm9yRG9jdW1lbnRUcmVlKGRvYywgdXBncmFkZURvY3VtZW50KTtcbiAgfVxuICB2YXIgb3JpZ2luYWxDcmVhdGVTaGFkb3dSb290ID0gRWxlbWVudC5wcm90b3R5cGUuY3JlYXRlU2hhZG93Um9vdDtcbiAgRWxlbWVudC5wcm90b3R5cGUuY3JlYXRlU2hhZG93Um9vdCA9IGZ1bmN0aW9uKCkge1xuICAgIHZhciByb290ID0gb3JpZ2luYWxDcmVhdGVTaGFkb3dSb290LmNhbGwodGhpcyk7XG4gICAgQ3VzdG9tRWxlbWVudHMud2F0Y2hTaGFkb3codGhpcyk7XG4gICAgcmV0dXJuIHJvb3Q7XG4gIH07XG4gIHNjb3BlLndhdGNoU2hhZG93ID0gd2F0Y2hTaGFkb3c7XG4gIHNjb3BlLnVwZ3JhZGVEb2N1bWVudFRyZWUgPSB1cGdyYWRlRG9jdW1lbnRUcmVlO1xuICBzY29wZS51cGdyYWRlU3VidHJlZSA9IGFkZGVkU3VidHJlZTtcbiAgc2NvcGUudXBncmFkZUFsbCA9IGFkZGVkTm9kZTtcbiAgc2NvcGUuYXR0YWNoZWROb2RlID0gYXR0YWNoZWROb2RlO1xuICBzY29wZS50YWtlUmVjb3JkcyA9IHRha2VSZWNvcmRzO1xufSk7XG5cbkN1c3RvbUVsZW1lbnRzLmFkZE1vZHVsZShmdW5jdGlvbihzY29wZSkge1xuICB2YXIgZmxhZ3MgPSBzY29wZS5mbGFncztcbiAgZnVuY3Rpb24gdXBncmFkZShub2RlKSB7XG4gICAgaWYgKCFub2RlLl9fdXBncmFkZWRfXyAmJiBub2RlLm5vZGVUeXBlID09PSBOb2RlLkVMRU1FTlRfTk9ERSkge1xuICAgICAgdmFyIGlzID0gbm9kZS5nZXRBdHRyaWJ1dGUoXCJpc1wiKTtcbiAgICAgIHZhciBkZWZpbml0aW9uID0gc2NvcGUuZ2V0UmVnaXN0ZXJlZERlZmluaXRpb24oaXMgfHwgbm9kZS5sb2NhbE5hbWUpO1xuICAgICAgaWYgKGRlZmluaXRpb24pIHtcbiAgICAgICAgaWYgKGlzICYmIGRlZmluaXRpb24udGFnID09IG5vZGUubG9jYWxOYW1lKSB7XG4gICAgICAgICAgcmV0dXJuIHVwZ3JhZGVXaXRoRGVmaW5pdGlvbihub2RlLCBkZWZpbml0aW9uKTtcbiAgICAgICAgfSBlbHNlIGlmICghaXMgJiYgIWRlZmluaXRpb24uZXh0ZW5kcykge1xuICAgICAgICAgIHJldHVybiB1cGdyYWRlV2l0aERlZmluaXRpb24obm9kZSwgZGVmaW5pdGlvbik7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH1cbiAgZnVuY3Rpb24gdXBncmFkZVdpdGhEZWZpbml0aW9uKGVsZW1lbnQsIGRlZmluaXRpb24pIHtcbiAgICBmbGFncy51cGdyYWRlICYmIGNvbnNvbGUuZ3JvdXAoXCJ1cGdyYWRlOlwiLCBlbGVtZW50LmxvY2FsTmFtZSk7XG4gICAgaWYgKGRlZmluaXRpb24uaXMpIHtcbiAgICAgIGVsZW1lbnQuc2V0QXR0cmlidXRlKFwiaXNcIiwgZGVmaW5pdGlvbi5pcyk7XG4gICAgfVxuICAgIGltcGxlbWVudFByb3RvdHlwZShlbGVtZW50LCBkZWZpbml0aW9uKTtcbiAgICBlbGVtZW50Ll9fdXBncmFkZWRfXyA9IHRydWU7XG4gICAgY3JlYXRlZChlbGVtZW50KTtcbiAgICBzY29wZS5hdHRhY2hlZE5vZGUoZWxlbWVudCk7XG4gICAgc2NvcGUudXBncmFkZVN1YnRyZWUoZWxlbWVudCk7XG4gICAgZmxhZ3MudXBncmFkZSAmJiBjb25zb2xlLmdyb3VwRW5kKCk7XG4gICAgcmV0dXJuIGVsZW1lbnQ7XG4gIH1cbiAgZnVuY3Rpb24gaW1wbGVtZW50UHJvdG90eXBlKGVsZW1lbnQsIGRlZmluaXRpb24pIHtcbiAgICBpZiAoT2JqZWN0Ll9fcHJvdG9fXykge1xuICAgICAgZWxlbWVudC5fX3Byb3RvX18gPSBkZWZpbml0aW9uLnByb3RvdHlwZTtcbiAgICB9IGVsc2Uge1xuICAgICAgY3VzdG9tTWl4aW4oZWxlbWVudCwgZGVmaW5pdGlvbi5wcm90b3R5cGUsIGRlZmluaXRpb24ubmF0aXZlKTtcbiAgICAgIGVsZW1lbnQuX19wcm90b19fID0gZGVmaW5pdGlvbi5wcm90b3R5cGU7XG4gICAgfVxuICB9XG4gIGZ1bmN0aW9uIGN1c3RvbU1peGluKGluVGFyZ2V0LCBpblNyYywgaW5OYXRpdmUpIHtcbiAgICB2YXIgdXNlZCA9IHt9O1xuICAgIHZhciBwID0gaW5TcmM7XG4gICAgd2hpbGUgKHAgIT09IGluTmF0aXZlICYmIHAgIT09IEhUTUxFbGVtZW50LnByb3RvdHlwZSkge1xuICAgICAgdmFyIGtleXMgPSBPYmplY3QuZ2V0T3duUHJvcGVydHlOYW1lcyhwKTtcbiAgICAgIGZvciAodmFyIGkgPSAwLCBrOyBrID0ga2V5c1tpXTsgaSsrKSB7XG4gICAgICAgIGlmICghdXNlZFtrXSkge1xuICAgICAgICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShpblRhcmdldCwgaywgT2JqZWN0LmdldE93blByb3BlcnR5RGVzY3JpcHRvcihwLCBrKSk7XG4gICAgICAgICAgdXNlZFtrXSA9IDE7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIHAgPSBPYmplY3QuZ2V0UHJvdG90eXBlT2YocCk7XG4gICAgfVxuICB9XG4gIGZ1bmN0aW9uIGNyZWF0ZWQoZWxlbWVudCkge1xuICAgIGlmIChlbGVtZW50LmNyZWF0ZWRDYWxsYmFjaykge1xuICAgICAgZWxlbWVudC5jcmVhdGVkQ2FsbGJhY2soKTtcbiAgICB9XG4gIH1cbiAgc2NvcGUudXBncmFkZSA9IHVwZ3JhZGU7XG4gIHNjb3BlLnVwZ3JhZGVXaXRoRGVmaW5pdGlvbiA9IHVwZ3JhZGVXaXRoRGVmaW5pdGlvbjtcbiAgc2NvcGUuaW1wbGVtZW50UHJvdG90eXBlID0gaW1wbGVtZW50UHJvdG90eXBlO1xufSk7XG5cbkN1c3RvbUVsZW1lbnRzLmFkZE1vZHVsZShmdW5jdGlvbihzY29wZSkge1xuICB2YXIgdXBncmFkZURvY3VtZW50VHJlZSA9IHNjb3BlLnVwZ3JhZGVEb2N1bWVudFRyZWU7XG4gIHZhciB1cGdyYWRlID0gc2NvcGUudXBncmFkZTtcbiAgdmFyIHVwZ3JhZGVXaXRoRGVmaW5pdGlvbiA9IHNjb3BlLnVwZ3JhZGVXaXRoRGVmaW5pdGlvbjtcbiAgdmFyIGltcGxlbWVudFByb3RvdHlwZSA9IHNjb3BlLmltcGxlbWVudFByb3RvdHlwZTtcbiAgdmFyIHVzZU5hdGl2ZSA9IHNjb3BlLnVzZU5hdGl2ZTtcbiAgZnVuY3Rpb24gcmVnaXN0ZXIobmFtZSwgb3B0aW9ucykge1xuICAgIHZhciBkZWZpbml0aW9uID0gb3B0aW9ucyB8fCB7fTtcbiAgICBpZiAoIW5hbWUpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihcImRvY3VtZW50LnJlZ2lzdGVyRWxlbWVudDogZmlyc3QgYXJndW1lbnQgYG5hbWVgIG11c3Qgbm90IGJlIGVtcHR5XCIpO1xuICAgIH1cbiAgICBpZiAobmFtZS5pbmRleE9mKFwiLVwiKSA8IDApIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihcImRvY3VtZW50LnJlZ2lzdGVyRWxlbWVudDogZmlyc3QgYXJndW1lbnQgKCduYW1lJykgbXVzdCBjb250YWluIGEgZGFzaCAoJy0nKS4gQXJndW1lbnQgcHJvdmlkZWQgd2FzICdcIiArIFN0cmluZyhuYW1lKSArIFwiJy5cIik7XG4gICAgfVxuICAgIGlmIChpc1Jlc2VydmVkVGFnKG5hbWUpKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoXCJGYWlsZWQgdG8gZXhlY3V0ZSAncmVnaXN0ZXJFbGVtZW50JyBvbiAnRG9jdW1lbnQnOiBSZWdpc3RyYXRpb24gZmFpbGVkIGZvciB0eXBlICdcIiArIFN0cmluZyhuYW1lKSArIFwiJy4gVGhlIHR5cGUgbmFtZSBpcyBpbnZhbGlkLlwiKTtcbiAgICB9XG4gICAgaWYgKGdldFJlZ2lzdGVyZWREZWZpbml0aW9uKG5hbWUpKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoXCJEdXBsaWNhdGVEZWZpbml0aW9uRXJyb3I6IGEgdHlwZSB3aXRoIG5hbWUgJ1wiICsgU3RyaW5nKG5hbWUpICsgXCInIGlzIGFscmVhZHkgcmVnaXN0ZXJlZFwiKTtcbiAgICB9XG4gICAgaWYgKCFkZWZpbml0aW9uLnByb3RvdHlwZSkge1xuICAgICAgZGVmaW5pdGlvbi5wcm90b3R5cGUgPSBPYmplY3QuY3JlYXRlKEhUTUxFbGVtZW50LnByb3RvdHlwZSk7XG4gICAgfVxuICAgIGRlZmluaXRpb24uX19uYW1lID0gbmFtZS50b0xvd2VyQ2FzZSgpO1xuICAgIGRlZmluaXRpb24ubGlmZWN5Y2xlID0gZGVmaW5pdGlvbi5saWZlY3ljbGUgfHwge307XG4gICAgZGVmaW5pdGlvbi5hbmNlc3RyeSA9IGFuY2VzdHJ5KGRlZmluaXRpb24uZXh0ZW5kcyk7XG4gICAgcmVzb2x2ZVRhZ05hbWUoZGVmaW5pdGlvbik7XG4gICAgcmVzb2x2ZVByb3RvdHlwZUNoYWluKGRlZmluaXRpb24pO1xuICAgIG92ZXJyaWRlQXR0cmlidXRlQXBpKGRlZmluaXRpb24ucHJvdG90eXBlKTtcbiAgICByZWdpc3RlckRlZmluaXRpb24oZGVmaW5pdGlvbi5fX25hbWUsIGRlZmluaXRpb24pO1xuICAgIGRlZmluaXRpb24uY3RvciA9IGdlbmVyYXRlQ29uc3RydWN0b3IoZGVmaW5pdGlvbik7XG4gICAgZGVmaW5pdGlvbi5jdG9yLnByb3RvdHlwZSA9IGRlZmluaXRpb24ucHJvdG90eXBlO1xuICAgIGRlZmluaXRpb24ucHJvdG90eXBlLmNvbnN0cnVjdG9yID0gZGVmaW5pdGlvbi5jdG9yO1xuICAgIGlmIChzY29wZS5yZWFkeSkge1xuICAgICAgdXBncmFkZURvY3VtZW50VHJlZShkb2N1bWVudCk7XG4gICAgfVxuICAgIHJldHVybiBkZWZpbml0aW9uLmN0b3I7XG4gIH1cbiAgZnVuY3Rpb24gb3ZlcnJpZGVBdHRyaWJ1dGVBcGkocHJvdG90eXBlKSB7XG4gICAgaWYgKHByb3RvdHlwZS5zZXRBdHRyaWJ1dGUuX3BvbHlmaWxsZWQpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgdmFyIHNldEF0dHJpYnV0ZSA9IHByb3RvdHlwZS5zZXRBdHRyaWJ1dGU7XG4gICAgcHJvdG90eXBlLnNldEF0dHJpYnV0ZSA9IGZ1bmN0aW9uKG5hbWUsIHZhbHVlKSB7XG4gICAgICBjaGFuZ2VBdHRyaWJ1dGUuY2FsbCh0aGlzLCBuYW1lLCB2YWx1ZSwgc2V0QXR0cmlidXRlKTtcbiAgICB9O1xuICAgIHZhciByZW1vdmVBdHRyaWJ1dGUgPSBwcm90b3R5cGUucmVtb3ZlQXR0cmlidXRlO1xuICAgIHByb3RvdHlwZS5yZW1vdmVBdHRyaWJ1dGUgPSBmdW5jdGlvbihuYW1lKSB7XG4gICAgICBjaGFuZ2VBdHRyaWJ1dGUuY2FsbCh0aGlzLCBuYW1lLCBudWxsLCByZW1vdmVBdHRyaWJ1dGUpO1xuICAgIH07XG4gICAgcHJvdG90eXBlLnNldEF0dHJpYnV0ZS5fcG9seWZpbGxlZCA9IHRydWU7XG4gIH1cbiAgZnVuY3Rpb24gY2hhbmdlQXR0cmlidXRlKG5hbWUsIHZhbHVlLCBvcGVyYXRpb24pIHtcbiAgICBuYW1lID0gbmFtZS50b0xvd2VyQ2FzZSgpO1xuICAgIHZhciBvbGRWYWx1ZSA9IHRoaXMuZ2V0QXR0cmlidXRlKG5hbWUpO1xuICAgIG9wZXJhdGlvbi5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xuICAgIHZhciBuZXdWYWx1ZSA9IHRoaXMuZ2V0QXR0cmlidXRlKG5hbWUpO1xuICAgIGlmICh0aGlzLmF0dHJpYnV0ZUNoYW5nZWRDYWxsYmFjayAmJiBuZXdWYWx1ZSAhPT0gb2xkVmFsdWUpIHtcbiAgICAgIHRoaXMuYXR0cmlidXRlQ2hhbmdlZENhbGxiYWNrKG5hbWUsIG9sZFZhbHVlLCBuZXdWYWx1ZSk7XG4gICAgfVxuICB9XG4gIGZ1bmN0aW9uIGlzUmVzZXJ2ZWRUYWcobmFtZSkge1xuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgcmVzZXJ2ZWRUYWdMaXN0Lmxlbmd0aDsgaSsrKSB7XG4gICAgICBpZiAobmFtZSA9PT0gcmVzZXJ2ZWRUYWdMaXN0W2ldKSB7XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgfVxuICAgIH1cbiAgfVxuICB2YXIgcmVzZXJ2ZWRUYWdMaXN0ID0gWyBcImFubm90YXRpb24teG1sXCIsIFwiY29sb3ItcHJvZmlsZVwiLCBcImZvbnQtZmFjZVwiLCBcImZvbnQtZmFjZS1zcmNcIiwgXCJmb250LWZhY2UtdXJpXCIsIFwiZm9udC1mYWNlLWZvcm1hdFwiLCBcImZvbnQtZmFjZS1uYW1lXCIsIFwibWlzc2luZy1nbHlwaFwiIF07XG4gIGZ1bmN0aW9uIGFuY2VzdHJ5KGV4dG5kcykge1xuICAgIHZhciBleHRlbmRlZSA9IGdldFJlZ2lzdGVyZWREZWZpbml0aW9uKGV4dG5kcyk7XG4gICAgaWYgKGV4dGVuZGVlKSB7XG4gICAgICByZXR1cm4gYW5jZXN0cnkoZXh0ZW5kZWUuZXh0ZW5kcykuY29uY2F0KFsgZXh0ZW5kZWUgXSk7XG4gICAgfVxuICAgIHJldHVybiBbXTtcbiAgfVxuICBmdW5jdGlvbiByZXNvbHZlVGFnTmFtZShkZWZpbml0aW9uKSB7XG4gICAgdmFyIGJhc2VUYWcgPSBkZWZpbml0aW9uLmV4dGVuZHM7XG4gICAgZm9yICh2YXIgaSA9IDAsIGE7IGEgPSBkZWZpbml0aW9uLmFuY2VzdHJ5W2ldOyBpKyspIHtcbiAgICAgIGJhc2VUYWcgPSBhLmlzICYmIGEudGFnO1xuICAgIH1cbiAgICBkZWZpbml0aW9uLnRhZyA9IGJhc2VUYWcgfHwgZGVmaW5pdGlvbi5fX25hbWU7XG4gICAgaWYgKGJhc2VUYWcpIHtcbiAgICAgIGRlZmluaXRpb24uaXMgPSBkZWZpbml0aW9uLl9fbmFtZTtcbiAgICB9XG4gIH1cbiAgZnVuY3Rpb24gcmVzb2x2ZVByb3RvdHlwZUNoYWluKGRlZmluaXRpb24pIHtcbiAgICBpZiAoIU9iamVjdC5fX3Byb3RvX18pIHtcbiAgICAgIHZhciBuYXRpdmVQcm90b3R5cGUgPSBIVE1MRWxlbWVudC5wcm90b3R5cGU7XG4gICAgICBpZiAoZGVmaW5pdGlvbi5pcykge1xuICAgICAgICB2YXIgaW5zdCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoZGVmaW5pdGlvbi50YWcpO1xuICAgICAgICB2YXIgZXhwZWN0ZWRQcm90b3R5cGUgPSBPYmplY3QuZ2V0UHJvdG90eXBlT2YoaW5zdCk7XG4gICAgICAgIGlmIChleHBlY3RlZFByb3RvdHlwZSA9PT0gZGVmaW5pdGlvbi5wcm90b3R5cGUpIHtcbiAgICAgICAgICBuYXRpdmVQcm90b3R5cGUgPSBleHBlY3RlZFByb3RvdHlwZTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgdmFyIHByb3RvID0gZGVmaW5pdGlvbi5wcm90b3R5cGUsIGFuY2VzdG9yO1xuICAgICAgd2hpbGUgKHByb3RvICYmIHByb3RvICE9PSBuYXRpdmVQcm90b3R5cGUpIHtcbiAgICAgICAgYW5jZXN0b3IgPSBPYmplY3QuZ2V0UHJvdG90eXBlT2YocHJvdG8pO1xuICAgICAgICBwcm90by5fX3Byb3RvX18gPSBhbmNlc3RvcjtcbiAgICAgICAgcHJvdG8gPSBhbmNlc3RvcjtcbiAgICAgIH1cbiAgICAgIGRlZmluaXRpb24ubmF0aXZlID0gbmF0aXZlUHJvdG90eXBlO1xuICAgIH1cbiAgfVxuICBmdW5jdGlvbiBpbnN0YW50aWF0ZShkZWZpbml0aW9uKSB7XG4gICAgcmV0dXJuIHVwZ3JhZGVXaXRoRGVmaW5pdGlvbihkb21DcmVhdGVFbGVtZW50KGRlZmluaXRpb24udGFnKSwgZGVmaW5pdGlvbik7XG4gIH1cbiAgdmFyIHJlZ2lzdHJ5ID0ge307XG4gIGZ1bmN0aW9uIGdldFJlZ2lzdGVyZWREZWZpbml0aW9uKG5hbWUpIHtcbiAgICBpZiAobmFtZSkge1xuICAgICAgcmV0dXJuIHJlZ2lzdHJ5W25hbWUudG9Mb3dlckNhc2UoKV07XG4gICAgfVxuICB9XG4gIGZ1bmN0aW9uIHJlZ2lzdGVyRGVmaW5pdGlvbihuYW1lLCBkZWZpbml0aW9uKSB7XG4gICAgcmVnaXN0cnlbbmFtZV0gPSBkZWZpbml0aW9uO1xuICB9XG4gIGZ1bmN0aW9uIGdlbmVyYXRlQ29uc3RydWN0b3IoZGVmaW5pdGlvbikge1xuICAgIHJldHVybiBmdW5jdGlvbigpIHtcbiAgICAgIHJldHVybiBpbnN0YW50aWF0ZShkZWZpbml0aW9uKTtcbiAgICB9O1xuICB9XG4gIHZhciBIVE1MX05BTUVTUEFDRSA9IFwiaHR0cDovL3d3dy53My5vcmcvMTk5OS94aHRtbFwiO1xuICBmdW5jdGlvbiBjcmVhdGVFbGVtZW50TlMobmFtZXNwYWNlLCB0YWcsIHR5cGVFeHRlbnNpb24pIHtcbiAgICBpZiAobmFtZXNwYWNlID09PSBIVE1MX05BTUVTUEFDRSkge1xuICAgICAgcmV0dXJuIGNyZWF0ZUVsZW1lbnQodGFnLCB0eXBlRXh0ZW5zaW9uKTtcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIGRvbUNyZWF0ZUVsZW1lbnROUyhuYW1lc3BhY2UsIHRhZyk7XG4gICAgfVxuICB9XG4gIGZ1bmN0aW9uIGNyZWF0ZUVsZW1lbnQodGFnLCB0eXBlRXh0ZW5zaW9uKSB7XG4gICAgdmFyIGRlZmluaXRpb24gPSBnZXRSZWdpc3RlcmVkRGVmaW5pdGlvbih0eXBlRXh0ZW5zaW9uIHx8IHRhZyk7XG4gICAgaWYgKGRlZmluaXRpb24pIHtcbiAgICAgIGlmICh0YWcgPT0gZGVmaW5pdGlvbi50YWcgJiYgdHlwZUV4dGVuc2lvbiA9PSBkZWZpbml0aW9uLmlzKSB7XG4gICAgICAgIHJldHVybiBuZXcgZGVmaW5pdGlvbi5jdG9yKCk7XG4gICAgICB9XG4gICAgICBpZiAoIXR5cGVFeHRlbnNpb24gJiYgIWRlZmluaXRpb24uaXMpIHtcbiAgICAgICAgcmV0dXJuIG5ldyBkZWZpbml0aW9uLmN0b3IoKTtcbiAgICAgIH1cbiAgICB9XG4gICAgdmFyIGVsZW1lbnQ7XG4gICAgaWYgKHR5cGVFeHRlbnNpb24pIHtcbiAgICAgIGVsZW1lbnQgPSBjcmVhdGVFbGVtZW50KHRhZyk7XG4gICAgICBlbGVtZW50LnNldEF0dHJpYnV0ZShcImlzXCIsIHR5cGVFeHRlbnNpb24pO1xuICAgICAgcmV0dXJuIGVsZW1lbnQ7XG4gICAgfVxuICAgIGVsZW1lbnQgPSBkb21DcmVhdGVFbGVtZW50KHRhZyk7XG4gICAgaWYgKHRhZy5pbmRleE9mKFwiLVwiKSA+PSAwKSB7XG4gICAgICBpbXBsZW1lbnRQcm90b3R5cGUoZWxlbWVudCwgSFRNTEVsZW1lbnQpO1xuICAgIH1cbiAgICByZXR1cm4gZWxlbWVudDtcbiAgfVxuICBmdW5jdGlvbiBjbG9uZU5vZGUoZGVlcCkge1xuICAgIHZhciBuID0gZG9tQ2xvbmVOb2RlLmNhbGwodGhpcywgZGVlcCk7XG4gICAgdXBncmFkZShuKTtcbiAgICByZXR1cm4gbjtcbiAgfVxuICB2YXIgZG9tQ3JlYXRlRWxlbWVudCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQuYmluZChkb2N1bWVudCk7XG4gIHZhciBkb21DcmVhdGVFbGVtZW50TlMgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50TlMuYmluZChkb2N1bWVudCk7XG4gIHZhciBkb21DbG9uZU5vZGUgPSBOb2RlLnByb3RvdHlwZS5jbG9uZU5vZGU7XG4gIHZhciBpc0luc3RhbmNlO1xuICBpZiAoIU9iamVjdC5fX3Byb3RvX18gJiYgIXVzZU5hdGl2ZSkge1xuICAgIGlzSW5zdGFuY2UgPSBmdW5jdGlvbihvYmosIGN0b3IpIHtcbiAgICAgIHZhciBwID0gb2JqO1xuICAgICAgd2hpbGUgKHApIHtcbiAgICAgICAgaWYgKHAgPT09IGN0b3IucHJvdG90eXBlKSB7XG4gICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgIH1cbiAgICAgICAgcCA9IHAuX19wcm90b19fO1xuICAgICAgfVxuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH07XG4gIH0gZWxzZSB7XG4gICAgaXNJbnN0YW5jZSA9IGZ1bmN0aW9uKG9iaiwgYmFzZSkge1xuICAgICAgcmV0dXJuIG9iaiBpbnN0YW5jZW9mIGJhc2U7XG4gICAgfTtcbiAgfVxuICBkb2N1bWVudC5yZWdpc3RlckVsZW1lbnQgPSByZWdpc3RlcjtcbiAgZG9jdW1lbnQuY3JlYXRlRWxlbWVudCA9IGNyZWF0ZUVsZW1lbnQ7XG4gIGRvY3VtZW50LmNyZWF0ZUVsZW1lbnROUyA9IGNyZWF0ZUVsZW1lbnROUztcbiAgTm9kZS5wcm90b3R5cGUuY2xvbmVOb2RlID0gY2xvbmVOb2RlO1xuICBzY29wZS5yZWdpc3RyeSA9IHJlZ2lzdHJ5O1xuICBzY29wZS5pbnN0YW5jZW9mID0gaXNJbnN0YW5jZTtcbiAgc2NvcGUucmVzZXJ2ZWRUYWdMaXN0ID0gcmVzZXJ2ZWRUYWdMaXN0O1xuICBzY29wZS5nZXRSZWdpc3RlcmVkRGVmaW5pdGlvbiA9IGdldFJlZ2lzdGVyZWREZWZpbml0aW9uO1xuICBkb2N1bWVudC5yZWdpc3RlciA9IGRvY3VtZW50LnJlZ2lzdGVyRWxlbWVudDtcbn0pO1xuXG4oZnVuY3Rpb24oc2NvcGUpIHtcbiAgdmFyIHVzZU5hdGl2ZSA9IHNjb3BlLnVzZU5hdGl2ZTtcbiAgdmFyIGluaXRpYWxpemVNb2R1bGVzID0gc2NvcGUuaW5pdGlhbGl6ZU1vZHVsZXM7XG4gIHZhciBpc0lFMTFPck9sZGVyID0gL1RyaWRlbnQvLnRlc3QobmF2aWdhdG9yLnVzZXJBZ2VudCk7XG4gIGlmICh1c2VOYXRpdmUpIHtcbiAgICB2YXIgbm9wID0gZnVuY3Rpb24oKSB7fTtcbiAgICBzY29wZS53YXRjaFNoYWRvdyA9IG5vcDtcbiAgICBzY29wZS51cGdyYWRlID0gbm9wO1xuICAgIHNjb3BlLnVwZ3JhZGVBbGwgPSBub3A7XG4gICAgc2NvcGUudXBncmFkZURvY3VtZW50VHJlZSA9IG5vcDtcbiAgICBzY29wZS51cGdyYWRlU3VidHJlZSA9IG5vcDtcbiAgICBzY29wZS50YWtlUmVjb3JkcyA9IG5vcDtcbiAgICBzY29wZS5pbnN0YW5jZW9mID0gZnVuY3Rpb24ob2JqLCBiYXNlKSB7XG4gICAgICByZXR1cm4gb2JqIGluc3RhbmNlb2YgYmFzZTtcbiAgICB9O1xuICB9IGVsc2Uge1xuICAgIGluaXRpYWxpemVNb2R1bGVzKCk7XG4gIH1cbiAgdmFyIHVwZ3JhZGVEb2N1bWVudFRyZWUgPSBzY29wZS51cGdyYWRlRG9jdW1lbnRUcmVlO1xuICBpZiAoIXdpbmRvdy53cmFwKSB7XG4gICAgaWYgKHdpbmRvdy5TaGFkb3dET01Qb2x5ZmlsbCkge1xuICAgICAgd2luZG93LndyYXAgPSBTaGFkb3dET01Qb2x5ZmlsbC53cmFwSWZOZWVkZWQ7XG4gICAgICB3aW5kb3cudW53cmFwID0gU2hhZG93RE9NUG9seWZpbGwudW53cmFwSWZOZWVkZWQ7XG4gICAgfSBlbHNlIHtcbiAgICAgIHdpbmRvdy53cmFwID0gd2luZG93LnVud3JhcCA9IGZ1bmN0aW9uKG5vZGUpIHtcbiAgICAgICAgcmV0dXJuIG5vZGU7XG4gICAgICB9O1xuICAgIH1cbiAgfVxuICBmdW5jdGlvbiBib290c3RyYXAoKSB7XG4gICAgdXBncmFkZURvY3VtZW50VHJlZSh3cmFwKGRvY3VtZW50KSk7XG4gICAgaWYgKHdpbmRvdy5IVE1MSW1wb3J0cykge1xuICAgICAgSFRNTEltcG9ydHMuX19pbXBvcnRzUGFyc2luZ0hvb2sgPSBmdW5jdGlvbihlbHQpIHtcbiAgICAgICAgdXBncmFkZURvY3VtZW50VHJlZSh3cmFwKGVsdC5pbXBvcnQpKTtcbiAgICAgIH07XG4gICAgfVxuICAgIEN1c3RvbUVsZW1lbnRzLnJlYWR5ID0gdHJ1ZTtcbiAgICBzZXRUaW1lb3V0KGZ1bmN0aW9uKCkge1xuICAgICAgQ3VzdG9tRWxlbWVudHMucmVhZHlUaW1lID0gRGF0ZS5ub3coKTtcbiAgICAgIGlmICh3aW5kb3cuSFRNTEltcG9ydHMpIHtcbiAgICAgICAgQ3VzdG9tRWxlbWVudHMuZWxhcHNlZCA9IEN1c3RvbUVsZW1lbnRzLnJlYWR5VGltZSAtIEhUTUxJbXBvcnRzLnJlYWR5VGltZTtcbiAgICAgIH1cbiAgICAgIGRvY3VtZW50LmRpc3BhdGNoRXZlbnQobmV3IEN1c3RvbUV2ZW50KFwiV2ViQ29tcG9uZW50c1JlYWR5XCIsIHtcbiAgICAgICAgYnViYmxlczogdHJ1ZVxuICAgICAgfSkpO1xuICAgIH0pO1xuICB9XG4gIGlmIChpc0lFMTFPck9sZGVyICYmIHR5cGVvZiB3aW5kb3cuQ3VzdG9tRXZlbnQgIT09IFwiZnVuY3Rpb25cIikge1xuICAgIHdpbmRvdy5DdXN0b21FdmVudCA9IGZ1bmN0aW9uKGluVHlwZSwgcGFyYW1zKSB7XG4gICAgICBwYXJhbXMgPSBwYXJhbXMgfHwge307XG4gICAgICB2YXIgZSA9IGRvY3VtZW50LmNyZWF0ZUV2ZW50KFwiQ3VzdG9tRXZlbnRcIik7XG4gICAgICBlLmluaXRDdXN0b21FdmVudChpblR5cGUsIEJvb2xlYW4ocGFyYW1zLmJ1YmJsZXMpLCBCb29sZWFuKHBhcmFtcy5jYW5jZWxhYmxlKSwgcGFyYW1zLmRldGFpbCk7XG4gICAgICByZXR1cm4gZTtcbiAgICB9O1xuICAgIHdpbmRvdy5DdXN0b21FdmVudC5wcm90b3R5cGUgPSB3aW5kb3cuRXZlbnQucHJvdG90eXBlO1xuICB9XG4gIGlmIChkb2N1bWVudC5yZWFkeVN0YXRlID09PSBcImNvbXBsZXRlXCIgfHwgc2NvcGUuZmxhZ3MuZWFnZXIpIHtcbiAgICBib290c3RyYXAoKTtcbiAgfSBlbHNlIGlmIChkb2N1bWVudC5yZWFkeVN0YXRlID09PSBcImludGVyYWN0aXZlXCIgJiYgIXdpbmRvdy5hdHRhY2hFdmVudCAmJiAoIXdpbmRvdy5IVE1MSW1wb3J0cyB8fCB3aW5kb3cuSFRNTEltcG9ydHMucmVhZHkpKSB7XG4gICAgYm9vdHN0cmFwKCk7XG4gIH0gZWxzZSB7XG4gICAgdmFyIGxvYWRFdmVudCA9IHdpbmRvdy5IVE1MSW1wb3J0cyAmJiAhSFRNTEltcG9ydHMucmVhZHkgPyBcIkhUTUxJbXBvcnRzTG9hZGVkXCIgOiBcIkRPTUNvbnRlbnRMb2FkZWRcIjtcbiAgICB3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lcihsb2FkRXZlbnQsIGJvb3RzdHJhcCk7XG4gIH1cbn0pKHdpbmRvdy5DdXN0b21FbGVtZW50cyk7IiwiLy8gaW1wb3J0IHRoZSBwb2x5ZmlsbCBmcm9tIG5vZGVfbW9kdWxlc1xuaW1wb3J0IEN1c3RvbUVsZW1lbnRzIGZyb20gJ3dlYmNvbXBvbmVudHMuanMvQ3VzdG9tRWxlbWVudHMnXG5cbi8vIGRlZmluZSB0aGUgY2xhc3NcbmNsYXNzIERhdGVTcGFuIGV4dGVuZHMgSFRNTFNwYW5FbGVtZW50IHtcbiAgIGNyZWF0ZWRDYWxsYmFjaygpIHtcbiAgICAgdGhpcy50ZXh0Q29udGVudCA9IFwiVG9kYXkncyBkYXRlOiBcIiArIG5ldyBEYXRlKCkudG9KU09OKCkuc2xpY2UoMCwgMTApXG4gICB9XG59XG5cbi8vIHJlZ2lzdGVyIHRoZSBlbGVtZW50IHcvIHRoZSBET01cbmxldCBEYXRlU3BhbkVsZW1lbnQgPSBkb2N1bWVudC5yZWdpc3RlckVsZW1lbnQoJ2RhdGUtdG9kYXknLCBEYXRlU3BhbilcblxuLy8gZXhwb3J0IGZvciBvdGhlciBwcGwgdG8gcmV1c2UhXG5leHBvcnQgZGVmYXVsdCBEYXRlU3BhbkVsZW1lbnRcbiJdfQ==
