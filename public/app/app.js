angular.module('classeur.app', [
	'ngRoute',
	'ngMaterial',
	'ngAnimate',
	'ngAria',
	'slugifier',
	'classeur.templates',
	'classeur.core',
	'classeur.core.button',
	'classeur.core.explorerLayout',
	'classeur.core.docs',
	'classeur.core.editor',
	'classeur.core.editorLayout',
	'classeur.core.files',
	'classeur.core.folders',
	'classeur.core.keystrokes',
	'classeur.core.settings',
	'classeur.core.user',
	'classeur.core.utils',
	'classeur.extensions.btnBar',
	'classeur.extensions.commenting',
	'classeur.extensions.fileDragging',
	'classeur.extensions.fileTitle',
	'classeur.extensions.folding',
	'classeur.extensions.htmlSanitizer',
	'classeur.extensions.readOnlyAlert',
	'classeur.extensions.urlDialog',
	'classeur.extensions.markdownExtra',
	'classeur.extensions.mathJax',
	'classeur.extensions.scrollSync',
	'classeur.extensions.stat',
])
	.config(function($locationProvider, $animateProvider, $mdThemingProvider) {
		$locationProvider.hashPrefix('!');
		$animateProvider.classNameFilter(/angular-animate/);
		var menuTheme = $mdThemingProvider.theme('classeur', 'default');
		menuTheme.dark();
		menuTheme.foregroundShadow = '';
	});

