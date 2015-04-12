angular.module('classeur.core.settings', [])
	.factory('clSettingSvc', function($templateCache, clLocalStorageObject) {
		var clSettingSvc = clLocalStorageObject('settingsSvc');
		var defaultLocalSettings = $templateCache.get('core/settings/defaultLocalSettings.json');

		function serializer(data) {
			var result = {};
			// Sort object keys
			Object.keys(data).sort().forEach(function(key) {
				result[key] = data[key];
			});
			return JSON.stringify(result);
		}

		clSettingSvc.read = function() {
			this.$readAttr('settings', '{}', JSON.parse);
			this.$readAttr('localSettings', defaultLocalSettings, JSON.parse);
			this.$readUpdate();
		};

		clSettingSvc.write = function(updated) {
			this.$writeAttr('settings', serializer, updated);
			this.$writeAttr('localSettings', serializer, updated);
		};

		clSettingSvc.read();
		return clSettingSvc;
	});
