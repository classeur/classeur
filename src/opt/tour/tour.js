angular.module('classeur.opt.tour', [])
	.directive('clTour', function(clPanel, clLocalSettingSvc) {
		return {
			restrict: 'E',
			templateUrl: 'opt/tour/tour.html',
			link: function(scope, element) {
				var tourPanel = clPanel(element, '.tour.panel');
				setTimeout(function() {
					tourPanel.$jqElt.addClass('show');
				}, 1);
				scope.show = true;
				scope.hide = function() {
					scope.show = false;
				};
				if(!clLocalSettingSvc.values.tourStep) {
					clLocalSettingSvc.values.tourStep = 1;
				}
			}
		};
	});
