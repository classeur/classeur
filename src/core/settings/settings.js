angular.module('classeur.core.settings', [])
	.factory('clSettingSvc',
		function($templateCache, clLocalStorageObject) {
			var defaultSettings = $templateCache.get('core/settings/defaultSettings.json');

			var defaultTemplatePaths = {
				'Plain text': 'core/settings/exportTemplatePlainText.html',
				'Plain HTML': 'core/settings/exportTemplatePlainHtml.html',
				'Styled HTML': 'core/settings/exportTemplateStyledHtml.html',
			};
			defaultSettings = JSON.parse(defaultSettings);
			defaultTemplatePaths.cl_each(function(path, key) {
				defaultSettings.exportTemplates[key] = $templateCache.get(path);
			});
			defaultSettings = JSON.stringify(defaultSettings);

			var clSettingSvc = clLocalStorageObject('settings', {
				values: {
					default: defaultSettings,
					parser: clLocalStorageObject.simpleObjectParser,
					serializer: clLocalStorageObject.simpleObjectSerializer,
				}
			});

			clSettingSvc.read = function() {
				this.$read();
				this.$readUpdate();
			};

			clSettingSvc.write = function(updated) {
				this.$write();
				updated && this.$writeUpdate(updated);
			};

			function checkAll() {
				if (clSettingSvc.$checkUpdate()) {
					clSettingSvc.read();
					return true;
				} else {
					clSettingSvc.write();
				}
			}

			function sanitizeExportTemplates(exportTemplates) {
				// Add default templates if not present
				exportTemplates = exportTemplates || {};
				return Object.keys(exportTemplates).concat(Object.keys(defaultTemplatePaths)).sort().cl_reduce(function(result, key) {
					result[key] = exportTemplates.hasOwnProperty(key) ? exportTemplates[key] : clSettingSvc.defaultValues.exportTemplates[key];
					return result;
				}, {});
			}

			function updateSettings(values) {
				values.exportTemplates = sanitizeExportTemplates(values.exportTemplates);
				clSettingSvc.values = JSON.parse(defaultSettings).cl_reduce(function(sanitizedValues, defaultValue, key) {
					if(values.hasOwnProperty(key)) {
						sanitizedValues[key] = values[key];
					} else {
						sanitizedValues[key] = defaultValue;
					}
					return sanitizedValues;
				}, {});
			}

			clSettingSvc.defaultValues = JSON.parse(defaultSettings);
			clSettingSvc.checkAll = checkAll;
			clSettingSvc.updateSettings = updateSettings;
			clSettingSvc.sanitizeExportTemplates = sanitizeExportTemplates;

			clSettingSvc.read();
			// Sanitize in case of app update
			updateSettings(clSettingSvc.values);
			return clSettingSvc;
		})
	.factory('clLocalSettingSvc',
		function($templateCache, clLocalStorageObject) {
			var defaultLocalSettings = $templateCache.get('core/settings/defaultLocalSettings.json');

			var clLocalSettingSvc = clLocalStorageObject('localSettings', {
				values: {
					default: defaultLocalSettings,
					parser: clLocalStorageObject.simpleObjectParser,
					serializer: clLocalStorageObject.simpleObjectSerializer,
				}
			});

			clLocalSettingSvc.read = function() {
				this.$read();
				this.$readUpdate();
			};

			clLocalSettingSvc.write = function(updated) {
				this.$write();
				updated && this.$writeUpdate(updated);
			};

			function checkAll() {
				if (clLocalSettingSvc.$checkUpdate()) {
					clLocalSettingSvc.read();
					return true;
				} else {
					clLocalSettingSvc.write();
				}
			}

			clLocalSettingSvc.checkAll = checkAll;

			clLocalSettingSvc.read();
			// Sanitize in case of app update
			clLocalSettingSvc.values = JSON.parse(defaultLocalSettings).cl_reduce(function(sanitizedValues, defaultValue, key) {
				if(clLocalSettingSvc.values.hasOwnProperty(key)) {
					sanitizedValues[key] = clLocalSettingSvc.values[key];
				} else {
					sanitizedValues[key] = defaultValue;
				}
				return sanitizedValues;
			}, {});
			return clLocalSettingSvc;
		});
