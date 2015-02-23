angular.module('classeur.extensions.sharingDialog', [])
	.directive('clSharingDialog', function($mdDialog, clConstants, clUserSvc, clEditorLayoutSvc, clExplorerLayoutSvc) {
		return {
			restrict: 'E',
			link: function(scope) {
				function closeDialog() {
					clEditorLayoutSvc.currentControl = undefined;
					clExplorerLayoutSvc.sharingDialogFileDao = undefined;
				}

				function showDialog(fileDao) {
					if(!clUserSvc.user) {
						return closeDialog();
					}
					var sharingUrl = clConstants.serverUrl + '/#!/file/' + clUserSvc.user.id + '/' + fileDao.id;
					$mdDialog.show({
						templateUrl: 'extensions/sharingDialog/sharingDialog.html',
						onComplete: function(scope) {
							scope.fileDao = fileDao;
							scope.sharingUrl = sharingUrl;
							scope.close = function() {
								$mdDialog.hide();
							};
						}
					}).then(closeDialog, closeDialog);
				}
				scope.$watch('editorLayoutSvc.currentControl', function(currentControl) {
					currentControl === 'sharingDialog' && showDialog(scope.currentFileDao);
				});
				scope.$watch('explorerLayoutSvc.sharingDialogFileDao', function(fileDao) {
					fileDao && showDialog(fileDao);
				});
			}
		};
	});
