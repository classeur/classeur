angular.module('classeur.extensions.sharingDialog', [])
	.directive('clSharingDialog', function($mdDialog, clConstants, clUserSvc, clEditorLayoutSvc, clExplorerLayoutSvc, clUrl) {
		return {
			restrict: 'E',
			link: function(scope) {
				function closeDialog() {
					clEditorLayoutSvc.currentControl = undefined;
					clExplorerLayoutSvc.sharingDialogFileDao = undefined;
				}

				function showDialog(fileDao, anchor) {
					var sharingUrl = clConstants.serverUrl + '/#!' + clUrl.file(fileDao, clUserSvc.user);
					if (anchor) {
						sharingUrl += '#' + anchor;
					}
					$mdDialog.show({
						templateUrl: 'extensions/sharingDialog/sharingDialog.html',
						controller: function(scope) {
							scope.fileDao = fileDao;
							scope.close = function() {
								$mdDialog.hide();
							};
						},
						onComplete: function(scope, element) {
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
				scope.$watch('editorLayoutSvc.currentControl', function(currentControl) {
					var split = (currentControl || '').split('#');
					split[0] === 'sharingDialog' && showDialog(scope.currentFileDao, split[1]);
				});
				scope.$watch('explorerLayoutSvc.sharingDialogFileDao', function(fileDao) {
					fileDao && showDialog(fileDao);
				});
			}
		};
	});
