angular.module('classeur.optional.offlineAlert', [])
	.directive('clOfflineIndicator',
		function($timeout, clSocketSvc) {
			return {
				restrict: 'E',
				scope: true,
				templateUrl: 'optional/offlineAlert/offlineIndicator.html',
				link: link
			};

			function link(scope) {
				var timeoutId = $timeout(function() {
					timeoutId = null;
					setFlag();
				}, 3000);

				function setFlag() {
					scope.show = !clSocketSvc.hasToken || (!clSocketSvc.isReady && !timeoutId);
				}
				scope.$watch('socketSvc.isReady', setFlag);
			}
		})
	.directive('clOfflineAlert',
		function() {
			return {
				restrict: 'E',
				template: '<cl-offline-alert-panel ng-if="editorLayoutSvc.currentControl === \'offlineAlert\'"></cl-offline-alert-panel><cl-signin-alert-panel ng-if="editorLayoutSvc.currentControl === \'signinAlert\'"></cl-signin-alert-panel>',
			};
		})
	.directive('clOfflineAlertPanel',
		function(clDraggablePanel) {
			return {
				restrict: 'E',
				templateUrl: 'optional/offlineAlert/offlineAlertPanel.html',
				link: link
			};

			function link(scope, element) {
				clDraggablePanel(element, '.offline-alert.panel', 0, 0, -1);
			}
		})
	.directive('clSigninAlertPanel', function(clDraggablePanel) {
		return {
			restrict: 'E',
			templateUrl: 'optional/offlineAlert/signinAlertPanel.html',
			link: link
		};

		function link(scope, element) {
			clDraggablePanel(element, '.signin-alert.panel', 0, 0, -1);
		}
	});
