angular.module('classeur.app', [
	'ngMaterial',
	'ngAnimate',
	'ngAria',
	'slugifier',
	'classeur.core.button',
	'classeur.core.classeurLayout',
	'classeur.core.docs',
	'classeur.core.editor',
	'classeur.core.files',
	'classeur.core.keystrokes',
	'classeur.core.layout',
	'classeur.core.settings',
	'classeur.core.user',
	'classeur.core.utils',
	'classeur.extensions.btnBar',
	'classeur.extensions.commenting',
	'classeur.extensions.folding',
	'classeur.extensions.htmlSanitizer',
	'classeur.extensions.urlDialog',
	'classeur.extensions.markdownExtra',
	'classeur.extensions.mathJax',
	'classeur.extensions.scrollSync',
	'classeur.extensions.stat',
])
	.config(function($animateProvider) {
		$animateProvider.classNameFilter(/angular-animate/);
	});

