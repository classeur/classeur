angular.module('classeur.opt.offlineAlert', [])
	.directive('clOfflineIndicator', function($timeout, clSocketSvc) {
		return {
			restrict: 'E',
			scope: true,
			templateUrl: 'opt/offlineAlert/offlineIndicator.html',
			link: function(scope) {
				var timeoutId = $timeout(function() {
					timeoutId = null;
					setFlag();
				}, 3000);
				function setFlag() {
					scope.show = !clSocketSvc.hasToken || (!clSocketSvc.isReady && !timeoutId);
				}
				scope.$watch('socketSvc.isReady', setFlag);
			}
		};
	})
	.directive('clOfflineAlert', function() {
		return {
			restrict: 'E',
			template: '<cl-offline-alert-panel ng-if="editorLayoutSvc.currentControl === \'offlineAlert\'"></cl-offline-alert-panel><cl-signin-alert-panel ng-if="editorLayoutSvc.currentControl === \'signinAlert\'"></cl-signin-alert-panel>',
		};
	})
	.directive('clOfflineAlertPanel', function(clDraggablePanel) {
		return {
			restrict: 'E',
			templateUrl: 'opt/offlineAlert/offlineAlertPanel.html',
			link: function(scope, element) {
				clDraggablePanel(element, '.offline-alert.panel', 0, 0, -1);
			}
		};
	})
	.directive('clSigninAlertPanel', function(clDraggablePanel) {
		return {
			restrict: 'E',
			templateUrl: 'opt/offlineAlert/signinAlertPanel.html',
			link: function(scope, element) {
				clDraggablePanel(element, '.signin-alert.panel', 0, 0, -1);
			}
		};
	});
