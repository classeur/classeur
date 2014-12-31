angular.module('classeur.core.utils', [])
	.factory('uid', function() {
		// Generates a 24 char length random id
		var alphabet = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
		var mapper = Array.apply(null, new Array(24));
		return function() {
			return mapper.map(function() {
				return alphabet[Math.random() * alphabet.length | 0];
			}).join('');
		};
	})
	.run(function($rootScope) {
		// Trigger function that forces a scope variable to change for event listening
		$rootScope.trigger = function(eventName) {
			$rootScope[eventName] = Date.now();
		};
	});
