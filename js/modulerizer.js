/*
Modulerizer.js
Copyright (C) 2012 James Tracy

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
*/

/**
The global module factory function
@return [object] A new instance of the module object
*/
var MOD = (function (config) {
	var mod,				// the module constructor
		properties,			// properties object
		_loaded = {};		// array of loaded modules
		
	// default module instance properties
	properties = {
		/** Modulerizer version number **/
		VERSION: "0.1.0",
		
		/** 
		Config options can be overridden by passing a config object to the MOD()
		factory function. Otherwise, config is taken from the global MOD.config object.
		*/
		config: {},
		
		/** Module loader */
		use: function (modules, callback) {
			var self = this,
				path;
			
			if (typeof modules == "function") {
				// no module specified
				modules(self);
			} else {
				if (typeof modules == "string") { 
					// single module specified
					modules = [modules];
				} 
				_use(self, modules, callback);
			}
		}
	};
	
	/** 
	@constructor 
	@param [object] config An optional configuration object to override the global MOD.config.
	*/
	mod = function (config) {
		var x;
		// config will be mixed into properties
		config = config || MOD.config;
		for (x in config) {
			if (config.hasOwnProperty(x)) {
				properties.config[x] = config[x];
			}
		}
		// properties will be mixed into this
		for (x in properties) {
			if (properties.hasOwnProperty(x)) {
				this[x] = properties[x];
			}
		}
	};
	
	/** 
	Fetch a module from the remote server 
	@private
	*/
	function _use(self, modules, callback) {
		var Loader,
			missing = [], 
			name, 
			len, 
			remaining,
			i;
		
		// modules not defined check
		if (!modules) {
			if (callback) {
				callback(self);
			}
		}
		
		// loop over modules array
		len = modules.length;
		remaining = len;
		for (i = 0; i < len; i++) {
			name = modules[i];
			_loadModule(self, name, function () {
				remaining--;
				if (remaining == 0) {
					// we're done
					if (callback) {
						callback(self);
					}
				};
			});
		}
	};
	
	/**
	Load a module
	@private
	*/
	function _loadModule(self, name, callback) {
		var module,
			Loader,
			requires;
		/*
		A module is an (optional) object constructor, (optional) requires array, and (optional) related meta data.
		If a module does not have any dependencies defined, then it is executed immediately.
		If a module has external dependencies, then its execution is delayed until all of these dependencies are loaded.
		If a module does not call MOD().add() then the script is simply fetched and loaded.
		*/
		module = MOD._modules[name];
		if (module) {
			// module is loaded
			requires = module.requires;				
			if (requires && requires.length > 0) {
				// this module has one or more dependencies
				_use(self, requires, function () {
					// we're done, so execute this component
					if (!_loaded[name]) {
						if (module.func) {
							module.func.call(MOD.global, self);
						}
						_loaded[name] = true;
					}
					if (callback) {
						callback(self);
					}
				});
			} else {
				// no dependencies, execute immediately
				if (!_loaded[name]) {
					if (module.func) {
						module.func.call(MOD.global, self);
					}
					_loaded[name] = true;
				}
				if (callback) {
					callback(self);
				}
			}
		} else {
			// module is not loaded yet
			Loader = new MOD.Loader();
			Loader.fetch(name, self.config, function () {
				if (!MOD._modules[name]) {
					// add a blank entry for this module
					MOD._modules[name] = {};
				}
				_loadModule(self, name, function () {
					if (callback) {
						callback(self);
					}
				});
			});
		}
	};	
	
	return function (config) {
		return new mod(config);
	}
}());

/** Global context */
MOD.global = this;

/**
The global modulerizer configuration object.
You can overwrite these values globally, or pass in a config object
to MOD() to use for that particular instance.
*/
MOD.config = {
	/** Root url for loading additional modules */
	root: "/",
	/** Document context */
	document: MOD.global.document
};

/** Map of modules registered through MOD.add() */
MOD._modules = {};

/** 
Creates a namespace stub 
@param [String] name The namespace name
@param [Object] context The context in which to define the namespace.
	Defaults to the global context.
@return [Object] Returns the namespace
*/
MOD.namespace = function (name, context) {
	var parts, 
		part,
		cur,
		i;
		
	parts = name.split(".");
	cur = context || MOD.global;
	for (i = 0; i < parts.length; i++) {
		part = parts[i];
		if (cur[part] === undefined || cur[part] === null) {
			cur[part] = {};
		}
		cur = cur[part];
	}
	return cur;
};

/**
Registers a module with MOD
@param [String] name The name of the module
@param [Object] requires The module's requires data
@param [Function] func The module's constructor
	Example:
		{ requires: ["module-1", "module-2"] }
*/
MOD.add = function (name, requires, func, meta) {
	MOD._modules[name] = {func: func, requires: requires, meta: meta};
};

