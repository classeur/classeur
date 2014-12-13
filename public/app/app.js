angular.module('classeur.app', [
	'ngMaterial',
	'ngAnimate',
	'famous.angular',
	'classeur.core.button',
	'classeur.core.cledit',
	'classeur.core.layout',
	'classeur.core.prism',
	'classeur.core.settings',
	'classeur.extensions.btnBar',
	'classeur.extensions.folding',
	'classeur.extensions.markdownExtra',
	'classeur.extensions.mathJax',
	'classeur.extensions.scrollSync',
])
	.config(function($animateProvider) {
		$animateProvider.classNameFilter(/angular-animate/);
	})
	.run(function($famous) {
		var TweenTransition = $famous['famous/transitions/TweenTransition'];
		TweenTransition.registerCurve('custom', function(t) {
			var p = 0.3;
			return Math.pow(2, -10 * t) * Math.sin((t - p / 4) * (2 * Math.PI) / p) + 1;
		});

		// Fix scrolling on mobile
		var Engine = $famous['famous/core/Engine'];
		Engine.setOptions({
			appMode: false
		});
	});

