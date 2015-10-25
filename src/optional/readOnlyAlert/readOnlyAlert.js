angular.module('classeur.optional.readOnlyAlert', [])
	.directive('clReadOnlyAlert',
		function(clEditorLayoutSvc, clSyncSvc, clUserSvc, clSocketSvc, clEditorSvc) {
			return {
				restrict: 'E',
				scope: true,
				template: '<cl-read-only-alert-panel ng-if="editorLayoutSvc.currentControl === \'readOnlyAlert\'"></cl-read-only-alert-panel><cl-write-premium-alert-panel ng-if="editorLayoutSvc.currentControl === \'writePremiumAlert\'"></cl-write-premium-alert-panel>',
				link: link
			};

			function link(scope) {
				var wasDismissed;

				scope.dismiss = function() {
					wasDismissed = true;
					clEditorLayoutSvc.currentControl = undefined;
				};

				var text;
				if (scope.currentFileDao.isReadOnly || scope.currentFileDao.userId) {
					scope.$watch('currentFileDao.contentDao.text', function(newtext) {
						if (text === undefined || !scope.currentFileDao) {
							text = newtext;
							return;
						}
						if (wasDismissed) {
							return;
						}
						if (clEditorSvc.lastContentChange - clEditorSvc.lastExternalChange < 1500) {
							return;
						}
						if (scope.currentFileDao.isReadOnly || scope.currentFileDao.sharing !== 'rw') {
							clEditorLayoutSvc.currentControl = 'readOnlyAlert';
							return;
						}
						if (!clSocketSvc.hasToken || !clUserSvc.isUserPremium()) {
							clEditorLayoutSvc.currentControl = 'writePremiumAlert';
							return;
						}
					});
				}
			}
		})
	.directive('clReadOnlyAlertPanel',
		function() {
			return {
				restrict: 'E',
				templateUrl: 'optional/readOnlyAlert/readOnlyAlertPanel.html',
			};
		})
	.directive('clWritePremiumAlertPanel',
		function() {
			return {
				restrict: 'E',
				templateUrl: 'optional/readOnlyAlert/writePremiumAlertPanel.html',
			};
		});
