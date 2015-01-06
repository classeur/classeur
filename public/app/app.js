angular.module('classeur.app', [
	'ngMaterial',
	'ngAnimate',
	'slugifier',
	'classeur.core.button',
	'classeur.core.editor',
	'classeur.core.layout',
	'classeur.core.settings',
	'classeur.core.user',
	'classeur.core.utils',
	'classeur.extensions.btnBar',
	'classeur.extensions.commenting',
	'classeur.extensions.folding',
	'classeur.extensions.htmlSanitizer',
	'classeur.extensions.imageDialog',
	'classeur.extensions.markdownExtra',
	'classeur.extensions.mathJax',
	'classeur.extensions.scrollSync',
	'classeur.extensions.stat',
])
	.config(function($animateProvider) {
		$animateProvider.classNameFilter(/angular-animate/);
	});

