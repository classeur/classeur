angular.module('classeur.core.button', [])
	.directive('clButton', function(clPanel) {

		return {
			restrict: 'E',
			scope: true,
			transclude: true,
			templateUrl: 'core/button/button.html',
			link: function(scope, element, attrs) {
				scope.class = attrs.class;
				var scale = parseFloat(attrs.scale || 1);
				var scaleHover = parseFloat(attrs.scaleHover || 1.1);
				var opacity = parseFloat(attrs.opacity || 0.8);
				var opacityHover = parseFloat(attrs.opacityHover || 1);
				var buttonPanel = clPanel(element, '.btn-panel');
				attrs.size && buttonPanel.width(attrs.size).height(attrs.size);
				['width', 'height', 'top', 'right', 'bottom', 'left'].forEach(function(attrName) {
					var attr = attrs[attrName];
					attr && buttonPanel[attrName](attr);
				});
				function enter() {
					buttonPanel.move('fast').scale(scaleHover).set('opacity', opacityHover).ease('out').end();
				}
				var speed;
				function leave() {
					buttonPanel.move(speed).scale(scale).set('opacity', opacity).ease('in').end();
				}
				leave();
				speed = 'fast';
				element.on('mouseenter', enter);
				element.on('mouseleave', leave);
			}
		};
	});
