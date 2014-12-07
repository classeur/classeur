angular.module('classeur.core.settings', [])
	.factory('settings', function() {
		var values = {
			zoom: 3
		};
		return {
			values: values,
			setDefaultValue: function(property, value) {
				if(!values.hasOwnProperty(property)) {
					values[property] = value;
				}
			},
		};
	});
