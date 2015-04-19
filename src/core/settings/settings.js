angular.module('classeur.core.settings', [])
	.factory('clSettingSvc', function($templateCache, clLocalStorageObject) {
		var defaultSettings = $templateCache.get('core/settings/defaultSettings.json');
		var defaultLocalSettings = $templateCache.get('core/settings/defaultLocalSettings.json');

		var settings = clLocalStorageObject('settings', {
			values: {
				default: defaultSettings,
				parser: clLocalStorageObject.simpleObjectParser,
				serializer: clLocalStorageObject.simpleObjectSerializer,
			}
		});
		var localSettings = clLocalStorageObject('localSettings', {
			values: {
				default: defaultLocalSettings,
				parser: clLocalStorageObject.simpleObjectParser,
				serializer: clLocalStorageObject.simpleObjectSerializer,
			}
		});

		settings.read = localSettings.read = function() {
			this.$read();
			this.$readUpdate();
		};

		settings.write = localSettings.write = function(updated) {
			this.$write();
			updated && this.$writeUpdate(updated);
		};

		function checkAll() {
			var hasChanged = false;
			if (settings.$checkUpdate()) {
				settings.read();
				hasChanged = true;
			} else {
				settings.write();
			}
			if (localSettings.$checkUpdate()) {
				localSettings.read();
				hasChanged = true;
			} else {
				localSettings.write();
			}
			return hasChanged;
		}

		function updateSettings(settings) {
            clSettingSvc.settings.values = settings;
		}

		function setDefaultSettings() {
            clSettingSvc.settings.values = JSON.parse(defaultSettings);
            clSettingSvc.localSettings.values = JSON.parse(defaultLocalSettings);
		}

		var clSettingSvc = {};
		clSettingSvc.settings = settings;
		clSettingSvc.localSettings = localSettings;
		clSettingSvc.checkAll = checkAll;
		clSettingSvc.updateSettings = updateSettings;
		clSettingSvc.setDefaultSettings = setDefaultSettings;

		settings.read();
		localSettings.read();
		return clSettingSvc;
	});
