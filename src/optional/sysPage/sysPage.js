angular.module('classeur.optional.sysPage', [])
	.config(
		function($routeProvider) {
			$routeProvider
				.when('/sys', {
					template: '<cl-sys-page></cl-sys-page>',
					controller: function(clAnalytics) {
						clAnalytics.trackPage('/sys');
					}
				});
		})
	.directive('clSysPage',
		function(clToast, $http, $location) {
			return {
				restrict: 'E',
				templateUrl: 'optional/sysPage/sysPage.html',
				link: link
			};

			function link(scope) {
				scope.properties = [];
				scope.deleteRow = function(propertyToDelete) {
					scope.properties = scope.properties.cl_filter(function(property) {
						return property !== propertyToDelete;
					});
				};
				scope.addRow = function() {
					scope.properties.push({});
				};
				scope.update = function() {
					var properties = {};
					if (Object.keys(scope.properties).length > 255) {
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
							if (property.key.length > 255) {
								clToast('Property key is too long.');
								return true;
							}
							if (!property.value) {
								clToast('Property can\'t be empty.');
								return true;
							}
							if (property.value.length > 512) {
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
					$http.post('/api/v1/config/app?sysKey=' + encodeURIComponent($location.search().sysKey), properties)
						.success(function() {
							clToast('App config updated.');
						})
						.error(function(err) {
							clToast('Error: ' + err.reason || 'unknown');
						});
				};

				function retrieveConfig() {
					$http.get('/api/v1/config/app?sysKey=' + encodeURIComponent($location.search().sysKey))
						.success(function(res) {
							scope.properties = Object.keys(res).sort().cl_map(function(key) {
								return {
									key: key,
									value: res[key]
								};
							});
						})
						.error(function(err) {
							clToast('Error: ' + err.reason || 'unknown');
						});
				}
				retrieveConfig();
			}
		});
