angular.module('classeur.opt.sharingDialog', [])
	.directive('clSharingDialog', function(clDialog, clConfig, clUserSvc, clEditorLayoutSvc, clExplorerLayoutSvc, clUrl, clFolderSvc) {
		return {
			restrict: 'E',
			link: function(scope) {

				function showDialog(objectDao, sharingUrl, isFile, folderDao) {
					function closeDialog() {
						clEditorLayoutSvc.currentControl = undefined;
						clExplorerLayoutSvc.sharingDialogFileDao = undefined;
						clExplorerLayoutSvc.sharingDialogFolderDao = undefined;
					}
					clDialog.show({
						templateUrl: 'opt/sharingDialog/sharingDialog.html',
						controller: function(scope) {
							scope.isFile = isFile;
							scope.objectDao = objectDao;
							scope.folderDao = folderDao;
						},
						onComplete: function(scope, element) {
							scope.openFolder = function() {
								clDialog.hide();
							};
							scope.close = function() {
								clDialog.cancel();
							};

							var inputElt = element[0].querySelector('input.url');

							function select() {
								inputElt.setSelectionRange(0, sharingUrl.length);
							}
							inputElt.addEventListener('focus', select);
							scope.$watch('objectDao.effectiveSharing', function() {
								if (!objectDao.isPublic) {
									if (!isFile || !folderDao || folderDao.sharing < objectDao.effectiveSharing) {
										objectDao.sharing = objectDao.effectiveSharing;
									} else {
										objectDao.sharing = '';
									}
								}
							});
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
					var folderDao = clFolderSvc.folderMap[fileDao.folderId];
					fileDao.effectiveSharing = fileDao.sharing;
					if (folderDao && folderDao.sharing > fileDao.sharing) {
						fileDao.effectiveSharing = folderDao.sharing;
					}
					var sharingUrl = clConfig.appUri + '/#!' + clUrl.file(fileDao, clUserSvc.user);
					if (anchor) {
						sharingUrl += '#' + anchor;
					}
					showDialog(fileDao, sharingUrl, true, folderDao);
				}

				function showFolderDialog(folderDao) {
					folderDao.effectiveSharing = folderDao.sharing;
					var sharingUrl = clConfig.appUri + '/#!' + clUrl.folder(folderDao, clUserSvc.user);
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
