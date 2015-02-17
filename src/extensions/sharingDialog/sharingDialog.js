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
					var sharingUrl = clConstants.serverUrl + '/#!/' + clUserSvc.user.id + '/' + fileDao.id;
					$mdDialog.show({
						templateUrl: 'extensions/sharingDialog/sharingDialog.html',
						onComplete: function(scope) {
							scope.filename = fileDao.name;
							scope.sharingUrl = sharingUrl;
							scope.sharing = fileDao.sharing;
							scope.ok = function() {
								$mdDialog.hide(scope.sharing);
							};
							scope.cancel = function() {
								$mdDialog.cancel();
							};
						}
					}).then(function(sharing) {
						fileDao.sharing = sharing;
						closeDialog();
					}, closeDialog);
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
