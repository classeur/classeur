angular.module('classeur.core.settings', [])
	.factory('settings', function() {
		var values = {};
		return {
			values: values,
			setDefaultValue: function(property, value) {
				if(!values.hasOwnProperty(property)) {
					values[property] = value;
				}
			},
		};
	});
