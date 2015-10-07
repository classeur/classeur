angular.module('classeur.core.settings', [])
	.factory('clSettingSvc',
		function($templateCache, clLocalStorageObject) {
			var defaultSettings = $templateCache.get('core/settings/defaultSettings.json');

			var defaultTemplatePaths = {
				'Plain text': 'core/settings/exportTemplatePlainText.html',
				'HTML': 'core/settings/exportTemplateHtml.html',
				'Styled HTML': 'core/settings/exportTemplateStyledHtml.html',
			};
			var defaultPdfTemplatePaths = {
				'PDF': 'core/settings/exportTemplatePdf.html',
			};
			defaultSettings = JSON.parse(defaultSettings);
			defaultTemplatePaths.cl_each(function(path, key) {
				defaultSettings.exportTemplates[key] = $templateCache.get(path);
			});
			defaultPdfTemplatePaths.cl_each(function(path, key) {
				defaultSettings.exportPdfTemplates[key] = $templateCache.get(path);
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

			function sanitizeExportPdfTemplates(exportPdfTemplates) {
				// Add default templates if not present
				exportPdfTemplates = exportPdfTemplates || {};
				return Object.keys(exportPdfTemplates).concat(Object.keys(defaultPdfTemplatePaths)).sort().cl_reduce(function(result, key) {
					result[key] = exportPdfTemplates.hasOwnProperty(key) ? exportPdfTemplates[key] : clSettingSvc.defaultValues.exportPdfTemplates[key];
					return result;
				}, {});
			}

			function updateSettings(values) {
				values.exportTemplates = sanitizeExportTemplates(values.exportTemplates);
				values.exportPdfTemplates = sanitizeExportPdfTemplates(values.exportPdfTemplates);
				clSettingSvc.values = ({}).cl_extend(JSON.parse(defaultSettings)).cl_extend(values);
			}

			clSettingSvc.defaultValues = JSON.parse(defaultSettings);
			clSettingSvc.checkAll = checkAll;
			clSettingSvc.updateSettings = updateSettings;
			clSettingSvc.sanitizeExportTemplates = sanitizeExportTemplates;
			clSettingSvc.sanitizeExportPdfTemplates = sanitizeExportPdfTemplates;

			clSettingSvc.read();
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
			clLocalSettingSvc.values = ({}).cl_extend(JSON.parse(defaultLocalSettings)).cl_extend(clLocalSettingSvc.values);
			return clLocalSettingSvc;
		});
