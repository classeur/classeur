angular.module('classeur.core.button', [])
	.directive('clButton', function($famous) {
		var Transitionable = $famous['famous/transitions/Transitionable'];

		return {
			restrict: 'E',
			scope: true,
			transclude: true,
			templateUrl: 'app/core/button/button.html',
			link: function(scope, element, attrs) {
				scope.scale = parseFloat(attrs.scale || 1);
				scope.scaleHover = parseFloat(attrs.scaleHover || 1.1);
				scope.opacity = parseFloat(attrs.opacity || 0.8);
				scope.opacityHover = parseFloat(attrs.opacityHover || 1);
				scope.surfaceClass = attrs.surfaceClass;

				function getScale(isHover) {
					return [
						isHover ? scope.scaleHover : scope.scale,
						isHover ? scope.scaleHover : scope.scale
					];
				}

				function getOpacity(isHover) {
					return isHover ? scope.opacityHover : scope.opacity;
				}

				scope.scaleTrans = new Transitionable(getScale());
				scope.opacityTrans = new Transitionable(getOpacity());
				scope.toggleHover = function(isHover) {
					scope.scaleTrans.set(getScale(isHover), {duration: 180, curve: 'easeOutBounce'});
					scope.opacityTrans.set(getOpacity(isHover), {duration: 180, curve: 'easeOutBounce'});
				};

			}
		};
	});
