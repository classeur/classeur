angular.module('classeur.app', [
	'ngMaterial',
	'ngAnimate',
	'ngAria',
	'slugifier',
	'classeur.core.button',
	'classeur.core.classeur',
	'classeur.core.classeurLayout',
	'classeur.core.docs',
	'classeur.core.editor',
	'classeur.core.editorLayout',
	'classeur.core.files',
	'classeur.core.keystrokes',
	'classeur.core.settings',
	'classeur.core.user',
	'classeur.core.utils',
	'classeur.extensions.btnBar',
	'classeur.extensions.commenting',
	'classeur.extensions.fileTitle',
	'classeur.extensions.folding',
	'classeur.extensions.htmlSanitizer',
	'classeur.extensions.urlDialog',
	'classeur.extensions.markdownExtra',
	'classeur.extensions.mathJax',
	'classeur.extensions.scrollSync',
	'classeur.extensions.stat',
])
	.config(function($animateProvider, $mdThemingProvider) {
		$animateProvider.classNameFilter(/angular-animate/);
		var menuTheme = $mdThemingProvider.theme('classeur-menu', 'default');
		menuTheme.dark();
		menuTheme.foregroundShadow = '';
		console.log(menuTheme);
	});

