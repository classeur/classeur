angular.module('classeur.extensions.readOnlyAlert', [])
	.directive('clReadOnlyAlert', function(clEditorLayoutSvc, clSyncSvc, clUserSvc, clEditorSvc) {
		return {
			restrict: 'E',
			scope: true,
			template: '<cl-read-only-alert-panel ng-if="editorLayoutSvc.currentControl === \'readOnlyAlert\'"></cl-read-only-alert-panel><cl-write-premium-alert-panel ng-if="editorLayoutSvc.currentControl === \'writePremiumAlert\'"></cl-write-premium-alert-panel>',
			link: function(scope) {
				var wasDismissed;

				scope.dismiss = function() {
					wasDismissed = true;
					clEditorLayoutSvc.currentControl = undefined;
				};

				var content;
				if (scope.currentFileDao.isReadOnly || scope.currentFileDao.userId) {
					scope.$watch('currentFileDao.contentDao.content', function(newContent) {
						if (content === undefined || !scope.currentFileDao) {
							content = newContent;
							return;
						}
						if (wasDismissed) {
							return;
						}
						if(clEditorSvc.lastContentChange - clEditorSvc.lastExternalChange < 500) {
							return;
						}
						if (scope.currentFileDao.isReadOnly || scope.currentFileDao.sharing !== 'rw') {
							clEditorLayoutSvc.currentControl = 'readOnlyAlert';
							return;
						}
						// if(!clUserSvc.user || clUserSvc.user.plan !== 'premium') {
						if(!clUserSvc.user) {
							clEditorLayoutSvc.currentControl = 'writePremiumAlert';
							return;
						}
					});
				}
			}
		};
	})
	.directive('clReadOnlyAlertPanel', function(clDraggablePanel) {
		return {
			restrict: 'E',
			templateUrl: 'extensions/readOnlyAlert/readOnlyAlertPanel.html',
			link: function(scope, element) {
				clDraggablePanel(element, '.read-only-alert.panel', 0, 0, -1);
			}
		};
	})
	.directive('clWritePremiumAlertPanel', function(clDraggablePanel) {
		return {
			restrict: 'E',
			templateUrl: 'extensions/readOnlyAlert/writePremiumAlertPanel.html',
			link: function(scope, element) {
				clDraggablePanel(element, '.write-premium-alert.panel', 0, 0, -1);
			}
		};
	});
