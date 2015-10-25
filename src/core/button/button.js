angular.module('classeur.core.button', [])
	.directive('clButton',
		function() {
			return {
				restrict: 'E',
				scope: true,
				transclude: true,
				template: '<div class="btn-panel"><ng-transclude></ng-transclude></div>',
				link: link
			};

			function link(scope, element, attrs) {
				var opacity = parseFloat(attrs.opacity || 0.7);
				var opacityHover = parseFloat(attrs.opacityHover || 1);
				var opacityActive = parseFloat(attrs.opacityActive || opacityHover);
				var buttonElt = element[0].querySelector('.btn-panel');
				if (attrs.class) {
					buttonElt.className += ' ' + attrs.class;
				}
				attrs.size && buttonElt.clanim.width(attrs.size).height(attrs.size);
				['width', 'height', 'top', 'right', 'bottom', 'left'].cl_each(function(attrName) {
					var attr = attrs[attrName];
					attr && buttonElt.clanim[attrName](attr);
				});
				buttonElt.clanim.start();
				var isActive, isHover, isInited;

				function toggle() {
					buttonElt.classList.toggle('active', !!isActive);
					var opacityToSet = opacity;
					var easing = 'materialIn';
					if (isActive) {
						opacityToSet = opacityActive;
					} else if (isHover) {
						opacityToSet = opacityHover;
					} else {
						opacityToSet = opacity;
						easing = 'materialOut';
					}
					if (isInited) {
						buttonElt.clanim
							.opacity(opacityToSet)
							.easing(easing)
							.duration(200)
							.start(true);
					} else {
						buttonElt.style.opacity = opacityToSet;
						isInited = true;
					}
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
		});
