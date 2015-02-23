angular.module('classeur.core.button', [])
	.directive('clButton', function(clPanel) {

		return {
			restrict: 'E',
			scope: true,
			transclude: true,
			templateUrl: 'core/button/button.html',
			link: function(scope, element, attrs) {
				scope.class = attrs.class;
				var opacity = parseFloat(attrs.opacity || 0.75);
				var opacityHover = parseFloat(attrs.opacityHover || 1);
				var opacityActive = parseFloat(attrs.opacityActive || opacityHover);				
				var buttonPanel = clPanel(element, '.btn-panel');
				attrs.size && buttonPanel.width(attrs.size).height(attrs.size);
				['width', 'height', 'top', 'right', 'bottom', 'left'].forEach(function(attrName) {
					var attr = attrs[attrName];
					attr && buttonPanel[attrName](attr);
				});
				var isActive, isHover, speed;
				function toggle() {
					if(isActive) {
						buttonPanel.move(speed).set('opacity', opacityActive).ease('out').end();
					}
					else if(isHover) {
						buttonPanel.move(speed).set('opacity', opacityHover).ease('out').end();
					}
					else {
						buttonPanel.move(speed).set('opacity', opacity).ease('in').end();
					}
					speed = 'slow';
				}
				element.on('mouseenter', function() {
					isHover = true;
					toggle();
				});
				element.on('mouseleave', function() {
					isHover = false;
					toggle();
				});
				attrs.active ? scope.$watch(attrs.active, function(value) {
					isActive = value;
					toggle();
				}) : toggle();
			}
		};
	});
