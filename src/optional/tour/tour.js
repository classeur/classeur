angular.module('classeur.optional.tour', [])
	.directive('clTour',
		function($timeout, clDialog, clLocalSettingSvc) {
			return {
				restrict: 'E',
				link: link
			};

			function link() {
				if (!clLocalSettingSvc.values.tourStep) {
					$timeout(function() {
						clDialog.show({
							templateUrl: 'optional/tour/tourDialog.html',
							onComplete: function(scope) {
								scope.close = function() {
									clDialog.cancel();
								};
								scope.start = function() {
									clDialog.hide();
								};
							}
						}).then(function() {
							clLocalSettingSvc.values.tourStep = 1;
						}, function() {
							clLocalSettingSvc.values.tourStep = -1;
						});
					}, 100);
				}
			}
		})
	.directive('clTourStep',
		function($timeout) {
			return {
				restrict: 'A',
				link: link
			};

			function link(scope, element, attr) {
				var timeoutId;
				scope.show = false;
				scope.$watch(attr.clTourStep, function(value) {
					$timeout.cancel(timeoutId);
					if (value) {
						timeoutId = $timeout(function() {
							scope.show = true;
						}, 500);
					} else {
						scope.show = false;
					}
				});
			}
		})
	.directive('clTourNext',
		function(clLocalSettingSvc) {
			return {
				restrict: 'A',
				link: link
			};

			function link(scope, element, attr) {
				var nextStep = parseInt(attr.clTourNext);
				element.on('click', function() {
					clLocalSettingSvc.values.tourStep === nextStep - 1 && clLocalSettingSvc.values.tourStep++;
				});
			}
		});
