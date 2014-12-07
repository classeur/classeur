angular.module('classeur.core.button', [])
	.directive('clButton', function() {
		return {
			restrict: 'E',
			scope: {
				scale: '@',
				scaleHover: '@',
				opacity: '@',
				opacityHover: '@',
				action: '&'
			},
			templateUrl: 'app/core/button/button.html',
			link: function(scope) {

			}
		};
	})
	.factory('Button', function($famous) {
		var Transitionable = $famous['famous/transitions/Transitionable'];

		return function Button(options) {

			options = angular.extend({
				scale: 0.9,
				scaleHover: 1,
				opacity: 0.8,
				opacityHover: 1
			}, options);

			function getScale(isHover) {
				return [
					isHover ? options.scaleHover : options.scale,
					isHover ? options.scaleHover : options.scale
				];
			}

			function getOpacity(isHover) {
				return isHover ? options.opacityHover : options.opacity;
			}

			this.scaleTrans = new Transitionable(getScale());
			this.opacityTrans = new Transitionable(getOpacity());
			this.toggleHover = function(isHover) {
				this.scaleTrans.set(getScale(isHover), {duration: 180, curve: 'easeOut'});
				this.opacityTrans.set(getOpacity(isHover) ? 0.35 : 0.3, {duration: 180, curve: 'easeOut'});
			};

		};
	});