/** 
Loader object for dynamically loading modules 
*/
MOD.Loader = (function () {
	var Loader = function () {};
	
	/** Map of pending modules */
	Loader._pending = {};
	
	/** Map of modules finished downloading */
	Loader._finished = {};
	
	/** 
	Map of registered loader functions.
	The loader functions are mapped by the file type that they load.
	Ex: MOD.Loader.loaders["js"] handles javascript files.
	*/
	Loader._loaders = [];
	
	/** Array of loader listeners */
	Loader._listeners = {};
		
	/**
	Register a loader function.
	Loader functions are registered by the file type which they handle
	and are called with the full url to the file and a callback.
	File types are defined (or referenced) in the module definition file.
	Ex: "scripts": [
			...
		],
		"css": [
			...
		]
	@param [string] type The file type that the loader handles
	@param [function] loader The loader function.
	*/
	Loader.register = function (type, loader) {
		Loader._loaders[type] = loader;
	};
	
	/**
	Load a remote resource
	@param [string] type The type of resource
	@param [string] url The remote url path
	@param [function] callback A function to call when loading is complete
	*/
	Loader.load = function (type, url, callback) {
		var self = this;
		if (Loader._loaders[type]) {
			loader = Loader._loaders[type];
			loader.call(self, url, function () {
				if (callback) {
					callback();
				}
			});
		}
	};
			
	/** 
	Public prototype methods. 
	These methods must be called on a new instance of MOD.Loader
	*/
	
	/** Fetch a module from the remote server */
	Loader.prototype.fetch = function (name, config, callback) {
		var self = this,
			path,
			type,
			src;
						
		// already downloaded?
		if (Loader._finished[name]) {
			if (callback) {
				callback();
			}
		}
		// already pending?
		if (Loader._pending[name]) {
			self.listen(name, callback);
			return; // do nothing
		}
		// not downloaded and not pending
		Loader._pending[name] = true;
		self.listen(name, callback);
		
		// construct the path 
		// ex: folder/module-submodule => folder/module
		path = name;
		if (path.indexOf("-") >= 0) {
			// strip off anything after the dash
			path = path.substr(0, path.indexOf("-"));
		}
		if (path.indexOf("!") >= 0) {
			// strip off anything after the !
			path = path.substr(0, path.indexOf("!"));
		}
		
		// determine the type
		type = "js";
		if (name.indexOf("!") >= 0) {
			// get the type
			type = name.substr(name.indexOf("!") + 1);
		}
		
		// construct the src filename
		// ex: folder/module-submodule => module-submodule.js
		src = name;
		if (src.indexOf("." + type) < 0) {
			if (src.lastIndexOf("/") >= 0) {
				// strip off anything before the last slash
				src = src.substr(src.lastIndexOf("/") + 1);
			}
			if (src.indexOf("-") >= 0) {
				// strip off anything before the first dash
				src = src.substr(src.indexOf("-") + 1);
			}
			if (src.indexOf("!") >= 0) {
				// strip off anything after the !
				src = src.substr(0, src.indexOf("!"));
			}
			src += "." + type;
			// construct final path
			path = config.root  + path + "/" + type + "/" + src;
		} else {
			// construct final path
			path = config.root + src;
		}
		
		if (Loader._loaders[type]) {
			// this type has a loader registered for it with MOD.Loader.register()
			Loader.load(type, path, function () {
				// file is now loaded
				Loader._pending[name] = null;
				Loader._finished[name] = true;
				trigger(self, "loaded", name);
			});
		}
	};

	/** Bind to loader events */
	Loader.prototype.listen = function (name, callback) {
		Loader._listeners[name] = Loader._listeners[name] || [];
		Loader._listeners[name].push(callback);
	};
	
	/** Unbind from loader events */
	Loader.prototype.unlisten = function (name, callback) {
		var self = this,
			listeners,
			length,
			cb,
			i;
		
		if (!Loader._listeners[name]) {
			return;
		}
		listeners = Loader._listeners[name];
		length = listeners.length;
		for (i = 0; i < length; i++) {
			cb = listeners[i];
			if (cb == callback) {
				listeners.splice(index, 1);
				break;
			}
		};
	};
	
	/** 
	Triggers an event 
	@private
	*/
	function trigger(self, event, name) {
		var listeners,
			length,
			cb,
			i;
		
		if (!Loader._listeners[name]) {
			return;
		}
		listeners = Loader._listeners[name];
		length = listeners.length;
		for (i = 0; i < length; i++) {
			cb = listeners[i];
			if (cb) {
				cb(event, name);
			}
		};
	};
	
	// create the loader instance
	return Loader;
}());

// Register the javascript (script) loader
MOD.Loader.register("js", function (url, callback) {
	var script = MOD.config.document.createElement("script");
	script.type = "text/javascript";
	
	if (script.readyState) { // IE
		script.onreadystatechange = function () {
			if (script.readyState == "loaded" || script.readyState == "complete") {
				script.onreadystatechange = null;
				if (callback) {
					callback(script);
				}
			}
		};
	} else { // Others
		script.onload = function () {
			script.onload = null;
			if (callback) {
				callback(script);
			}
		};
	}

	script.src = url;
	MOD.config.document.getElementsByTagName("body")[0].appendChild(script);
});

// Register the stylesheet (css) loader
MOD.Loader.register("css", function (url, callback) {
	var document = MOD.config.document,
		headID,
		cssNode;	
	headID = document.getElementsByTagName("head")[0];
	cssNode = document.createElement('link');
	cssNode.type = "text/css";
	cssNode.rel = "stylesheet";
	cssNode.href = url;
	headID.appendChild(cssNode);
	if (callback) {
		callback();
	}
});

// Register the html (template) loader
MOD.Loader.register("html", function (url, callback) {
	var script = MOD.config.document.createElement("script"),
		httpRequest,
		name;
	
	name = url.substr(url.lastIndexOf("/") + 1);
	name = name.replace(".html", "");
	script.type = "text/html";
	script.className = "template " + name;
	
	if (window.XMLHttpRequest) { // firefox etc 
		httpRequest = new XMLHttpRequest();
	} else if (window.ActiveXObject) { // ie
		httpRequest = new ActiveXObject("Microsoft.XMLHTTP");
	}
	httpRequest.onreadystatechange = function () {
		if (httpRequest.readyState == 4 && httpRequest.status == 200) {
			script.innerHTML = httpRequest.responseText;
			MOD.config.document.getElementsByTagName("body")[0].appendChild(script);
			if (callback) {
				callback();
			}
		}
	};
	httpRequest.open('GET', url, true);
	httpRequest.send('');
});
