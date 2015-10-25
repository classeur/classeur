angular.module('classeur.core.templateManagerDialog', [])
	.factory('clTemplateManagerDialog',
		function($window, clDialog, clSettingSvc, clToast) {
			function openDialog(templates, canBeRemoved) {
				clDialog.cancel();
				return clDialog.show({
					templateUrl: 'core/templateManagerDialog/templateManagerDialog.html',
					onComplete: function(scope, element) {
						scope.templates = templates;
						var preElt = element[0].querySelector('pre.prism');
						var cledit = $window.cledit(preElt);
						cledit.init({
							highlighter: function(text) {
								return $window.Prism.highlight(text, $window.Prism.languages.markup);
							}
						});
						var lastSelectedKey;
						scope.$watch('selectedKey', function(selectedKey) {
							scope.canBeRemoved = selectedKey && canBeRemoved(selectedKey);
							if (lastSelectedKey !== selectedKey) {
								lastSelectedKey = selectedKey;
								scope.templateKey = selectedKey;
								cledit.setContent(templates[selectedKey] || '');
							}
						});
						scope.$watch('templateKey', function(templateKey) {
							if (lastSelectedKey !== templateKey) {
								scope.selectedKey = templates.hasOwnProperty(templateKey) ? templateKey : undefined;
								lastSelectedKey = scope.selectedKey;
							}
						});
						scope.remove = function() {
							delete templates[scope.templateKey];
							scope.templateKey = undefined;
							scope.selectedKey = undefined;
							cledit.setContent('');
						};
						scope.add = function() {
							var templateValue = cledit.getContent();
							if (!scope.templateKey) {
								return clToast('Please specify a name.');
							}
							if (!templateValue) {
								return clToast('Please specify a template.');
							}
							templates[scope.templateKey] = templateValue;
							scope.selectedKey = scope.templateKey;
						};
						scope.ok = function() {
							scope.add();
							clDialog.hide(templates);
						};
						scope.cancel = function() {
							clDialog.cancel();
						};
					}
				});
			}

			return function(templates) {
				templates = clSettingSvc.sanitizeExportTemplates(templates);
				return openDialog(templates, function(selectedKey) {
						return !clSettingSvc.defaultValues.exportTemplates.hasOwnProperty(selectedKey);
					})
					.then(function(templates) {
						return clSettingSvc.sanitizeExportTemplates(templates);
					});
			};
		});
