angular.module('classeur.core.filePropertiesDialog', [])
	.factory('clFilePropertiesDialog',
		function(clDialog, clToast) {
			return function(properties) {
				properties = properties || {};
				properties = Object.keys(properties).sort().cl_map(function(key) {
					return {
						key: key,
						value: properties[key]
					};
				});
				return clDialog.show({
					templateUrl: 'core/filePropertiesDialog/filePropertiesDialog.html',
					controller: ['$scope', function(scope) {
						scope.properties = properties;
						scope.deleteRow = function(propertyToDelete) {
							scope.properties = scope.properties.cl_filter(function(property) {
								return property !== propertyToDelete;
							});
						};
						scope.addRow = function() {
							scope.properties.push({});
						};
						scope.addRow();
						scope.ok = function() {
							var properties = {};
							if(Object.keys(scope.properties).length > 100) {
								return clToast('Too many properties.');
							}
							if (
								scope.properties.cl_some(function(property) {
									if (!property.key && !property.value) {
										return;
									}
									if (!property.key) {
										clToast('Property can\'t be empty.');
										return true;
									}
									if(property.key.length > 100) {
										clToast('Property key is too long.');
										return true;
									}
									if (!property.value) {
										clToast('Property can\'t be empty.');
										return true;
									}
									if(property.value.length > 500) {
										clToast('Property value is too long.');
										return true;
									}
									if (properties.hasOwnProperty(property.key)) {
										clToast('Duplicate property: ' + property.key + '.');
										return true;
									}
									properties[property.key] = property.value;
								})
							) {
								return;
							}
							clDialog.hide(properties);
						};
						scope.cancel = function() {
							clDialog.cancel();
						};
					}],
				});
			};
		});
