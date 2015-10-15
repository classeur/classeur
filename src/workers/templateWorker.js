/*global Handlebars*/
addEventListener('message', function(e) {
	var template = Handlebars.compile(e.data[0]);
	var context = e.data[1];
	var customContext = e.data[2];
	(function() {
		try {
			var e, self, postMessage, importScripts, XMLHttpRequest;
			customContext = eval(customContext);
			var customKeys = Object.keys(customContext);
			for(var i=0; i<customKeys.length; i++) {
				context[customKeys[i]] = customContext[customKeys[i]];
			}
		} catch(err) {
		}
	})();
	postMessage(template(context));
	close();
});
