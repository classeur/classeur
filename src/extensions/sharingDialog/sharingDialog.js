angular.module('classeur.extensions.sharingDialog', [])
	.directive('clSharingDialog', function($mdDialog, clConstants, clUserSvc, clEditorLayoutSvc, clExplorerLayoutSvc, clUrl) {
		return {
			restrict: 'E',
			link: function(scope) {
				function closeDialog() {
					clEditorLayoutSvc.currentControl = undefined;
					clExplorerLayoutSvc.sharingDialogFileDao = undefined;
					clExplorerLayoutSvc.sharingDialogFolderDao = undefined;
				}

				function showDialog(objectDao, sharingUrl, isFile) {
					$mdDialog.show({
						templateUrl: 'extensions/sharingDialog/sharingDialog.html',
						controller: function(scope) {
							scope.isFile = isFile;
							scope.objectDao = objectDao;
						},
						onComplete: function(scope, element) {
							scope.close = function() {
								$mdDialog.hide();
							};

							var inputElt = element[0].querySelector('input.url');

							function select() {
								inputElt.setSelectionRange(0, sharingUrl.length);
							}
							inputElt.addEventListener('focus', select);
							scope.$watch('sharingUrl', function() {
								scope.sharingUrl = sharingUrl;
								setTimeout(select, 100);
							});
						}
					}).then(closeDialog, closeDialog);
				}

				function showFileDialog(fileDao, anchor) {
					var sharingUrl = clConstants.serverUrl + '/#!' + clUrl.file(fileDao, clUserSvc.user);
					if (anchor) {
						sharingUrl += '#' + anchor;
					}
					showDialog(fileDao, sharingUrl, true);
				}

				function showFolderDialog(folderDao) {
					var sharingUrl = clConstants.serverUrl + '/#!' + clUrl.folder(folderDao, clUserSvc.user);
					showDialog(folderDao, sharingUrl);
				}

				scope.$watch('editorLayoutSvc.currentControl', function(currentControl) {
					var split = (currentControl || '').split('#');
					split[0] === 'sharingDialog' && showFileDialog(scope.currentFileDao, split[1]);
				});
				scope.$watch('explorerLayoutSvc.sharingDialogFileDao', function(fileDao) {
					fileDao && showFileDialog(fileDao);
				});
				scope.$watch('explorerLayoutSvc.sharingDialogFolderDao', function(folderDao) {
					folderDao && showFolderDialog(folderDao);
				});
			}
		};
	});
