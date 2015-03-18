angular.module('classeur.extensions.sharingDialog', [])
	.directive('clSharingDialog', function($mdDialog, clConstants, clUserSvc, clEditorLayoutSvc, clExplorerLayoutSvc, clUrl, clFolderSvc) {
		return {
			restrict: 'E',
			link: function(scope) {

				function showDialog(objectDao, sharingUrl, isFile, folderDao) {
					function closeDialog() {
						if (!isFile || !folderDao || folderDao.sharing < objectDao.effectiveSharing) {
							objectDao.sharing = objectDao.effectiveSharing;
						} else {
							objectDao.sharing = '';
						}
						clEditorLayoutSvc.currentControl = undefined;
						clExplorerLayoutSvc.sharingDialogFileDao = undefined;
						clExplorerLayoutSvc.sharingDialogFolderDao = undefined;
					}
					$mdDialog.show({
						templateUrl: 'extensions/sharingDialog/sharingDialog.html',
						controller: function(scope) {
							scope.isFile = isFile;
							scope.objectDao = objectDao;
							scope.folderDao = folderDao;
						},
						onComplete: function(scope, element) {
							scope.openFolder = function() {
								$mdDialog.hide();
							};
							scope.close = function() {
								$mdDialog.cancel();
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
					}).then(function() {
						closeDialog();
						if (folderDao) {
							showFolderDialog(folderDao);
						}
					}, closeDialog);
				}

				function showFileDialog(fileDao, anchor) {
					fileDao.effectiveSharing = fileDao.sharing;
					var folderDao = clFolderSvc.folderMap[fileDao.folderId];
					if (folderDao && folderDao.sharing > fileDao.sharing) {
						fileDao.effectiveSharing = folderDao.sharing;
					}
					var sharingUrl = clConstants.serverUrl + '/#!' + clUrl.file(fileDao, clUserSvc.user);
					if (anchor) {
						sharingUrl += '#' + anchor;
					}
					showDialog(fileDao, sharingUrl, true, folderDao);
				}

				function showFolderDialog(folderDao) {
					folderDao.effectiveSharing = folderDao.sharing;
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
