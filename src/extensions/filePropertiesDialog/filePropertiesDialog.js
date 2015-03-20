angular.module('classeur.extensions.filePropertiesDialog', [])
	.directive('clFilePropertiesDialog', function($mdDialog, clToast) {
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
							scope.deleteRow = function(propertyToDelete) {
								scope.properties = scope.properties.filter(function(property) {
									return property !== propertyToDelete;
								});
							};
							scope.addRow = function() {
								scope.properties.push({});
							};
							scope.ok = function() {
								var properties = {};
								if(scope.properties.some(function(property) {
									if(!property.key && !property.value) {
										return;
									}
									if(!property.key) {
										clToast('Property can\'t be empty.');
										return true;
									}
									if(!property.value) {
										clToast('Property can\'t be empty.');
										return true;
									}
									if(properties.hasOwnProperty(property.key)) {
										clToast('Duplicate property: ' + property.key + '.');
										return true;
									}
									properties[property.key] = property.value;
								})) {
									return;
								}
								fileDao.contentDao.properties = properties;
								$mdDialog.hide();
							};
							scope.cancel = function() {
								$mdDialog.cancel();
							};
						},
					}).then(function() {});
				});
			}
		};
	});
