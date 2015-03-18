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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJub2RlX21vZHVsZXMvd2ViY29tcG9uZW50cy5qcy9DdXN0b21FbGVtZW50cy5qcyIsIi9Vc2Vycy9icmlhbmxlcm91eC9EZXNrdG9wL2RhdGUtdG9kYXkvc3JjL2luZGV4LmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7Ozs7Ozs7Ozs7SUNsNkJPLGNBQWMsMkJBQU0saUNBQWlDOzs7SUFHdEQsUUFBUSxjQUFTLGVBQWU7V0FBaEMsUUFBUTs4QkFBUixRQUFROzRCQUFSLFFBQVE7Ozs7WUFBUixRQUFRLEVBQVMsZUFBZTs7dUJBQWhDLFFBQVE7QUFDWCxtQkFBZTthQUFBLDJCQUFHO0FBQ2hCLFlBQUksQ0FBQyxXQUFXLEdBQUcsZ0JBQWdCLEdBQUcsSUFBSSxJQUFJLEVBQUUsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxLQUFLLENBQUMsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxDQUFBO09BQ3ZFOzs7Ozs7U0FIRSxRQUFRO0dBQVMsZUFBZTs7O0FBT3RDLElBQUksZUFBZSxHQUFHLFFBQVEsQ0FBQyxlQUFlLENBQUMsWUFBWSxFQUFFLFFBQVEsQ0FBQyxDQUFBOzs7aUJBR3ZELGVBQWUiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dmFyIGY9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKTt0aHJvdyBmLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsZn12YXIgbD1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwobC5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxsLGwuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc30pIiwiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IChjKSAyMDE0IFRoZSBQb2x5bWVyIFByb2plY3QgQXV0aG9ycy4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqIFRoaXMgY29kZSBtYXkgb25seSBiZSB1c2VkIHVuZGVyIHRoZSBCU0Qgc3R5bGUgbGljZW5zZSBmb3VuZCBhdCBodHRwOi8vcG9seW1lci5naXRodWIuaW8vTElDRU5TRS50eHRcbiAqIFRoZSBjb21wbGV0ZSBzZXQgb2YgYXV0aG9ycyBtYXkgYmUgZm91bmQgYXQgaHR0cDovL3BvbHltZXIuZ2l0aHViLmlvL0FVVEhPUlMudHh0XG4gKiBUaGUgY29tcGxldGUgc2V0IG9mIGNvbnRyaWJ1dG9ycyBtYXkgYmUgZm91bmQgYXQgaHR0cDovL3BvbHltZXIuZ2l0aHViLmlvL0NPTlRSSUJVVE9SUy50eHRcbiAqIENvZGUgZGlzdHJpYnV0ZWQgYnkgR29vZ2xlIGFzIHBhcnQgb2YgdGhlIHBvbHltZXIgcHJvamVjdCBpcyBhbHNvXG4gKiBzdWJqZWN0IHRvIGFuIGFkZGl0aW9uYWwgSVAgcmlnaHRzIGdyYW50IGZvdW5kIGF0IGh0dHA6Ly9wb2x5bWVyLmdpdGh1Yi5pby9QQVRFTlRTLnR4dFxuICovXG4vLyBAdmVyc2lvbiAwLjUuNFxuaWYgKHR5cGVvZiBXZWFrTWFwID09PSBcInVuZGVmaW5lZFwiKSB7XG4gIChmdW5jdGlvbigpIHtcbiAgICB2YXIgZGVmaW5lUHJvcGVydHkgPSBPYmplY3QuZGVmaW5lUHJvcGVydHk7XG4gICAgdmFyIGNvdW50ZXIgPSBEYXRlLm5vdygpICUgMWU5O1xuICAgIHZhciBXZWFrTWFwID0gZnVuY3Rpb24oKSB7XG4gICAgICB0aGlzLm5hbWUgPSBcIl9fc3RcIiArIChNYXRoLnJhbmRvbSgpICogMWU5ID4+PiAwKSArIChjb3VudGVyKysgKyBcIl9fXCIpO1xuICAgIH07XG4gICAgV2Vha01hcC5wcm90b3R5cGUgPSB7XG4gICAgICBzZXQ6IGZ1bmN0aW9uKGtleSwgdmFsdWUpIHtcbiAgICAgICAgdmFyIGVudHJ5ID0ga2V5W3RoaXMubmFtZV07XG4gICAgICAgIGlmIChlbnRyeSAmJiBlbnRyeVswXSA9PT0ga2V5KSBlbnRyeVsxXSA9IHZhbHVlOyBlbHNlIGRlZmluZVByb3BlcnR5KGtleSwgdGhpcy5uYW1lLCB7XG4gICAgICAgICAgdmFsdWU6IFsga2V5LCB2YWx1ZSBdLFxuICAgICAgICAgIHdyaXRhYmxlOiB0cnVlXG4gICAgICAgIH0pO1xuICAgICAgICByZXR1cm4gdGhpcztcbiAgICAgIH0sXG4gICAgICBnZXQ6IGZ1bmN0aW9uKGtleSkge1xuICAgICAgICB2YXIgZW50cnk7XG4gICAgICAgIHJldHVybiAoZW50cnkgPSBrZXlbdGhpcy5uYW1lXSkgJiYgZW50cnlbMF0gPT09IGtleSA/IGVudHJ5WzFdIDogdW5kZWZpbmVkO1xuICAgICAgfSxcbiAgICAgIFwiZGVsZXRlXCI6IGZ1bmN0aW9uKGtleSkge1xuICAgICAgICB2YXIgZW50cnkgPSBrZXlbdGhpcy5uYW1lXTtcbiAgICAgICAgaWYgKCFlbnRyeSB8fCBlbnRyeVswXSAhPT0ga2V5KSByZXR1cm4gZmFsc2U7XG4gICAgICAgIGVudHJ5WzBdID0gZW50cnlbMV0gPSB1bmRlZmluZWQ7XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgfSxcbiAgICAgIGhhczogZnVuY3Rpb24oa2V5KSB7XG4gICAgICAgIHZhciBlbnRyeSA9IGtleVt0aGlzLm5hbWVdO1xuICAgICAgICBpZiAoIWVudHJ5KSByZXR1cm4gZmFsc2U7XG4gICAgICAgIHJldHVybiBlbnRyeVswXSA9PT0ga2V5O1xuICAgICAgfVxuICAgIH07XG4gICAgd2luZG93LldlYWtNYXAgPSBXZWFrTWFwO1xuICB9KSgpO1xufVxuXG4oZnVuY3Rpb24oZ2xvYmFsKSB7XG4gIHZhciByZWdpc3RyYXRpb25zVGFibGUgPSBuZXcgV2Vha01hcCgpO1xuICB2YXIgc2V0SW1tZWRpYXRlO1xuICBpZiAoL1RyaWRlbnR8RWRnZS8udGVzdChuYXZpZ2F0b3IudXNlckFnZW50KSkge1xuICAgIHNldEltbWVkaWF0ZSA9IHNldFRpbWVvdXQ7XG4gIH0gZWxzZSBpZiAod2luZG93LnNldEltbWVkaWF0ZSkge1xuICAgIHNldEltbWVkaWF0ZSA9IHdpbmRvdy5zZXRJbW1lZGlhdGU7XG4gIH0gZWxzZSB7XG4gICAgdmFyIHNldEltbWVkaWF0ZVF1ZXVlID0gW107XG4gICAgdmFyIHNlbnRpbmVsID0gU3RyaW5nKE1hdGgucmFuZG9tKCkpO1xuICAgIHdpbmRvdy5hZGRFdmVudExpc3RlbmVyKFwibWVzc2FnZVwiLCBmdW5jdGlvbihlKSB7XG4gICAgICBpZiAoZS5kYXRhID09PSBzZW50aW5lbCkge1xuICAgICAgICB2YXIgcXVldWUgPSBzZXRJbW1lZGlhdGVRdWV1ZTtcbiAgICAgICAgc2V0SW1tZWRpYXRlUXVldWUgPSBbXTtcbiAgICAgICAgcXVldWUuZm9yRWFjaChmdW5jdGlvbihmdW5jKSB7XG4gICAgICAgICAgZnVuYygpO1xuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICB9KTtcbiAgICBzZXRJbW1lZGlhdGUgPSBmdW5jdGlvbihmdW5jKSB7XG4gICAgICBzZXRJbW1lZGlhdGVRdWV1ZS5wdXNoKGZ1bmMpO1xuICAgICAgd2luZG93LnBvc3RNZXNzYWdlKHNlbnRpbmVsLCBcIipcIik7XG4gICAgfTtcbiAgfVxuICB2YXIgaXNTY2hlZHVsZWQgPSBmYWxzZTtcbiAgdmFyIHNjaGVkdWxlZE9ic2VydmVycyA9IFtdO1xuICBmdW5jdGlvbiBzY2hlZHVsZUNhbGxiYWNrKG9ic2VydmVyKSB7XG4gICAgc2NoZWR1bGVkT2JzZXJ2ZXJzLnB1c2gob2JzZXJ2ZXIpO1xuICAgIGlmICghaXNTY2hlZHVsZWQpIHtcbiAgICAgIGlzU2NoZWR1bGVkID0gdHJ1ZTtcbiAgICAgIHNldEltbWVkaWF0ZShkaXNwYXRjaENhbGxiYWNrcyk7XG4gICAgfVxuICB9XG4gIGZ1bmN0aW9uIHdyYXBJZk5lZWRlZChub2RlKSB7XG4gICAgcmV0dXJuIHdpbmRvdy5TaGFkb3dET01Qb2x5ZmlsbCAmJiB3aW5kb3cuU2hhZG93RE9NUG9seWZpbGwud3JhcElmTmVlZGVkKG5vZGUpIHx8IG5vZGU7XG4gIH1cbiAgZnVuY3Rpb24gZGlzcGF0Y2hDYWxsYmFja3MoKSB7XG4gICAgaXNTY2hlZHVsZWQgPSBmYWxzZTtcbiAgICB2YXIgb2JzZXJ2ZXJzID0gc2NoZWR1bGVkT2JzZXJ2ZXJzO1xuICAgIHNjaGVkdWxlZE9ic2VydmVycyA9IFtdO1xuICAgIG9ic2VydmVycy5zb3J0KGZ1bmN0aW9uKG8xLCBvMikge1xuICAgICAgcmV0dXJuIG8xLnVpZF8gLSBvMi51aWRfO1xuICAgIH0pO1xuICAgIHZhciBhbnlOb25FbXB0eSA9IGZhbHNlO1xuICAgIG9ic2VydmVycy5mb3JFYWNoKGZ1bmN0aW9uKG9ic2VydmVyKSB7XG4gICAgICB2YXIgcXVldWUgPSBvYnNlcnZlci50YWtlUmVjb3JkcygpO1xuICAgICAgcmVtb3ZlVHJhbnNpZW50T2JzZXJ2ZXJzRm9yKG9ic2VydmVyKTtcbiAgICAgIGlmIChxdWV1ZS5sZW5ndGgpIHtcbiAgICAgICAgb2JzZXJ2ZXIuY2FsbGJhY2tfKHF1ZXVlLCBvYnNlcnZlcik7XG4gICAgICAgIGFueU5vbkVtcHR5ID0gdHJ1ZTtcbiAgICAgIH1cbiAgICB9KTtcbiAgICBpZiAoYW55Tm9uRW1wdHkpIGRpc3BhdGNoQ2FsbGJhY2tzKCk7XG4gIH1cbiAgZnVuY3Rpb24gcmVtb3ZlVHJhbnNpZW50T2JzZXJ2ZXJzRm9yKG9ic2VydmVyKSB7XG4gICAgb2JzZXJ2ZXIubm9kZXNfLmZvckVhY2goZnVuY3Rpb24obm9kZSkge1xuICAgICAgdmFyIHJlZ2lzdHJhdGlvbnMgPSByZWdpc3RyYXRpb25zVGFibGUuZ2V0KG5vZGUpO1xuICAgICAgaWYgKCFyZWdpc3RyYXRpb25zKSByZXR1cm47XG4gICAgICByZWdpc3RyYXRpb25zLmZvckVhY2goZnVuY3Rpb24ocmVnaXN0cmF0aW9uKSB7XG4gICAgICAgIGlmIChyZWdpc3RyYXRpb24ub2JzZXJ2ZXIgPT09IG9ic2VydmVyKSByZWdpc3RyYXRpb24ucmVtb3ZlVHJhbnNpZW50T2JzZXJ2ZXJzKCk7XG4gICAgICB9KTtcbiAgICB9KTtcbiAgfVxuICBmdW5jdGlvbiBmb3JFYWNoQW5jZXN0b3JBbmRPYnNlcnZlckVucXVldWVSZWNvcmQodGFyZ2V0LCBjYWxsYmFjaykge1xuICAgIGZvciAodmFyIG5vZGUgPSB0YXJnZXQ7IG5vZGU7IG5vZGUgPSBub2RlLnBhcmVudE5vZGUpIHtcbiAgICAgIHZhciByZWdpc3RyYXRpb25zID0gcmVnaXN0cmF0aW9uc1RhYmxlLmdldChub2RlKTtcbiAgICAgIGlmIChyZWdpc3RyYXRpb25zKSB7XG4gICAgICAgIGZvciAodmFyIGogPSAwOyBqIDwgcmVnaXN0cmF0aW9ucy5sZW5ndGg7IGorKykge1xuICAgICAgICAgIHZhciByZWdpc3RyYXRpb24gPSByZWdpc3RyYXRpb25zW2pdO1xuICAgICAgICAgIHZhciBvcHRpb25zID0gcmVnaXN0cmF0aW9uLm9wdGlvbnM7XG4gICAgICAgICAgaWYgKG5vZGUgIT09IHRhcmdldCAmJiAhb3B0aW9ucy5zdWJ0cmVlKSBjb250aW51ZTtcbiAgICAgICAgICB2YXIgcmVjb3JkID0gY2FsbGJhY2sob3B0aW9ucyk7XG4gICAgICAgICAgaWYgKHJlY29yZCkgcmVnaXN0cmF0aW9uLmVucXVldWUocmVjb3JkKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfVxuICB2YXIgdWlkQ291bnRlciA9IDA7XG4gIGZ1bmN0aW9uIEpzTXV0YXRpb25PYnNlcnZlcihjYWxsYmFjaykge1xuICAgIHRoaXMuY2FsbGJhY2tfID0gY2FsbGJhY2s7XG4gICAgdGhpcy5ub2Rlc18gPSBbXTtcbiAgICB0aGlzLnJlY29yZHNfID0gW107XG4gICAgdGhpcy51aWRfID0gKyt1aWRDb3VudGVyO1xuICB9XG4gIEpzTXV0YXRpb25PYnNlcnZlci5wcm90b3R5cGUgPSB7XG4gICAgb2JzZXJ2ZTogZnVuY3Rpb24odGFyZ2V0LCBvcHRpb25zKSB7XG4gICAgICB0YXJnZXQgPSB3cmFwSWZOZWVkZWQodGFyZ2V0KTtcbiAgICAgIGlmICghb3B0aW9ucy5jaGlsZExpc3QgJiYgIW9wdGlvbnMuYXR0cmlidXRlcyAmJiAhb3B0aW9ucy5jaGFyYWN0ZXJEYXRhIHx8IG9wdGlvbnMuYXR0cmlidXRlT2xkVmFsdWUgJiYgIW9wdGlvbnMuYXR0cmlidXRlcyB8fCBvcHRpb25zLmF0dHJpYnV0ZUZpbHRlciAmJiBvcHRpb25zLmF0dHJpYnV0ZUZpbHRlci5sZW5ndGggJiYgIW9wdGlvbnMuYXR0cmlidXRlcyB8fCBvcHRpb25zLmNoYXJhY3RlckRhdGFPbGRWYWx1ZSAmJiAhb3B0aW9ucy5jaGFyYWN0ZXJEYXRhKSB7XG4gICAgICAgIHRocm93IG5ldyBTeW50YXhFcnJvcigpO1xuICAgICAgfVxuICAgICAgdmFyIHJlZ2lzdHJhdGlvbnMgPSByZWdpc3RyYXRpb25zVGFibGUuZ2V0KHRhcmdldCk7XG4gICAgICBpZiAoIXJlZ2lzdHJhdGlvbnMpIHJlZ2lzdHJhdGlvbnNUYWJsZS5zZXQodGFyZ2V0LCByZWdpc3RyYXRpb25zID0gW10pO1xuICAgICAgdmFyIHJlZ2lzdHJhdGlvbjtcbiAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgcmVnaXN0cmF0aW9ucy5sZW5ndGg7IGkrKykge1xuICAgICAgICBpZiAocmVnaXN0cmF0aW9uc1tpXS5vYnNlcnZlciA9PT0gdGhpcykge1xuICAgICAgICAgIHJlZ2lzdHJhdGlvbiA9IHJlZ2lzdHJhdGlvbnNbaV07XG4gICAgICAgICAgcmVnaXN0cmF0aW9uLnJlbW92ZUxpc3RlbmVycygpO1xuICAgICAgICAgIHJlZ2lzdHJhdGlvbi5vcHRpb25zID0gb3B0aW9ucztcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgaWYgKCFyZWdpc3RyYXRpb24pIHtcbiAgICAgICAgcmVnaXN0cmF0aW9uID0gbmV3IFJlZ2lzdHJhdGlvbih0aGlzLCB0YXJnZXQsIG9wdGlvbnMpO1xuICAgICAgICByZWdpc3RyYXRpb25zLnB1c2gocmVnaXN0cmF0aW9uKTtcbiAgICAgICAgdGhpcy5ub2Rlc18ucHVzaCh0YXJnZXQpO1xuICAgICAgfVxuICAgICAgcmVnaXN0cmF0aW9uLmFkZExpc3RlbmVycygpO1xuICAgIH0sXG4gICAgZGlzY29ubmVjdDogZnVuY3Rpb24oKSB7XG4gICAgICB0aGlzLm5vZGVzXy5mb3JFYWNoKGZ1bmN0aW9uKG5vZGUpIHtcbiAgICAgICAgdmFyIHJlZ2lzdHJhdGlvbnMgPSByZWdpc3RyYXRpb25zVGFibGUuZ2V0KG5vZGUpO1xuICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IHJlZ2lzdHJhdGlvbnMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICB2YXIgcmVnaXN0cmF0aW9uID0gcmVnaXN0cmF0aW9uc1tpXTtcbiAgICAgICAgICBpZiAocmVnaXN0cmF0aW9uLm9ic2VydmVyID09PSB0aGlzKSB7XG4gICAgICAgICAgICByZWdpc3RyYXRpb24ucmVtb3ZlTGlzdGVuZXJzKCk7XG4gICAgICAgICAgICByZWdpc3RyYXRpb25zLnNwbGljZShpLCAxKTtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfSwgdGhpcyk7XG4gICAgICB0aGlzLnJlY29yZHNfID0gW107XG4gICAgfSxcbiAgICB0YWtlUmVjb3JkczogZnVuY3Rpb24oKSB7XG4gICAgICB2YXIgY29weU9mUmVjb3JkcyA9IHRoaXMucmVjb3Jkc187XG4gICAgICB0aGlzLnJlY29yZHNfID0gW107XG4gICAgICByZXR1cm4gY29weU9mUmVjb3JkcztcbiAgICB9XG4gIH07XG4gIGZ1bmN0aW9uIE11dGF0aW9uUmVjb3JkKHR5cGUsIHRhcmdldCkge1xuICAgIHRoaXMudHlwZSA9IHR5cGU7XG4gICAgdGhpcy50YXJnZXQgPSB0YXJnZXQ7XG4gICAgdGhpcy5hZGRlZE5vZGVzID0gW107XG4gICAgdGhpcy5yZW1vdmVkTm9kZXMgPSBbXTtcbiAgICB0aGlzLnByZXZpb3VzU2libGluZyA9IG51bGw7XG4gICAgdGhpcy5uZXh0U2libGluZyA9IG51bGw7XG4gICAgdGhpcy5hdHRyaWJ1dGVOYW1lID0gbnVsbDtcbiAgICB0aGlzLmF0dHJpYnV0ZU5hbWVzcGFjZSA9IG51bGw7XG4gICAgdGhpcy5vbGRWYWx1ZSA9IG51bGw7XG4gIH1cbiAgZnVuY3Rpb24gY29weU11dGF0aW9uUmVjb3JkKG9yaWdpbmFsKSB7XG4gICAgdmFyIHJlY29yZCA9IG5ldyBNdXRhdGlvblJlY29yZChvcmlnaW5hbC50eXBlLCBvcmlnaW5hbC50YXJnZXQpO1xuICAgIHJlY29yZC5hZGRlZE5vZGVzID0gb3JpZ2luYWwuYWRkZWROb2Rlcy5zbGljZSgpO1xuICAgIHJlY29yZC5yZW1vdmVkTm9kZXMgPSBvcmlnaW5hbC5yZW1vdmVkTm9kZXMuc2xpY2UoKTtcbiAgICByZWNvcmQucHJldmlvdXNTaWJsaW5nID0gb3JpZ2luYWwucHJldmlvdXNTaWJsaW5nO1xuICAgIHJlY29yZC5uZXh0U2libGluZyA9IG9yaWdpbmFsLm5leHRTaWJsaW5nO1xuICAgIHJlY29yZC5hdHRyaWJ1dGVOYW1lID0gb3JpZ2luYWwuYXR0cmlidXRlTmFtZTtcbiAgICByZWNvcmQuYXR0cmlidXRlTmFtZXNwYWNlID0gb3JpZ2luYWwuYXR0cmlidXRlTmFtZXNwYWNlO1xuICAgIHJlY29yZC5vbGRWYWx1ZSA9IG9yaWdpbmFsLm9sZFZhbHVlO1xuICAgIHJldHVybiByZWNvcmQ7XG4gIH1cbiAgdmFyIGN1cnJlbnRSZWNvcmQsIHJlY29yZFdpdGhPbGRWYWx1ZTtcbiAgZnVuY3Rpb24gZ2V0UmVjb3JkKHR5cGUsIHRhcmdldCkge1xuICAgIHJldHVybiBjdXJyZW50UmVjb3JkID0gbmV3IE11dGF0aW9uUmVjb3JkKHR5cGUsIHRhcmdldCk7XG4gIH1cbiAgZnVuY3Rpb24gZ2V0UmVjb3JkV2l0aE9sZFZhbHVlKG9sZFZhbHVlKSB7XG4gICAgaWYgKHJlY29yZFdpdGhPbGRWYWx1ZSkgcmV0dXJuIHJlY29yZFdpdGhPbGRWYWx1ZTtcbiAgICByZWNvcmRXaXRoT2xkVmFsdWUgPSBjb3B5TXV0YXRpb25SZWNvcmQoY3VycmVudFJlY29yZCk7XG4gICAgcmVjb3JkV2l0aE9sZFZhbHVlLm9sZFZhbHVlID0gb2xkVmFsdWU7XG4gICAgcmV0dXJuIHJlY29yZFdpdGhPbGRWYWx1ZTtcbiAgfVxuICBmdW5jdGlvbiBjbGVhclJlY29yZHMoKSB7XG4gICAgY3VycmVudFJlY29yZCA9IHJlY29yZFdpdGhPbGRWYWx1ZSA9IHVuZGVmaW5lZDtcbiAgfVxuICBmdW5jdGlvbiByZWNvcmRSZXByZXNlbnRzQ3VycmVudE11dGF0aW9uKHJlY29yZCkge1xuICAgIHJldHVybiByZWNvcmQgPT09IHJlY29yZFdpdGhPbGRWYWx1ZSB8fCByZWNvcmQgPT09IGN1cnJlbnRSZWNvcmQ7XG4gIH1cbiAgZnVuY3Rpb24gc2VsZWN0UmVjb3JkKGxhc3RSZWNvcmQsIG5ld1JlY29yZCkge1xuICAgIGlmIChsYXN0UmVjb3JkID09PSBuZXdSZWNvcmQpIHJldHVybiBsYXN0UmVjb3JkO1xuICAgIGlmIChyZWNvcmRXaXRoT2xkVmFsdWUgJiYgcmVjb3JkUmVwcmVzZW50c0N1cnJlbnRNdXRhdGlvbihsYXN0UmVjb3JkKSkgcmV0dXJuIHJlY29yZFdpdGhPbGRWYWx1ZTtcbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuICBmdW5jdGlvbiBSZWdpc3RyYXRpb24ob2JzZXJ2ZXIsIHRhcmdldCwgb3B0aW9ucykge1xuICAgIHRoaXMub2JzZXJ2ZXIgPSBvYnNlcnZlcjtcbiAgICB0aGlzLnRhcmdldCA9IHRhcmdldDtcbiAgICB0aGlzLm9wdGlvbnMgPSBvcHRpb25zO1xuICAgIHRoaXMudHJhbnNpZW50T2JzZXJ2ZWROb2RlcyA9IFtdO1xuICB9XG4gIFJlZ2lzdHJhdGlvbi5wcm90b3R5cGUgPSB7XG4gICAgZW5xdWV1ZTogZnVuY3Rpb24ocmVjb3JkKSB7XG4gICAgICB2YXIgcmVjb3JkcyA9IHRoaXMub2JzZXJ2ZXIucmVjb3Jkc187XG4gICAgICB2YXIgbGVuZ3RoID0gcmVjb3Jkcy5sZW5ndGg7XG4gICAgICBpZiAocmVjb3Jkcy5sZW5ndGggPiAwKSB7XG4gICAgICAgIHZhciBsYXN0UmVjb3JkID0gcmVjb3Jkc1tsZW5ndGggLSAxXTtcbiAgICAgICAgdmFyIHJlY29yZFRvUmVwbGFjZUxhc3QgPSBzZWxlY3RSZWNvcmQobGFzdFJlY29yZCwgcmVjb3JkKTtcbiAgICAgICAgaWYgKHJlY29yZFRvUmVwbGFjZUxhc3QpIHtcbiAgICAgICAgICByZWNvcmRzW2xlbmd0aCAtIDFdID0gcmVjb3JkVG9SZXBsYWNlTGFzdDtcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHNjaGVkdWxlQ2FsbGJhY2sodGhpcy5vYnNlcnZlcik7XG4gICAgICB9XG4gICAgICByZWNvcmRzW2xlbmd0aF0gPSByZWNvcmQ7XG4gICAgfSxcbiAgICBhZGRMaXN0ZW5lcnM6IGZ1bmN0aW9uKCkge1xuICAgICAgdGhpcy5hZGRMaXN0ZW5lcnNfKHRoaXMudGFyZ2V0KTtcbiAgICB9LFxuICAgIGFkZExpc3RlbmVyc186IGZ1bmN0aW9uKG5vZGUpIHtcbiAgICAgIHZhciBvcHRpb25zID0gdGhpcy5vcHRpb25zO1xuICAgICAgaWYgKG9wdGlvbnMuYXR0cmlidXRlcykgbm9kZS5hZGRFdmVudExpc3RlbmVyKFwiRE9NQXR0ck1vZGlmaWVkXCIsIHRoaXMsIHRydWUpO1xuICAgICAgaWYgKG9wdGlvbnMuY2hhcmFjdGVyRGF0YSkgbm9kZS5hZGRFdmVudExpc3RlbmVyKFwiRE9NQ2hhcmFjdGVyRGF0YU1vZGlmaWVkXCIsIHRoaXMsIHRydWUpO1xuICAgICAgaWYgKG9wdGlvbnMuY2hpbGRMaXN0KSBub2RlLmFkZEV2ZW50TGlzdGVuZXIoXCJET01Ob2RlSW5zZXJ0ZWRcIiwgdGhpcywgdHJ1ZSk7XG4gICAgICBpZiAob3B0aW9ucy5jaGlsZExpc3QgfHwgb3B0aW9ucy5zdWJ0cmVlKSBub2RlLmFkZEV2ZW50TGlzdGVuZXIoXCJET01Ob2RlUmVtb3ZlZFwiLCB0aGlzLCB0cnVlKTtcbiAgICB9LFxuICAgIHJlbW92ZUxpc3RlbmVyczogZnVuY3Rpb24oKSB7XG4gICAgICB0aGlzLnJlbW92ZUxpc3RlbmVyc18odGhpcy50YXJnZXQpO1xuICAgIH0sXG4gICAgcmVtb3ZlTGlzdGVuZXJzXzogZnVuY3Rpb24obm9kZSkge1xuICAgICAgdmFyIG9wdGlvbnMgPSB0aGlzLm9wdGlvbnM7XG4gICAgICBpZiAob3B0aW9ucy5hdHRyaWJ1dGVzKSBub2RlLnJlbW92ZUV2ZW50TGlzdGVuZXIoXCJET01BdHRyTW9kaWZpZWRcIiwgdGhpcywgdHJ1ZSk7XG4gICAgICBpZiAob3B0aW9ucy5jaGFyYWN0ZXJEYXRhKSBub2RlLnJlbW92ZUV2ZW50TGlzdGVuZXIoXCJET01DaGFyYWN0ZXJEYXRhTW9kaWZpZWRcIiwgdGhpcywgdHJ1ZSk7XG4gICAgICBpZiAob3B0aW9ucy5jaGlsZExpc3QpIG5vZGUucmVtb3ZlRXZlbnRMaXN0ZW5lcihcIkRPTU5vZGVJbnNlcnRlZFwiLCB0aGlzLCB0cnVlKTtcbiAgICAgIGlmIChvcHRpb25zLmNoaWxkTGlzdCB8fCBvcHRpb25zLnN1YnRyZWUpIG5vZGUucmVtb3ZlRXZlbnRMaXN0ZW5lcihcIkRPTU5vZGVSZW1vdmVkXCIsIHRoaXMsIHRydWUpO1xuICAgIH0sXG4gICAgYWRkVHJhbnNpZW50T2JzZXJ2ZXI6IGZ1bmN0aW9uKG5vZGUpIHtcbiAgICAgIGlmIChub2RlID09PSB0aGlzLnRhcmdldCkgcmV0dXJuO1xuICAgICAgdGhpcy5hZGRMaXN0ZW5lcnNfKG5vZGUpO1xuICAgICAgdGhpcy50cmFuc2llbnRPYnNlcnZlZE5vZGVzLnB1c2gobm9kZSk7XG4gICAgICB2YXIgcmVnaXN0cmF0aW9ucyA9IHJlZ2lzdHJhdGlvbnNUYWJsZS5nZXQobm9kZSk7XG4gICAgICBpZiAoIXJlZ2lzdHJhdGlvbnMpIHJlZ2lzdHJhdGlvbnNUYWJsZS5zZXQobm9kZSwgcmVnaXN0cmF0aW9ucyA9IFtdKTtcbiAgICAgIHJlZ2lzdHJhdGlvbnMucHVzaCh0aGlzKTtcbiAgICB9LFxuICAgIHJlbW92ZVRyYW5zaWVudE9ic2VydmVyczogZnVuY3Rpb24oKSB7XG4gICAgICB2YXIgdHJhbnNpZW50T2JzZXJ2ZWROb2RlcyA9IHRoaXMudHJhbnNpZW50T2JzZXJ2ZWROb2RlcztcbiAgICAgIHRoaXMudHJhbnNpZW50T2JzZXJ2ZWROb2RlcyA9IFtdO1xuICAgICAgdHJhbnNpZW50T2JzZXJ2ZWROb2Rlcy5mb3JFYWNoKGZ1bmN0aW9uKG5vZGUpIHtcbiAgICAgICAgdGhpcy5yZW1vdmVMaXN0ZW5lcnNfKG5vZGUpO1xuICAgICAgICB2YXIgcmVnaXN0cmF0aW9ucyA9IHJlZ2lzdHJhdGlvbnNUYWJsZS5nZXQobm9kZSk7XG4gICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgcmVnaXN0cmF0aW9ucy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgIGlmIChyZWdpc3RyYXRpb25zW2ldID09PSB0aGlzKSB7XG4gICAgICAgICAgICByZWdpc3RyYXRpb25zLnNwbGljZShpLCAxKTtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfSwgdGhpcyk7XG4gICAgfSxcbiAgICBoYW5kbGVFdmVudDogZnVuY3Rpb24oZSkge1xuICAgICAgZS5zdG9wSW1tZWRpYXRlUHJvcGFnYXRpb24oKTtcbiAgICAgIHN3aXRjaCAoZS50eXBlKSB7XG4gICAgICAgY2FzZSBcIkRPTUF0dHJNb2RpZmllZFwiOlxuICAgICAgICB2YXIgbmFtZSA9IGUuYXR0ck5hbWU7XG4gICAgICAgIHZhciBuYW1lc3BhY2UgPSBlLnJlbGF0ZWROb2RlLm5hbWVzcGFjZVVSSTtcbiAgICAgICAgdmFyIHRhcmdldCA9IGUudGFyZ2V0O1xuICAgICAgICB2YXIgcmVjb3JkID0gbmV3IGdldFJlY29yZChcImF0dHJpYnV0ZXNcIiwgdGFyZ2V0KTtcbiAgICAgICAgcmVjb3JkLmF0dHJpYnV0ZU5hbWUgPSBuYW1lO1xuICAgICAgICByZWNvcmQuYXR0cmlidXRlTmFtZXNwYWNlID0gbmFtZXNwYWNlO1xuICAgICAgICB2YXIgb2xkVmFsdWUgPSBlLmF0dHJDaGFuZ2UgPT09IE11dGF0aW9uRXZlbnQuQURESVRJT04gPyBudWxsIDogZS5wcmV2VmFsdWU7XG4gICAgICAgIGZvckVhY2hBbmNlc3RvckFuZE9ic2VydmVyRW5xdWV1ZVJlY29yZCh0YXJnZXQsIGZ1bmN0aW9uKG9wdGlvbnMpIHtcbiAgICAgICAgICBpZiAoIW9wdGlvbnMuYXR0cmlidXRlcykgcmV0dXJuO1xuICAgICAgICAgIGlmIChvcHRpb25zLmF0dHJpYnV0ZUZpbHRlciAmJiBvcHRpb25zLmF0dHJpYnV0ZUZpbHRlci5sZW5ndGggJiYgb3B0aW9ucy5hdHRyaWJ1dGVGaWx0ZXIuaW5kZXhPZihuYW1lKSA9PT0gLTEgJiYgb3B0aW9ucy5hdHRyaWJ1dGVGaWx0ZXIuaW5kZXhPZihuYW1lc3BhY2UpID09PSAtMSkge1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgIH1cbiAgICAgICAgICBpZiAob3B0aW9ucy5hdHRyaWJ1dGVPbGRWYWx1ZSkgcmV0dXJuIGdldFJlY29yZFdpdGhPbGRWYWx1ZShvbGRWYWx1ZSk7XG4gICAgICAgICAgcmV0dXJuIHJlY29yZDtcbiAgICAgICAgfSk7XG4gICAgICAgIGJyZWFrO1xuXG4gICAgICAgY2FzZSBcIkRPTUNoYXJhY3RlckRhdGFNb2RpZmllZFwiOlxuICAgICAgICB2YXIgdGFyZ2V0ID0gZS50YXJnZXQ7XG4gICAgICAgIHZhciByZWNvcmQgPSBnZXRSZWNvcmQoXCJjaGFyYWN0ZXJEYXRhXCIsIHRhcmdldCk7XG4gICAgICAgIHZhciBvbGRWYWx1ZSA9IGUucHJldlZhbHVlO1xuICAgICAgICBmb3JFYWNoQW5jZXN0b3JBbmRPYnNlcnZlckVucXVldWVSZWNvcmQodGFyZ2V0LCBmdW5jdGlvbihvcHRpb25zKSB7XG4gICAgICAgICAgaWYgKCFvcHRpb25zLmNoYXJhY3RlckRhdGEpIHJldHVybjtcbiAgICAgICAgICBpZiAob3B0aW9ucy5jaGFyYWN0ZXJEYXRhT2xkVmFsdWUpIHJldHVybiBnZXRSZWNvcmRXaXRoT2xkVmFsdWUob2xkVmFsdWUpO1xuICAgICAgICAgIHJldHVybiByZWNvcmQ7XG4gICAgICAgIH0pO1xuICAgICAgICBicmVhaztcblxuICAgICAgIGNhc2UgXCJET01Ob2RlUmVtb3ZlZFwiOlxuICAgICAgICB0aGlzLmFkZFRyYW5zaWVudE9ic2VydmVyKGUudGFyZ2V0KTtcblxuICAgICAgIGNhc2UgXCJET01Ob2RlSW5zZXJ0ZWRcIjpcbiAgICAgICAgdmFyIHRhcmdldCA9IGUucmVsYXRlZE5vZGU7XG4gICAgICAgIHZhciBjaGFuZ2VkTm9kZSA9IGUudGFyZ2V0O1xuICAgICAgICB2YXIgYWRkZWROb2RlcywgcmVtb3ZlZE5vZGVzO1xuICAgICAgICBpZiAoZS50eXBlID09PSBcIkRPTU5vZGVJbnNlcnRlZFwiKSB7XG4gICAgICAgICAgYWRkZWROb2RlcyA9IFsgY2hhbmdlZE5vZGUgXTtcbiAgICAgICAgICByZW1vdmVkTm9kZXMgPSBbXTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBhZGRlZE5vZGVzID0gW107XG4gICAgICAgICAgcmVtb3ZlZE5vZGVzID0gWyBjaGFuZ2VkTm9kZSBdO1xuICAgICAgICB9XG4gICAgICAgIHZhciBwcmV2aW91c1NpYmxpbmcgPSBjaGFuZ2VkTm9kZS5wcmV2aW91c1NpYmxpbmc7XG4gICAgICAgIHZhciBuZXh0U2libGluZyA9IGNoYW5nZWROb2RlLm5leHRTaWJsaW5nO1xuICAgICAgICB2YXIgcmVjb3JkID0gZ2V0UmVjb3JkKFwiY2hpbGRMaXN0XCIsIHRhcmdldCk7XG4gICAgICAgIHJlY29yZC5hZGRlZE5vZGVzID0gYWRkZWROb2RlcztcbiAgICAgICAgcmVjb3JkLnJlbW92ZWROb2RlcyA9IHJlbW92ZWROb2RlcztcbiAgICAgICAgcmVjb3JkLnByZXZpb3VzU2libGluZyA9IHByZXZpb3VzU2libGluZztcbiAgICAgICAgcmVjb3JkLm5leHRTaWJsaW5nID0gbmV4dFNpYmxpbmc7XG4gICAgICAgIGZvckVhY2hBbmNlc3RvckFuZE9ic2VydmVyRW5xdWV1ZVJlY29yZCh0YXJnZXQsIGZ1bmN0aW9uKG9wdGlvbnMpIHtcbiAgICAgICAgICBpZiAoIW9wdGlvbnMuY2hpbGRMaXN0KSByZXR1cm47XG4gICAgICAgICAgcmV0dXJuIHJlY29yZDtcbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgICBjbGVhclJlY29yZHMoKTtcbiAgICB9XG4gIH07XG4gIGdsb2JhbC5Kc011dGF0aW9uT2JzZXJ2ZXIgPSBKc011dGF0aW9uT2JzZXJ2ZXI7XG4gIGlmICghZ2xvYmFsLk11dGF0aW9uT2JzZXJ2ZXIpIGdsb2JhbC5NdXRhdGlvbk9ic2VydmVyID0gSnNNdXRhdGlvbk9ic2VydmVyO1xufSkodGhpcyk7XG5cbndpbmRvdy5DdXN0b21FbGVtZW50cyA9IHdpbmRvdy5DdXN0b21FbGVtZW50cyB8fCB7XG4gIGZsYWdzOiB7fVxufTtcblxuKGZ1bmN0aW9uKHNjb3BlKSB7XG4gIHZhciBmbGFncyA9IHNjb3BlLmZsYWdzO1xuICB2YXIgbW9kdWxlcyA9IFtdO1xuICB2YXIgYWRkTW9kdWxlID0gZnVuY3Rpb24obW9kdWxlKSB7XG4gICAgbW9kdWxlcy5wdXNoKG1vZHVsZSk7XG4gIH07XG4gIHZhciBpbml0aWFsaXplTW9kdWxlcyA9IGZ1bmN0aW9uKCkge1xuICAgIG1vZHVsZXMuZm9yRWFjaChmdW5jdGlvbihtb2R1bGUpIHtcbiAgICAgIG1vZHVsZShzY29wZSk7XG4gICAgfSk7XG4gIH07XG4gIHNjb3BlLmFkZE1vZHVsZSA9IGFkZE1vZHVsZTtcbiAgc2NvcGUuaW5pdGlhbGl6ZU1vZHVsZXMgPSBpbml0aWFsaXplTW9kdWxlcztcbiAgc2NvcGUuaGFzTmF0aXZlID0gQm9vbGVhbihkb2N1bWVudC5yZWdpc3RlckVsZW1lbnQpO1xuICBzY29wZS51c2VOYXRpdmUgPSAhZmxhZ3MucmVnaXN0ZXIgJiYgc2NvcGUuaGFzTmF0aXZlICYmICF3aW5kb3cuU2hhZG93RE9NUG9seWZpbGwgJiYgKCF3aW5kb3cuSFRNTEltcG9ydHMgfHwgSFRNTEltcG9ydHMudXNlTmF0aXZlKTtcbn0pKEN1c3RvbUVsZW1lbnRzKTtcblxuQ3VzdG9tRWxlbWVudHMuYWRkTW9kdWxlKGZ1bmN0aW9uKHNjb3BlKSB7XG4gIHZhciBJTVBPUlRfTElOS19UWVBFID0gd2luZG93LkhUTUxJbXBvcnRzID8gSFRNTEltcG9ydHMuSU1QT1JUX0xJTktfVFlQRSA6IFwibm9uZVwiO1xuICBmdW5jdGlvbiBmb3JTdWJ0cmVlKG5vZGUsIGNiKSB7XG4gICAgZmluZEFsbEVsZW1lbnRzKG5vZGUsIGZ1bmN0aW9uKGUpIHtcbiAgICAgIGlmIChjYihlKSkge1xuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgIH1cbiAgICAgIGZvclJvb3RzKGUsIGNiKTtcbiAgICB9KTtcbiAgICBmb3JSb290cyhub2RlLCBjYik7XG4gIH1cbiAgZnVuY3Rpb24gZmluZEFsbEVsZW1lbnRzKG5vZGUsIGZpbmQsIGRhdGEpIHtcbiAgICB2YXIgZSA9IG5vZGUuZmlyc3RFbGVtZW50Q2hpbGQ7XG4gICAgaWYgKCFlKSB7XG4gICAgICBlID0gbm9kZS5maXJzdENoaWxkO1xuICAgICAgd2hpbGUgKGUgJiYgZS5ub2RlVHlwZSAhPT0gTm9kZS5FTEVNRU5UX05PREUpIHtcbiAgICAgICAgZSA9IGUubmV4dFNpYmxpbmc7XG4gICAgICB9XG4gICAgfVxuICAgIHdoaWxlIChlKSB7XG4gICAgICBpZiAoZmluZChlLCBkYXRhKSAhPT0gdHJ1ZSkge1xuICAgICAgICBmaW5kQWxsRWxlbWVudHMoZSwgZmluZCwgZGF0YSk7XG4gICAgICB9XG4gICAgICBlID0gZS5uZXh0RWxlbWVudFNpYmxpbmc7XG4gICAgfVxuICAgIHJldHVybiBudWxsO1xuICB9XG4gIGZ1bmN0aW9uIGZvclJvb3RzKG5vZGUsIGNiKSB7XG4gICAgdmFyIHJvb3QgPSBub2RlLnNoYWRvd1Jvb3Q7XG4gICAgd2hpbGUgKHJvb3QpIHtcbiAgICAgIGZvclN1YnRyZWUocm9vdCwgY2IpO1xuICAgICAgcm9vdCA9IHJvb3Qub2xkZXJTaGFkb3dSb290O1xuICAgIH1cbiAgfVxuICB2YXIgcHJvY2Vzc2luZ0RvY3VtZW50cztcbiAgZnVuY3Rpb24gZm9yRG9jdW1lbnRUcmVlKGRvYywgY2IpIHtcbiAgICBwcm9jZXNzaW5nRG9jdW1lbnRzID0gW107XG4gICAgX2ZvckRvY3VtZW50VHJlZShkb2MsIGNiKTtcbiAgICBwcm9jZXNzaW5nRG9jdW1lbnRzID0gbnVsbDtcbiAgfVxuICBmdW5jdGlvbiBfZm9yRG9jdW1lbnRUcmVlKGRvYywgY2IpIHtcbiAgICBkb2MgPSB3cmFwKGRvYyk7XG4gICAgaWYgKHByb2Nlc3NpbmdEb2N1bWVudHMuaW5kZXhPZihkb2MpID49IDApIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgcHJvY2Vzc2luZ0RvY3VtZW50cy5wdXNoKGRvYyk7XG4gICAgdmFyIGltcG9ydHMgPSBkb2MucXVlcnlTZWxlY3RvckFsbChcImxpbmtbcmVsPVwiICsgSU1QT1JUX0xJTktfVFlQRSArIFwiXVwiKTtcbiAgICBmb3IgKHZhciBpID0gMCwgbCA9IGltcG9ydHMubGVuZ3RoLCBuOyBpIDwgbCAmJiAobiA9IGltcG9ydHNbaV0pOyBpKyspIHtcbiAgICAgIGlmIChuLmltcG9ydCkge1xuICAgICAgICBfZm9yRG9jdW1lbnRUcmVlKG4uaW1wb3J0LCBjYik7XG4gICAgICB9XG4gICAgfVxuICAgIGNiKGRvYyk7XG4gIH1cbiAgc2NvcGUuZm9yRG9jdW1lbnRUcmVlID0gZm9yRG9jdW1lbnRUcmVlO1xuICBzY29wZS5mb3JTdWJ0cmVlID0gZm9yU3VidHJlZTtcbn0pO1xuXG5DdXN0b21FbGVtZW50cy5hZGRNb2R1bGUoZnVuY3Rpb24oc2NvcGUpIHtcbiAgdmFyIGZsYWdzID0gc2NvcGUuZmxhZ3M7XG4gIHZhciBmb3JTdWJ0cmVlID0gc2NvcGUuZm9yU3VidHJlZTtcbiAgdmFyIGZvckRvY3VtZW50VHJlZSA9IHNjb3BlLmZvckRvY3VtZW50VHJlZTtcbiAgZnVuY3Rpb24gYWRkZWROb2RlKG5vZGUpIHtcbiAgICByZXR1cm4gYWRkZWQobm9kZSkgfHwgYWRkZWRTdWJ0cmVlKG5vZGUpO1xuICB9XG4gIGZ1bmN0aW9uIGFkZGVkKG5vZGUpIHtcbiAgICBpZiAoc2NvcGUudXBncmFkZShub2RlKSkge1xuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuICAgIGF0dGFjaGVkKG5vZGUpO1xuICB9XG4gIGZ1bmN0aW9uIGFkZGVkU3VidHJlZShub2RlKSB7XG4gICAgZm9yU3VidHJlZShub2RlLCBmdW5jdGlvbihlKSB7XG4gICAgICBpZiAoYWRkZWQoZSkpIHtcbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICB9XG4gICAgfSk7XG4gIH1cbiAgZnVuY3Rpb24gYXR0YWNoZWROb2RlKG5vZGUpIHtcbiAgICBhdHRhY2hlZChub2RlKTtcbiAgICBpZiAoaW5Eb2N1bWVudChub2RlKSkge1xuICAgICAgZm9yU3VidHJlZShub2RlLCBmdW5jdGlvbihlKSB7XG4gICAgICAgIGF0dGFjaGVkKGUpO1xuICAgICAgfSk7XG4gICAgfVxuICB9XG4gIHZhciBoYXNQb2x5ZmlsbE11dGF0aW9ucyA9ICF3aW5kb3cuTXV0YXRpb25PYnNlcnZlciB8fCB3aW5kb3cuTXV0YXRpb25PYnNlcnZlciA9PT0gd2luZG93LkpzTXV0YXRpb25PYnNlcnZlcjtcbiAgc2NvcGUuaGFzUG9seWZpbGxNdXRhdGlvbnMgPSBoYXNQb2x5ZmlsbE11dGF0aW9ucztcbiAgdmFyIGlzUGVuZGluZ011dGF0aW9ucyA9IGZhbHNlO1xuICB2YXIgcGVuZGluZ011dGF0aW9ucyA9IFtdO1xuICBmdW5jdGlvbiBkZWZlck11dGF0aW9uKGZuKSB7XG4gICAgcGVuZGluZ011dGF0aW9ucy5wdXNoKGZuKTtcbiAgICBpZiAoIWlzUGVuZGluZ011dGF0aW9ucykge1xuICAgICAgaXNQZW5kaW5nTXV0YXRpb25zID0gdHJ1ZTtcbiAgICAgIHNldFRpbWVvdXQodGFrZU11dGF0aW9ucyk7XG4gICAgfVxuICB9XG4gIGZ1bmN0aW9uIHRha2VNdXRhdGlvbnMoKSB7XG4gICAgaXNQZW5kaW5nTXV0YXRpb25zID0gZmFsc2U7XG4gICAgdmFyICRwID0gcGVuZGluZ011dGF0aW9ucztcbiAgICBmb3IgKHZhciBpID0gMCwgbCA9ICRwLmxlbmd0aCwgcDsgaSA8IGwgJiYgKHAgPSAkcFtpXSk7IGkrKykge1xuICAgICAgcCgpO1xuICAgIH1cbiAgICBwZW5kaW5nTXV0YXRpb25zID0gW107XG4gIH1cbiAgZnVuY3Rpb24gYXR0YWNoZWQoZWxlbWVudCkge1xuICAgIGlmIChoYXNQb2x5ZmlsbE11dGF0aW9ucykge1xuICAgICAgZGVmZXJNdXRhdGlvbihmdW5jdGlvbigpIHtcbiAgICAgICAgX2F0dGFjaGVkKGVsZW1lbnQpO1xuICAgICAgfSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIF9hdHRhY2hlZChlbGVtZW50KTtcbiAgICB9XG4gIH1cbiAgZnVuY3Rpb24gX2F0dGFjaGVkKGVsZW1lbnQpIHtcbiAgICBpZiAoZWxlbWVudC5fX3VwZ3JhZGVkX18gJiYgKGVsZW1lbnQuYXR0YWNoZWRDYWxsYmFjayB8fCBlbGVtZW50LmRldGFjaGVkQ2FsbGJhY2spKSB7XG4gICAgICBpZiAoIWVsZW1lbnQuX19hdHRhY2hlZCAmJiBpbkRvY3VtZW50KGVsZW1lbnQpKSB7XG4gICAgICAgIGVsZW1lbnQuX19hdHRhY2hlZCA9IHRydWU7XG4gICAgICAgIGlmIChlbGVtZW50LmF0dGFjaGVkQ2FsbGJhY2spIHtcbiAgICAgICAgICBlbGVtZW50LmF0dGFjaGVkQ2FsbGJhY2soKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfVxuICBmdW5jdGlvbiBkZXRhY2hlZE5vZGUobm9kZSkge1xuICAgIGRldGFjaGVkKG5vZGUpO1xuICAgIGZvclN1YnRyZWUobm9kZSwgZnVuY3Rpb24oZSkge1xuICAgICAgZGV0YWNoZWQoZSk7XG4gICAgfSk7XG4gIH1cbiAgZnVuY3Rpb24gZGV0YWNoZWQoZWxlbWVudCkge1xuICAgIGlmIChoYXNQb2x5ZmlsbE11dGF0aW9ucykge1xuICAgICAgZGVmZXJNdXRhdGlvbihmdW5jdGlvbigpIHtcbiAgICAgICAgX2RldGFjaGVkKGVsZW1lbnQpO1xuICAgICAgfSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIF9kZXRhY2hlZChlbGVtZW50KTtcbiAgICB9XG4gIH1cbiAgZnVuY3Rpb24gX2RldGFjaGVkKGVsZW1lbnQpIHtcbiAgICBpZiAoZWxlbWVudC5fX3VwZ3JhZGVkX18gJiYgKGVsZW1lbnQuYXR0YWNoZWRDYWxsYmFjayB8fCBlbGVtZW50LmRldGFjaGVkQ2FsbGJhY2spKSB7XG4gICAgICBpZiAoZWxlbWVudC5fX2F0dGFjaGVkICYmICFpbkRvY3VtZW50KGVsZW1lbnQpKSB7XG4gICAgICAgIGVsZW1lbnQuX19hdHRhY2hlZCA9IGZhbHNlO1xuICAgICAgICBpZiAoZWxlbWVudC5kZXRhY2hlZENhbGxiYWNrKSB7XG4gICAgICAgICAgZWxlbWVudC5kZXRhY2hlZENhbGxiYWNrKCk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH1cbiAgZnVuY3Rpb24gaW5Eb2N1bWVudChlbGVtZW50KSB7XG4gICAgdmFyIHAgPSBlbGVtZW50O1xuICAgIHZhciBkb2MgPSB3cmFwKGRvY3VtZW50KTtcbiAgICB3aGlsZSAocCkge1xuICAgICAgaWYgKHAgPT0gZG9jKSB7XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgfVxuICAgICAgcCA9IHAucGFyZW50Tm9kZSB8fCBwLmhvc3Q7XG4gICAgfVxuICB9XG4gIGZ1bmN0aW9uIHdhdGNoU2hhZG93KG5vZGUpIHtcbiAgICBpZiAobm9kZS5zaGFkb3dSb290ICYmICFub2RlLnNoYWRvd1Jvb3QuX193YXRjaGVkKSB7XG4gICAgICBmbGFncy5kb20gJiYgY29uc29sZS5sb2coXCJ3YXRjaGluZyBzaGFkb3ctcm9vdCBmb3I6IFwiLCBub2RlLmxvY2FsTmFtZSk7XG4gICAgICB2YXIgcm9vdCA9IG5vZGUuc2hhZG93Um9vdDtcbiAgICAgIHdoaWxlIChyb290KSB7XG4gICAgICAgIG9ic2VydmUocm9vdCk7XG4gICAgICAgIHJvb3QgPSByb290Lm9sZGVyU2hhZG93Um9vdDtcbiAgICAgIH1cbiAgICB9XG4gIH1cbiAgZnVuY3Rpb24gaGFuZGxlcihtdXRhdGlvbnMpIHtcbiAgICBpZiAoZmxhZ3MuZG9tKSB7XG4gICAgICB2YXIgbXggPSBtdXRhdGlvbnNbMF07XG4gICAgICBpZiAobXggJiYgbXgudHlwZSA9PT0gXCJjaGlsZExpc3RcIiAmJiBteC5hZGRlZE5vZGVzKSB7XG4gICAgICAgIGlmIChteC5hZGRlZE5vZGVzKSB7XG4gICAgICAgICAgdmFyIGQgPSBteC5hZGRlZE5vZGVzWzBdO1xuICAgICAgICAgIHdoaWxlIChkICYmIGQgIT09IGRvY3VtZW50ICYmICFkLmhvc3QpIHtcbiAgICAgICAgICAgIGQgPSBkLnBhcmVudE5vZGU7XG4gICAgICAgICAgfVxuICAgICAgICAgIHZhciB1ID0gZCAmJiAoZC5VUkwgfHwgZC5fVVJMIHx8IGQuaG9zdCAmJiBkLmhvc3QubG9jYWxOYW1lKSB8fCBcIlwiO1xuICAgICAgICAgIHUgPSB1LnNwbGl0KFwiLz9cIikuc2hpZnQoKS5zcGxpdChcIi9cIikucG9wKCk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIGNvbnNvbGUuZ3JvdXAoXCJtdXRhdGlvbnMgKCVkKSBbJXNdXCIsIG11dGF0aW9ucy5sZW5ndGgsIHUgfHwgXCJcIik7XG4gICAgfVxuICAgIG11dGF0aW9ucy5mb3JFYWNoKGZ1bmN0aW9uKG14KSB7XG4gICAgICBpZiAobXgudHlwZSA9PT0gXCJjaGlsZExpc3RcIikge1xuICAgICAgICBmb3JFYWNoKG14LmFkZGVkTm9kZXMsIGZ1bmN0aW9uKG4pIHtcbiAgICAgICAgICBpZiAoIW4ubG9jYWxOYW1lKSB7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgfVxuICAgICAgICAgIGFkZGVkTm9kZShuKTtcbiAgICAgICAgfSk7XG4gICAgICAgIGZvckVhY2gobXgucmVtb3ZlZE5vZGVzLCBmdW5jdGlvbihuKSB7XG4gICAgICAgICAgaWYgKCFuLmxvY2FsTmFtZSkge1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgIH1cbiAgICAgICAgICBkZXRhY2hlZE5vZGUobik7XG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgIH0pO1xuICAgIGZsYWdzLmRvbSAmJiBjb25zb2xlLmdyb3VwRW5kKCk7XG4gIH1cbiAgZnVuY3Rpb24gdGFrZVJlY29yZHMobm9kZSkge1xuICAgIG5vZGUgPSB3cmFwKG5vZGUpO1xuICAgIGlmICghbm9kZSkge1xuICAgICAgbm9kZSA9IHdyYXAoZG9jdW1lbnQpO1xuICAgIH1cbiAgICB3aGlsZSAobm9kZS5wYXJlbnROb2RlKSB7XG4gICAgICBub2RlID0gbm9kZS5wYXJlbnROb2RlO1xuICAgIH1cbiAgICB2YXIgb2JzZXJ2ZXIgPSBub2RlLl9fb2JzZXJ2ZXI7XG4gICAgaWYgKG9ic2VydmVyKSB7XG4gICAgICBoYW5kbGVyKG9ic2VydmVyLnRha2VSZWNvcmRzKCkpO1xuICAgICAgdGFrZU11dGF0aW9ucygpO1xuICAgIH1cbiAgfVxuICB2YXIgZm9yRWFjaCA9IEFycmF5LnByb3RvdHlwZS5mb3JFYWNoLmNhbGwuYmluZChBcnJheS5wcm90b3R5cGUuZm9yRWFjaCk7XG4gIGZ1bmN0aW9uIG9ic2VydmUoaW5Sb290KSB7XG4gICAgaWYgKGluUm9vdC5fX29ic2VydmVyKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIHZhciBvYnNlcnZlciA9IG5ldyBNdXRhdGlvbk9ic2VydmVyKGhhbmRsZXIpO1xuICAgIG9ic2VydmVyLm9ic2VydmUoaW5Sb290LCB7XG4gICAgICBjaGlsZExpc3Q6IHRydWUsXG4gICAgICBzdWJ0cmVlOiB0cnVlXG4gICAgfSk7XG4gICAgaW5Sb290Ll9fb2JzZXJ2ZXIgPSBvYnNlcnZlcjtcbiAgfVxuICBmdW5jdGlvbiB1cGdyYWRlRG9jdW1lbnQoZG9jKSB7XG4gICAgZG9jID0gd3JhcChkb2MpO1xuICAgIGZsYWdzLmRvbSAmJiBjb25zb2xlLmdyb3VwKFwidXBncmFkZURvY3VtZW50OiBcIiwgZG9jLmJhc2VVUkkuc3BsaXQoXCIvXCIpLnBvcCgpKTtcbiAgICBhZGRlZE5vZGUoZG9jKTtcbiAgICBvYnNlcnZlKGRvYyk7XG4gICAgZmxhZ3MuZG9tICYmIGNvbnNvbGUuZ3JvdXBFbmQoKTtcbiAgfVxuICBmdW5jdGlvbiB1cGdyYWRlRG9jdW1lbnRUcmVlKGRvYykge1xuICAgIGZvckRvY3VtZW50VHJlZShkb2MsIHVwZ3JhZGVEb2N1bWVudCk7XG4gIH1cbiAgdmFyIG9yaWdpbmFsQ3JlYXRlU2hhZG93Um9vdCA9IEVsZW1lbnQucHJvdG90eXBlLmNyZWF0ZVNoYWRvd1Jvb3Q7XG4gIEVsZW1lbnQucHJvdG90eXBlLmNyZWF0ZVNoYWRvd1Jvb3QgPSBmdW5jdGlvbigpIHtcbiAgICB2YXIgcm9vdCA9IG9yaWdpbmFsQ3JlYXRlU2hhZG93Um9vdC5jYWxsKHRoaXMpO1xuICAgIEN1c3RvbUVsZW1lbnRzLndhdGNoU2hhZG93KHRoaXMpO1xuICAgIHJldHVybiByb290O1xuICB9O1xuICBzY29wZS53YXRjaFNoYWRvdyA9IHdhdGNoU2hhZG93O1xuICBzY29wZS51cGdyYWRlRG9jdW1lbnRUcmVlID0gdXBncmFkZURvY3VtZW50VHJlZTtcbiAgc2NvcGUudXBncmFkZVN1YnRyZWUgPSBhZGRlZFN1YnRyZWU7XG4gIHNjb3BlLnVwZ3JhZGVBbGwgPSBhZGRlZE5vZGU7XG4gIHNjb3BlLmF0dGFjaGVkTm9kZSA9IGF0dGFjaGVkTm9kZTtcbiAgc2NvcGUudGFrZVJlY29yZHMgPSB0YWtlUmVjb3Jkcztcbn0pO1xuXG5DdXN0b21FbGVtZW50cy5hZGRNb2R1bGUoZnVuY3Rpb24oc2NvcGUpIHtcbiAgdmFyIGZsYWdzID0gc2NvcGUuZmxhZ3M7XG4gIGZ1bmN0aW9uIHVwZ3JhZGUobm9kZSkge1xuICAgIGlmICghbm9kZS5fX3VwZ3JhZGVkX18gJiYgbm9kZS5ub2RlVHlwZSA9PT0gTm9kZS5FTEVNRU5UX05PREUpIHtcbiAgICAgIHZhciBpcyA9IG5vZGUuZ2V0QXR0cmlidXRlKFwiaXNcIik7XG4gICAgICB2YXIgZGVmaW5pdGlvbiA9IHNjb3BlLmdldFJlZ2lzdGVyZWREZWZpbml0aW9uKGlzIHx8IG5vZGUubG9jYWxOYW1lKTtcbiAgICAgIGlmIChkZWZpbml0aW9uKSB7XG4gICAgICAgIGlmIChpcyAmJiBkZWZpbml0aW9uLnRhZyA9PSBub2RlLmxvY2FsTmFtZSkge1xuICAgICAgICAgIHJldHVybiB1cGdyYWRlV2l0aERlZmluaXRpb24obm9kZSwgZGVmaW5pdGlvbik7XG4gICAgICAgIH0gZWxzZSBpZiAoIWlzICYmICFkZWZpbml0aW9uLmV4dGVuZHMpIHtcbiAgICAgICAgICByZXR1cm4gdXBncmFkZVdpdGhEZWZpbml0aW9uKG5vZGUsIGRlZmluaXRpb24pO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9XG4gIGZ1bmN0aW9uIHVwZ3JhZGVXaXRoRGVmaW5pdGlvbihlbGVtZW50LCBkZWZpbml0aW9uKSB7XG4gICAgZmxhZ3MudXBncmFkZSAmJiBjb25zb2xlLmdyb3VwKFwidXBncmFkZTpcIiwgZWxlbWVudC5sb2NhbE5hbWUpO1xuICAgIGlmIChkZWZpbml0aW9uLmlzKSB7XG4gICAgICBlbGVtZW50LnNldEF0dHJpYnV0ZShcImlzXCIsIGRlZmluaXRpb24uaXMpO1xuICAgIH1cbiAgICBpbXBsZW1lbnRQcm90b3R5cGUoZWxlbWVudCwgZGVmaW5pdGlvbik7XG4gICAgZWxlbWVudC5fX3VwZ3JhZGVkX18gPSB0cnVlO1xuICAgIGNyZWF0ZWQoZWxlbWVudCk7XG4gICAgc2NvcGUuYXR0YWNoZWROb2RlKGVsZW1lbnQpO1xuICAgIHNjb3BlLnVwZ3JhZGVTdWJ0cmVlKGVsZW1lbnQpO1xuICAgIGZsYWdzLnVwZ3JhZGUgJiYgY29uc29sZS5ncm91cEVuZCgpO1xuICAgIHJldHVybiBlbGVtZW50O1xuICB9XG4gIGZ1bmN0aW9uIGltcGxlbWVudFByb3RvdHlwZShlbGVtZW50LCBkZWZpbml0aW9uKSB7XG4gICAgaWYgKE9iamVjdC5fX3Byb3RvX18pIHtcbiAgICAgIGVsZW1lbnQuX19wcm90b19fID0gZGVmaW5pdGlvbi5wcm90b3R5cGU7XG4gICAgfSBlbHNlIHtcbiAgICAgIGN1c3RvbU1peGluKGVsZW1lbnQsIGRlZmluaXRpb24ucHJvdG90eXBlLCBkZWZpbml0aW9uLm5hdGl2ZSk7XG4gICAgICBlbGVtZW50Ll9fcHJvdG9fXyA9IGRlZmluaXRpb24ucHJvdG90eXBlO1xuICAgIH1cbiAgfVxuICBmdW5jdGlvbiBjdXN0b21NaXhpbihpblRhcmdldCwgaW5TcmMsIGluTmF0aXZlKSB7XG4gICAgdmFyIHVzZWQgPSB7fTtcbiAgICB2YXIgcCA9IGluU3JjO1xuICAgIHdoaWxlIChwICE9PSBpbk5hdGl2ZSAmJiBwICE9PSBIVE1MRWxlbWVudC5wcm90b3R5cGUpIHtcbiAgICAgIHZhciBrZXlzID0gT2JqZWN0LmdldE93blByb3BlcnR5TmFtZXMocCk7XG4gICAgICBmb3IgKHZhciBpID0gMCwgazsgayA9IGtleXNbaV07IGkrKykge1xuICAgICAgICBpZiAoIXVzZWRba10pIHtcbiAgICAgICAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkoaW5UYXJnZXQsIGssIE9iamVjdC5nZXRPd25Qcm9wZXJ0eURlc2NyaXB0b3IocCwgaykpO1xuICAgICAgICAgIHVzZWRba10gPSAxO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICBwID0gT2JqZWN0LmdldFByb3RvdHlwZU9mKHApO1xuICAgIH1cbiAgfVxuICBmdW5jdGlvbiBjcmVhdGVkKGVsZW1lbnQpIHtcbiAgICBpZiAoZWxlbWVudC5jcmVhdGVkQ2FsbGJhY2spIHtcbiAgICAgIGVsZW1lbnQuY3JlYXRlZENhbGxiYWNrKCk7XG4gICAgfVxuICB9XG4gIHNjb3BlLnVwZ3JhZGUgPSB1cGdyYWRlO1xuICBzY29wZS51cGdyYWRlV2l0aERlZmluaXRpb24gPSB1cGdyYWRlV2l0aERlZmluaXRpb247XG4gIHNjb3BlLmltcGxlbWVudFByb3RvdHlwZSA9IGltcGxlbWVudFByb3RvdHlwZTtcbn0pO1xuXG5DdXN0b21FbGVtZW50cy5hZGRNb2R1bGUoZnVuY3Rpb24oc2NvcGUpIHtcbiAgdmFyIHVwZ3JhZGVEb2N1bWVudFRyZWUgPSBzY29wZS51cGdyYWRlRG9jdW1lbnRUcmVlO1xuICB2YXIgdXBncmFkZSA9IHNjb3BlLnVwZ3JhZGU7XG4gIHZhciB1cGdyYWRlV2l0aERlZmluaXRpb24gPSBzY29wZS51cGdyYWRlV2l0aERlZmluaXRpb247XG4gIHZhciBpbXBsZW1lbnRQcm90b3R5cGUgPSBzY29wZS5pbXBsZW1lbnRQcm90b3R5cGU7XG4gIHZhciB1c2VOYXRpdmUgPSBzY29wZS51c2VOYXRpdmU7XG4gIGZ1bmN0aW9uIHJlZ2lzdGVyKG5hbWUsIG9wdGlvbnMpIHtcbiAgICB2YXIgZGVmaW5pdGlvbiA9IG9wdGlvbnMgfHwge307XG4gICAgaWYgKCFuYW1lKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoXCJkb2N1bWVudC5yZWdpc3RlckVsZW1lbnQ6IGZpcnN0IGFyZ3VtZW50IGBuYW1lYCBtdXN0IG5vdCBiZSBlbXB0eVwiKTtcbiAgICB9XG4gICAgaWYgKG5hbWUuaW5kZXhPZihcIi1cIikgPCAwKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoXCJkb2N1bWVudC5yZWdpc3RlckVsZW1lbnQ6IGZpcnN0IGFyZ3VtZW50ICgnbmFtZScpIG11c3QgY29udGFpbiBhIGRhc2ggKCctJykuIEFyZ3VtZW50IHByb3ZpZGVkIHdhcyAnXCIgKyBTdHJpbmcobmFtZSkgKyBcIicuXCIpO1xuICAgIH1cbiAgICBpZiAoaXNSZXNlcnZlZFRhZyhuYW1lKSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKFwiRmFpbGVkIHRvIGV4ZWN1dGUgJ3JlZ2lzdGVyRWxlbWVudCcgb24gJ0RvY3VtZW50JzogUmVnaXN0cmF0aW9uIGZhaWxlZCBmb3IgdHlwZSAnXCIgKyBTdHJpbmcobmFtZSkgKyBcIicuIFRoZSB0eXBlIG5hbWUgaXMgaW52YWxpZC5cIik7XG4gICAgfVxuICAgIGlmIChnZXRSZWdpc3RlcmVkRGVmaW5pdGlvbihuYW1lKSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKFwiRHVwbGljYXRlRGVmaW5pdGlvbkVycm9yOiBhIHR5cGUgd2l0aCBuYW1lICdcIiArIFN0cmluZyhuYW1lKSArIFwiJyBpcyBhbHJlYWR5IHJlZ2lzdGVyZWRcIik7XG4gICAgfVxuICAgIGlmICghZGVmaW5pdGlvbi5wcm90b3R5cGUpIHtcbiAgICAgIGRlZmluaXRpb24ucHJvdG90eXBlID0gT2JqZWN0LmNyZWF0ZShIVE1MRWxlbWVudC5wcm90b3R5cGUpO1xuICAgIH1cbiAgICBkZWZpbml0aW9uLl9fbmFtZSA9IG5hbWUudG9Mb3dlckNhc2UoKTtcbiAgICBkZWZpbml0aW9uLmxpZmVjeWNsZSA9IGRlZmluaXRpb24ubGlmZWN5Y2xlIHx8IHt9O1xuICAgIGRlZmluaXRpb24uYW5jZXN0cnkgPSBhbmNlc3RyeShkZWZpbml0aW9uLmV4dGVuZHMpO1xuICAgIHJlc29sdmVUYWdOYW1lKGRlZmluaXRpb24pO1xuICAgIHJlc29sdmVQcm90b3R5cGVDaGFpbihkZWZpbml0aW9uKTtcbiAgICBvdmVycmlkZUF0dHJpYnV0ZUFwaShkZWZpbml0aW9uLnByb3RvdHlwZSk7XG4gICAgcmVnaXN0ZXJEZWZpbml0aW9uKGRlZmluaXRpb24uX19uYW1lLCBkZWZpbml0aW9uKTtcbiAgICBkZWZpbml0aW9uLmN0b3IgPSBnZW5lcmF0ZUNvbnN0cnVjdG9yKGRlZmluaXRpb24pO1xuICAgIGRlZmluaXRpb24uY3Rvci5wcm90b3R5cGUgPSBkZWZpbml0aW9uLnByb3RvdHlwZTtcbiAgICBkZWZpbml0aW9uLnByb3RvdHlwZS5jb25zdHJ1Y3RvciA9IGRlZmluaXRpb24uY3RvcjtcbiAgICBpZiAoc2NvcGUucmVhZHkpIHtcbiAgICAgIHVwZ3JhZGVEb2N1bWVudFRyZWUoZG9jdW1lbnQpO1xuICAgIH1cbiAgICByZXR1cm4gZGVmaW5pdGlvbi5jdG9yO1xuICB9XG4gIGZ1bmN0aW9uIG92ZXJyaWRlQXR0cmlidXRlQXBpKHByb3RvdHlwZSkge1xuICAgIGlmIChwcm90b3R5cGUuc2V0QXR0cmlidXRlLl9wb2x5ZmlsbGVkKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIHZhciBzZXRBdHRyaWJ1dGUgPSBwcm90b3R5cGUuc2V0QXR0cmlidXRlO1xuICAgIHByb3RvdHlwZS5zZXRBdHRyaWJ1dGUgPSBmdW5jdGlvbihuYW1lLCB2YWx1ZSkge1xuICAgICAgY2hhbmdlQXR0cmlidXRlLmNhbGwodGhpcywgbmFtZSwgdmFsdWUsIHNldEF0dHJpYnV0ZSk7XG4gICAgfTtcbiAgICB2YXIgcmVtb3ZlQXR0cmlidXRlID0gcHJvdG90eXBlLnJlbW92ZUF0dHJpYnV0ZTtcbiAgICBwcm90b3R5cGUucmVtb3ZlQXR0cmlidXRlID0gZnVuY3Rpb24obmFtZSkge1xuICAgICAgY2hhbmdlQXR0cmlidXRlLmNhbGwodGhpcywgbmFtZSwgbnVsbCwgcmVtb3ZlQXR0cmlidXRlKTtcbiAgICB9O1xuICAgIHByb3RvdHlwZS5zZXRBdHRyaWJ1dGUuX3BvbHlmaWxsZWQgPSB0cnVlO1xuICB9XG4gIGZ1bmN0aW9uIGNoYW5nZUF0dHJpYnV0ZShuYW1lLCB2YWx1ZSwgb3BlcmF0aW9uKSB7XG4gICAgbmFtZSA9IG5hbWUudG9Mb3dlckNhc2UoKTtcbiAgICB2YXIgb2xkVmFsdWUgPSB0aGlzLmdldEF0dHJpYnV0ZShuYW1lKTtcbiAgICBvcGVyYXRpb24uYXBwbHkodGhpcywgYXJndW1lbnRzKTtcbiAgICB2YXIgbmV3VmFsdWUgPSB0aGlzLmdldEF0dHJpYnV0ZShuYW1lKTtcbiAgICBpZiAodGhpcy5hdHRyaWJ1dGVDaGFuZ2VkQ2FsbGJhY2sgJiYgbmV3VmFsdWUgIT09IG9sZFZhbHVlKSB7XG4gICAgICB0aGlzLmF0dHJpYnV0ZUNoYW5nZWRDYWxsYmFjayhuYW1lLCBvbGRWYWx1ZSwgbmV3VmFsdWUpO1xuICAgIH1cbiAgfVxuICBmdW5jdGlvbiBpc1Jlc2VydmVkVGFnKG5hbWUpIHtcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IHJlc2VydmVkVGFnTGlzdC5sZW5ndGg7IGkrKykge1xuICAgICAgaWYgKG5hbWUgPT09IHJlc2VydmVkVGFnTGlzdFtpXSkge1xuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgIH1cbiAgICB9XG4gIH1cbiAgdmFyIHJlc2VydmVkVGFnTGlzdCA9IFsgXCJhbm5vdGF0aW9uLXhtbFwiLCBcImNvbG9yLXByb2ZpbGVcIiwgXCJmb250LWZhY2VcIiwgXCJmb250LWZhY2Utc3JjXCIsIFwiZm9udC1mYWNlLXVyaVwiLCBcImZvbnQtZmFjZS1mb3JtYXRcIiwgXCJmb250LWZhY2UtbmFtZVwiLCBcIm1pc3NpbmctZ2x5cGhcIiBdO1xuICBmdW5jdGlvbiBhbmNlc3RyeShleHRuZHMpIHtcbiAgICB2YXIgZXh0ZW5kZWUgPSBnZXRSZWdpc3RlcmVkRGVmaW5pdGlvbihleHRuZHMpO1xuICAgIGlmIChleHRlbmRlZSkge1xuICAgICAgcmV0dXJuIGFuY2VzdHJ5KGV4dGVuZGVlLmV4dGVuZHMpLmNvbmNhdChbIGV4dGVuZGVlIF0pO1xuICAgIH1cbiAgICByZXR1cm4gW107XG4gIH1cbiAgZnVuY3Rpb24gcmVzb2x2ZVRhZ05hbWUoZGVmaW5pdGlvbikge1xuICAgIHZhciBiYXNlVGFnID0gZGVmaW5pdGlvbi5leHRlbmRzO1xuICAgIGZvciAodmFyIGkgPSAwLCBhOyBhID0gZGVmaW5pdGlvbi5hbmNlc3RyeVtpXTsgaSsrKSB7XG4gICAgICBiYXNlVGFnID0gYS5pcyAmJiBhLnRhZztcbiAgICB9XG4gICAgZGVmaW5pdGlvbi50YWcgPSBiYXNlVGFnIHx8IGRlZmluaXRpb24uX19uYW1lO1xuICAgIGlmIChiYXNlVGFnKSB7XG4gICAgICBkZWZpbml0aW9uLmlzID0gZGVmaW5pdGlvbi5fX25hbWU7XG4gICAgfVxuICB9XG4gIGZ1bmN0aW9uIHJlc29sdmVQcm90b3R5cGVDaGFpbihkZWZpbml0aW9uKSB7XG4gICAgaWYgKCFPYmplY3QuX19wcm90b19fKSB7XG4gICAgICB2YXIgbmF0aXZlUHJvdG90eXBlID0gSFRNTEVsZW1lbnQucHJvdG90eXBlO1xuICAgICAgaWYgKGRlZmluaXRpb24uaXMpIHtcbiAgICAgICAgdmFyIGluc3QgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KGRlZmluaXRpb24udGFnKTtcbiAgICAgICAgdmFyIGV4cGVjdGVkUHJvdG90eXBlID0gT2JqZWN0LmdldFByb3RvdHlwZU9mKGluc3QpO1xuICAgICAgICBpZiAoZXhwZWN0ZWRQcm90b3R5cGUgPT09IGRlZmluaXRpb24ucHJvdG90eXBlKSB7XG4gICAgICAgICAgbmF0aXZlUHJvdG90eXBlID0gZXhwZWN0ZWRQcm90b3R5cGU7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIHZhciBwcm90byA9IGRlZmluaXRpb24ucHJvdG90eXBlLCBhbmNlc3RvcjtcbiAgICAgIHdoaWxlIChwcm90byAmJiBwcm90byAhPT0gbmF0aXZlUHJvdG90eXBlKSB7XG4gICAgICAgIGFuY2VzdG9yID0gT2JqZWN0LmdldFByb3RvdHlwZU9mKHByb3RvKTtcbiAgICAgICAgcHJvdG8uX19wcm90b19fID0gYW5jZXN0b3I7XG4gICAgICAgIHByb3RvID0gYW5jZXN0b3I7XG4gICAgICB9XG4gICAgICBkZWZpbml0aW9uLm5hdGl2ZSA9IG5hdGl2ZVByb3RvdHlwZTtcbiAgICB9XG4gIH1cbiAgZnVuY3Rpb24gaW5zdGFudGlhdGUoZGVmaW5pdGlvbikge1xuICAgIHJldHVybiB1cGdyYWRlV2l0aERlZmluaXRpb24oZG9tQ3JlYXRlRWxlbWVudChkZWZpbml0aW9uLnRhZyksIGRlZmluaXRpb24pO1xuICB9XG4gIHZhciByZWdpc3RyeSA9IHt9O1xuICBmdW5jdGlvbiBnZXRSZWdpc3RlcmVkRGVmaW5pdGlvbihuYW1lKSB7XG4gICAgaWYgKG5hbWUpIHtcbiAgICAgIHJldHVybiByZWdpc3RyeVtuYW1lLnRvTG93ZXJDYXNlKCldO1xuICAgIH1cbiAgfVxuICBmdW5jdGlvbiByZWdpc3RlckRlZmluaXRpb24obmFtZSwgZGVmaW5pdGlvbikge1xuICAgIHJlZ2lzdHJ5W25hbWVdID0gZGVmaW5pdGlvbjtcbiAgfVxuICBmdW5jdGlvbiBnZW5lcmF0ZUNvbnN0cnVjdG9yKGRlZmluaXRpb24pIHtcbiAgICByZXR1cm4gZnVuY3Rpb24oKSB7XG4gICAgICByZXR1cm4gaW5zdGFudGlhdGUoZGVmaW5pdGlvbik7XG4gICAgfTtcbiAgfVxuICB2YXIgSFRNTF9OQU1FU1BBQ0UgPSBcImh0dHA6Ly93d3cudzMub3JnLzE5OTkveGh0bWxcIjtcbiAgZnVuY3Rpb24gY3JlYXRlRWxlbWVudE5TKG5hbWVzcGFjZSwgdGFnLCB0eXBlRXh0ZW5zaW9uKSB7XG4gICAgaWYgKG5hbWVzcGFjZSA9PT0gSFRNTF9OQU1FU1BBQ0UpIHtcbiAgICAgIHJldHVybiBjcmVhdGVFbGVtZW50KHRhZywgdHlwZUV4dGVuc2lvbik7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiBkb21DcmVhdGVFbGVtZW50TlMobmFtZXNwYWNlLCB0YWcpO1xuICAgIH1cbiAgfVxuICBmdW5jdGlvbiBjcmVhdGVFbGVtZW50KHRhZywgdHlwZUV4dGVuc2lvbikge1xuICAgIHZhciBkZWZpbml0aW9uID0gZ2V0UmVnaXN0ZXJlZERlZmluaXRpb24odHlwZUV4dGVuc2lvbiB8fCB0YWcpO1xuICAgIGlmIChkZWZpbml0aW9uKSB7XG4gICAgICBpZiAodGFnID09IGRlZmluaXRpb24udGFnICYmIHR5cGVFeHRlbnNpb24gPT0gZGVmaW5pdGlvbi5pcykge1xuICAgICAgICByZXR1cm4gbmV3IGRlZmluaXRpb24uY3RvcigpO1xuICAgICAgfVxuICAgICAgaWYgKCF0eXBlRXh0ZW5zaW9uICYmICFkZWZpbml0aW9uLmlzKSB7XG4gICAgICAgIHJldHVybiBuZXcgZGVmaW5pdGlvbi5jdG9yKCk7XG4gICAgICB9XG4gICAgfVxuICAgIHZhciBlbGVtZW50O1xuICAgIGlmICh0eXBlRXh0ZW5zaW9uKSB7XG4gICAgICBlbGVtZW50ID0gY3JlYXRlRWxlbWVudCh0YWcpO1xuICAgICAgZWxlbWVudC5zZXRBdHRyaWJ1dGUoXCJpc1wiLCB0eXBlRXh0ZW5zaW9uKTtcbiAgICAgIHJldHVybiBlbGVtZW50O1xuICAgIH1cbiAgICBlbGVtZW50ID0gZG9tQ3JlYXRlRWxlbWVudCh0YWcpO1xuICAgIGlmICh0YWcuaW5kZXhPZihcIi1cIikgPj0gMCkge1xuICAgICAgaW1wbGVtZW50UHJvdG90eXBlKGVsZW1lbnQsIEhUTUxFbGVtZW50KTtcbiAgICB9XG4gICAgcmV0dXJuIGVsZW1lbnQ7XG4gIH1cbiAgZnVuY3Rpb24gY2xvbmVOb2RlKGRlZXApIHtcbiAgICB2YXIgbiA9IGRvbUNsb25lTm9kZS5jYWxsKHRoaXMsIGRlZXApO1xuICAgIHVwZ3JhZGUobik7XG4gICAgcmV0dXJuIG47XG4gIH1cbiAgdmFyIGRvbUNyZWF0ZUVsZW1lbnQgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50LmJpbmQoZG9jdW1lbnQpO1xuICB2YXIgZG9tQ3JlYXRlRWxlbWVudE5TID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudE5TLmJpbmQoZG9jdW1lbnQpO1xuICB2YXIgZG9tQ2xvbmVOb2RlID0gTm9kZS5wcm90b3R5cGUuY2xvbmVOb2RlO1xuICB2YXIgaXNJbnN0YW5jZTtcbiAgaWYgKCFPYmplY3QuX19wcm90b19fICYmICF1c2VOYXRpdmUpIHtcbiAgICBpc0luc3RhbmNlID0gZnVuY3Rpb24ob2JqLCBjdG9yKSB7XG4gICAgICB2YXIgcCA9IG9iajtcbiAgICAgIHdoaWxlIChwKSB7XG4gICAgICAgIGlmIChwID09PSBjdG9yLnByb3RvdHlwZSkge1xuICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICB9XG4gICAgICAgIHAgPSBwLl9fcHJvdG9fXztcbiAgICAgIH1cbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9O1xuICB9IGVsc2Uge1xuICAgIGlzSW5zdGFuY2UgPSBmdW5jdGlvbihvYmosIGJhc2UpIHtcbiAgICAgIHJldHVybiBvYmogaW5zdGFuY2VvZiBiYXNlO1xuICAgIH07XG4gIH1cbiAgZG9jdW1lbnQucmVnaXN0ZXJFbGVtZW50ID0gcmVnaXN0ZXI7XG4gIGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQgPSBjcmVhdGVFbGVtZW50O1xuICBkb2N1bWVudC5jcmVhdGVFbGVtZW50TlMgPSBjcmVhdGVFbGVtZW50TlM7XG4gIE5vZGUucHJvdG90eXBlLmNsb25lTm9kZSA9IGNsb25lTm9kZTtcbiAgc2NvcGUucmVnaXN0cnkgPSByZWdpc3RyeTtcbiAgc2NvcGUuaW5zdGFuY2VvZiA9IGlzSW5zdGFuY2U7XG4gIHNjb3BlLnJlc2VydmVkVGFnTGlzdCA9IHJlc2VydmVkVGFnTGlzdDtcbiAgc2NvcGUuZ2V0UmVnaXN0ZXJlZERlZmluaXRpb24gPSBnZXRSZWdpc3RlcmVkRGVmaW5pdGlvbjtcbiAgZG9jdW1lbnQucmVnaXN0ZXIgPSBkb2N1bWVudC5yZWdpc3RlckVsZW1lbnQ7XG59KTtcblxuKGZ1bmN0aW9uKHNjb3BlKSB7XG4gIHZhciB1c2VOYXRpdmUgPSBzY29wZS51c2VOYXRpdmU7XG4gIHZhciBpbml0aWFsaXplTW9kdWxlcyA9IHNjb3BlLmluaXRpYWxpemVNb2R1bGVzO1xuICB2YXIgaXNJRTExT3JPbGRlciA9IC9UcmlkZW50Ly50ZXN0KG5hdmlnYXRvci51c2VyQWdlbnQpO1xuICBpZiAodXNlTmF0aXZlKSB7XG4gICAgdmFyIG5vcCA9IGZ1bmN0aW9uKCkge307XG4gICAgc2NvcGUud2F0Y2hTaGFkb3cgPSBub3A7XG4gICAgc2NvcGUudXBncmFkZSA9IG5vcDtcbiAgICBzY29wZS51cGdyYWRlQWxsID0gbm9wO1xuICAgIHNjb3BlLnVwZ3JhZGVEb2N1bWVudFRyZWUgPSBub3A7XG4gICAgc2NvcGUudXBncmFkZVN1YnRyZWUgPSBub3A7XG4gICAgc2NvcGUudGFrZVJlY29yZHMgPSBub3A7XG4gICAgc2NvcGUuaW5zdGFuY2VvZiA9IGZ1bmN0aW9uKG9iaiwgYmFzZSkge1xuICAgICAgcmV0dXJuIG9iaiBpbnN0YW5jZW9mIGJhc2U7XG4gICAgfTtcbiAgfSBlbHNlIHtcbiAgICBpbml0aWFsaXplTW9kdWxlcygpO1xuICB9XG4gIHZhciB1cGdyYWRlRG9jdW1lbnRUcmVlID0gc2NvcGUudXBncmFkZURvY3VtZW50VHJlZTtcbiAgaWYgKCF3aW5kb3cud3JhcCkge1xuICAgIGlmICh3aW5kb3cuU2hhZG93RE9NUG9seWZpbGwpIHtcbiAgICAgIHdpbmRvdy53cmFwID0gU2hhZG93RE9NUG9seWZpbGwud3JhcElmTmVlZGVkO1xuICAgICAgd2luZG93LnVud3JhcCA9IFNoYWRvd0RPTVBvbHlmaWxsLnVud3JhcElmTmVlZGVkO1xuICAgIH0gZWxzZSB7XG4gICAgICB3aW5kb3cud3JhcCA9IHdpbmRvdy51bndyYXAgPSBmdW5jdGlvbihub2RlKSB7XG4gICAgICAgIHJldHVybiBub2RlO1xuICAgICAgfTtcbiAgICB9XG4gIH1cbiAgZnVuY3Rpb24gYm9vdHN0cmFwKCkge1xuICAgIHVwZ3JhZGVEb2N1bWVudFRyZWUod3JhcChkb2N1bWVudCkpO1xuICAgIGlmICh3aW5kb3cuSFRNTEltcG9ydHMpIHtcbiAgICAgIEhUTUxJbXBvcnRzLl9faW1wb3J0c1BhcnNpbmdIb29rID0gZnVuY3Rpb24oZWx0KSB7XG4gICAgICAgIHVwZ3JhZGVEb2N1bWVudFRyZWUod3JhcChlbHQuaW1wb3J0KSk7XG4gICAgICB9O1xuICAgIH1cbiAgICBDdXN0b21FbGVtZW50cy5yZWFkeSA9IHRydWU7XG4gICAgc2V0VGltZW91dChmdW5jdGlvbigpIHtcbiAgICAgIEN1c3RvbUVsZW1lbnRzLnJlYWR5VGltZSA9IERhdGUubm93KCk7XG4gICAgICBpZiAod2luZG93LkhUTUxJbXBvcnRzKSB7XG4gICAgICAgIEN1c3RvbUVsZW1lbnRzLmVsYXBzZWQgPSBDdXN0b21FbGVtZW50cy5yZWFkeVRpbWUgLSBIVE1MSW1wb3J0cy5yZWFkeVRpbWU7XG4gICAgICB9XG4gICAgICBkb2N1bWVudC5kaXNwYXRjaEV2ZW50KG5ldyBDdXN0b21FdmVudChcIldlYkNvbXBvbmVudHNSZWFkeVwiLCB7XG4gICAgICAgIGJ1YmJsZXM6IHRydWVcbiAgICAgIH0pKTtcbiAgICB9KTtcbiAgfVxuICBpZiAoaXNJRTExT3JPbGRlciAmJiB0eXBlb2Ygd2luZG93LkN1c3RvbUV2ZW50ICE9PSBcImZ1bmN0aW9uXCIpIHtcbiAgICB3aW5kb3cuQ3VzdG9tRXZlbnQgPSBmdW5jdGlvbihpblR5cGUsIHBhcmFtcykge1xuICAgICAgcGFyYW1zID0gcGFyYW1zIHx8IHt9O1xuICAgICAgdmFyIGUgPSBkb2N1bWVudC5jcmVhdGVFdmVudChcIkN1c3RvbUV2ZW50XCIpO1xuICAgICAgZS5pbml0Q3VzdG9tRXZlbnQoaW5UeXBlLCBCb29sZWFuKHBhcmFtcy5idWJibGVzKSwgQm9vbGVhbihwYXJhbXMuY2FuY2VsYWJsZSksIHBhcmFtcy5kZXRhaWwpO1xuICAgICAgcmV0dXJuIGU7XG4gICAgfTtcbiAgICB3aW5kb3cuQ3VzdG9tRXZlbnQucHJvdG90eXBlID0gd2luZG93LkV2ZW50LnByb3RvdHlwZTtcbiAgfVxuICBpZiAoZG9jdW1lbnQucmVhZHlTdGF0ZSA9PT0gXCJjb21wbGV0ZVwiIHx8IHNjb3BlLmZsYWdzLmVhZ2VyKSB7XG4gICAgYm9vdHN0cmFwKCk7XG4gIH0gZWxzZSBpZiAoZG9jdW1lbnQucmVhZHlTdGF0ZSA9PT0gXCJpbnRlcmFjdGl2ZVwiICYmICF3aW5kb3cuYXR0YWNoRXZlbnQgJiYgKCF3aW5kb3cuSFRNTEltcG9ydHMgfHwgd2luZG93LkhUTUxJbXBvcnRzLnJlYWR5KSkge1xuICAgIGJvb3RzdHJhcCgpO1xuICB9IGVsc2Uge1xuICAgIHZhciBsb2FkRXZlbnQgPSB3aW5kb3cuSFRNTEltcG9ydHMgJiYgIUhUTUxJbXBvcnRzLnJlYWR5ID8gXCJIVE1MSW1wb3J0c0xvYWRlZFwiIDogXCJET01Db250ZW50TG9hZGVkXCI7XG4gICAgd2luZG93LmFkZEV2ZW50TGlzdGVuZXIobG9hZEV2ZW50LCBib290c3RyYXApO1xuICB9XG59KSh3aW5kb3cuQ3VzdG9tRWxlbWVudHMpOyIsIi8vIGltcG9ydCB0aGUgcG9seWZpbGwgZnJvbSBub2RlX21vZHVsZXNcbmltcG9ydCBDdXN0b21FbGVtZW50cyBmcm9tICd3ZWJjb21wb25lbnRzLmpzL0N1c3RvbUVsZW1lbnRzJ1xuXG4vLyBkZWZpbmUgdGhlIGNsYXNzXG5jbGFzcyBEYXRlU3BhbiBleHRlbmRzIEhUTUxTcGFuRWxlbWVudCB7XG4gICBjcmVhdGVkQ2FsbGJhY2soKSB7XG4gICAgIHRoaXMudGV4dENvbnRlbnQgPSBcIlRvZGF5J3MgZGF0ZTogXCIgKyBuZXcgRGF0ZSgpLnRvSlNPTigpLnNsaWNlKDAsIDEwKVxuICAgfVxufVxuXG4vLyByZWdpc3RlciB0aGUgZWxlbWVudCB3LyB0aGUgRE9NXG5sZXQgRGF0ZVNwYW5FbGVtZW50ID0gZG9jdW1lbnQucmVnaXN0ZXJFbGVtZW50KCdkYXRlLXRvZGF5JywgRGF0ZVNwYW4pXG5cbi8vIGV4cG9ydCBmb3Igb3RoZXIgcHBsIHRvIHJldXNlIVxuZXhwb3J0IGRlZmF1bHQgRGF0ZVNwYW5FbGVtZW50XG4iXX0=
