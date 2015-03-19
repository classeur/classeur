angular.module('classeur.extensions.filePropertiesDialog', [])
	.directive('clFilePropertiesDialog', function($mdDialog) {
		return {
			restrict: 'E',
			link: function(scope) {
				var fileDao = scope.currentFileDao;

				scope.$watch('editorLayoutSvc.currentControl === "filePropertiesDialog"', function(show) {
					if (!show) {
						return;
					}
					$mdDialog.show({
						templateUrl: 'extensions/filePropertiesDialog/filePropertiesDialog.html',
						controller: function(scope) {
							var properties = fileDao.contentDao.properties || {};
							scope.properties = Object.keys(properties).map(function(key) {
								return {
									key: key,
									value: properties[key]
								};
							});
						},
					}).then(function() {
					});
				});
			}
		};
	});
