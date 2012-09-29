/**
Defines the test module of MOD
@filename module2.js
*/

MOD.add("test1-module2", ["test1-module1"], function (mod) {
	mod.module2 = true;
	if (mod.module1) {
		mod.module2_dependencies = true;
	}
});