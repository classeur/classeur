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
	.factory('panel', function() {
		window.move.defaults = {
			duration: 0
		};

		function Panel(elt, selector) {
			elt = selector ? angular.element(elt[0].querySelector(selector)) : elt;
			this.$elt = elt;
			this.$$elt = elt[0];
		}

		function styleSetter(attr, unit) {
			return function(value) {
				this.$$elt.style[attr] = value !== undefined ? value + unit : '';
				return this;
			};
		}

		[
			'width',
			'height',
			'top',
			'right',
			'bottom',
			'left'
		].forEach(function(attr) {
			Panel.prototype[attr] = styleSetter(attr, 'px');
		});

		Panel.prototype.move = function() {
			return window.move(this.$$elt).ease('out');
		};

		return function(elt, selector) {
			return new Panel(elt, selector);
		};
	})
	.run(function($rootScope) {
		// Trigger function that forces a scope variable to change for event listening
		$rootScope.trigger = function(eventName) {
			$rootScope[eventName] = Date.now();
		};
	});
