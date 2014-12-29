angular.module('classeur.app', [
	'ngMaterial',
	'ngAnimate',
	'slugifier',
	'famous.angular',
	'classeur.core.button',
	'classeur.core.editor',
	'classeur.core.layout',
	'classeur.core.prism',
	'classeur.core.settings',
	'classeur.extensions.btnBar',
	'classeur.extensions.commenting',
	'classeur.extensions.folding',
	'classeur.extensions.htmlSanitizer',
	'classeur.extensions.markdownExtra',
	'classeur.extensions.mathJax',
	'classeur.extensions.scrollSync',
	'classeur.extensions.stat',
])
	.config(function($animateProvider) {
		$animateProvider.classNameFilter(/angular-animate/);
	})
	.run(function($famous) {
		// Fix scrolling on mobile
		var Engine = $famous['famous/core/Engine'];
		Engine.setOptions({
			appMode: false
		});
	});

