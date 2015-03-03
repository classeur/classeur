angular.module('classeur.extensions.offlineAlert', [])
	.directive('clOfflineIndicator', function($timeout, clSocketSvc) {
		return {
			restrict: 'E',
			scope: true,
			templateUrl: 'extensions/offlineAlert/offlineIndicator.html',
			link: function(scope) {
				var timeoutId = $timeout(function() {
					timeoutId = null;
					setFlag();
				}, 5000);
				function setFlag() {
					scope.show = !clSocketSvc.isReady && !timeoutId;
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
			templateUrl: 'extensions/offlineAlert/offlineAlertPanel.html',
			link: function(scope, element) {
				clDraggablePanel(element, '.offline-alert.panel', 0, 0, -1);
			}
		};
	})
	.directive('clSigninAlertPanel', function(clDraggablePanel) {
		return {
			restrict: 'E',
			templateUrl: 'extensions/offlineAlert/signinAlertPanel.html',
			link: function(scope, element) {
				clDraggablePanel(element, '.signin-alert.panel', 0, 0, -1);
			}
		};
	});
