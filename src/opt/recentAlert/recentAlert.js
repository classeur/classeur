angular.module('classeur.opt.recentAlert', [])
	.directive('clRecentAlert', function() {
		return {
			restrict: 'E',
			template: '<cl-recent-alert-panel ng-if="show"></cl-recent-alert-panel>',
			scope: true,
			link: function(scope) {
				var dismissFlagKey = 'recentDismiss';
				scope.show = !localStorage.hasOwnProperty(dismissFlagKey);
				scope.dismiss = function() {
					localStorage[dismissFlagKey] = 1;
					scope.show = false;
				};
			}
		};
	})
	.directive('clRecentAlertPanel', function(clPanel) {
		return {
			restrict: 'E',
			templateUrl: 'opt/recentAlert/recentAlertPanel.html',
			link: function(scope, element) {
				clPanel(element, '.recent-alert.panel').move().rotate(-1).end();
			}
		};
	});
