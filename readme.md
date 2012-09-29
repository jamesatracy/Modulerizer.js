## Modulerizer.js

Modulerizer.js is a javascript library that contains loader functionality and dependency management utilities. By making it easy to resolve dependencies and load resources on the fly from within the client, modulerizer does away with the need to write complicated back-end scripts to inject the correct number of scripts and resources in the correct order when an application is loaded. Since modulerizer has no external dependencies, at most all that you have to do to bootstrap an application is include the modulerizer.js "seed" file in the page and some simple logic to subsequently load the necessary start up modules. The seed file, therefore, is the bare minimum that you need to dynamically load all required modules into the page on demand.

### Loading Modules

Modulerizer defines a single global object called `MOD`. In order to start using it, you must first create a new instance of it and then call its "use" method to tell it what modules you need loaded. `MOD` creates a brand new "mod" instance without any modules activated, thereby effectively creating a sandbox. The new "mod" instance is passed to the use method's callback function when all of the request modules and their dependencies are loaded:

	MOD().use("core/ui/button", function (mod) {
		// button is ready to be used
		var button = new mod.ui.button();
	});

	// mod.ui.button is not available out here...

`MOD` can be thought of as a factory method that churns out mod instances - everytime it is invoked you get a fresh instance of mod. That means that you can have more than one mod instance running on a single page, if desired, and modifications to one will not affect modifications to others. Modules are only downloaded once, but they can be loaded multiple times in multiple different instances. 

After the initial call to MOD().use( ... ) you can make subsequent calls to mod.use( ... ) to load additional modules into your instance of mod:

	MOD().use("core/ui/button", function (mod) {
		// button is ready to be used
		var button = new mod.ui.button();

		mod.use("core/xhr", function (mod) {
			// xhr is ready to be used
			mod.xhr.getJSON( ... );
		});
		// mod.xhr is not available here
	});

	// mod.ui.button is not available out here...

You can request more than one module at a time by passing in an array of module names to the use() method. The callback function will not be executed until each module and all of its dependencies have been loaded:

	MOD().use(["core/mvc","core/xhr","core/ui/button", function (mod) {
		// mvc, xhr, and button are ready to be used
	});

### File Directory Conventions


By default, each module corresponds to a single javascript source file on the server. Modulerizer must at a bare minimum configure the url path to the source code's root directory:

	MOD.config.root = "http://example.com/mod/src/"

From within this root directly modules can be divided into sub-directories. Modules are then references first by their relative path (ex: "core/ui/") and then the module name, which corresponds to the module's main directory (ex: "button"). Resources for a module are then divided into sub-directories for each file type.

	Example:

	/src/
		/core/
			/ui/
				/button/
					/js/
						button.js
						toggle.js
					/css/

			/xhr/
				/js/
					xhr.js

In the above example file structure, the following module references would correspond to the following files:

	core/ui/button ? /src/core/ui/button/js/button.js
	core/ui/button-toggle ? /src/core/ui/button/js/toggle.js
	core/xhr ? /src/core/xhr/js/xhr.js

The format for referencing modules can be described as: `[path]module-submodule`

You can also use modulerizer to load scripts directly without using the module name format by including the file extension and the actual relative path to the file. Let's say that you have a /src/vendor/ folder with a bunch of third party scripts:

	/src/
		/vendor/
			jquery.js
			underscore.js
			backbone.js

These can be loaded as follows:

	MOD().use(["vendor/jquery.js",:vendor/underscore.js","vendor/backbone.js"], function (mod) {

		// jquery, underscore, and backbone are loaded
	});

Finally, you can also use modulerizer's Loader object to load external files directly by specifying the full url path to the file:

	MOD.Loader.load("https://code.google.com/jquery/jquery1.8.2.js", function () {

		// jquery is loaded now...
	});


### Loading non-Javascript Resources

Though it is built to handle javascript files by default, modulerizer can actually load any resource file dynamically. All that you have to do is register a handler with the Mod.Loader object:

	MOD.Loader.register("css", function (url, callback) {
		// load the css file here....

		if (callback) {
			// we're done
			callback();
		}
	};

Out of the box, modulerizer can handle .js, .css, and .html (for template files).

In order to load a non-javascript resource, all that you have to do is add ! (bang) and the file extension to the end of the module name that is passed to use().

Let's say that you have a css file located here:

	/src/core/ui/button/css/button.css

This file can be loaded as follows:

	MOD().use("core/ui/button!css", function (mod) {
		// the css is now loaded
	});

As another example, let's say that you have a template file located here:

	/src/module/html/module_main.html

This file can be loaded as follows:

	MOD().use("module-module_main!html", function (mod) {
		// the template is ready to use and can be selected with $("script.template.module_main")
	});

### Defining Modules

Modules are defined in their respective javascript files by using the MOD.add() method. The add() method takes the module name (the same name that is passed to use), an array of zero or more dependencies, and a function to be executed when the module is ready to be loaded.

Ex:

	// define the mod.ui.button module
	MOD().add("core/ui/button", ["core/ui/widget-base","core/ui/button!css"], function (mod) {

		// create a namespace on the mod object for the button
		MOD.namespace("ui.button", mod);

		// define the button
		mod.ui.button = function () {
			// button constructor...
		};
	});

In this example, the button module depends on the "widget base" module and a "button" css file to style it. These are loaded before the function parameter is executed to create the button. Once it is executed, the button module uses the MOD.namespace() method for creating a namespace on the mod object instance for storing the button's constructor object. That way, code that uses this module can call new mod.ui.button() to create new buttons. This is the generic framework for defining modules.

Modules, of course, can execute any kind of logic within their function method that they wish and don't have to modify the mod object instance.
