angular.module('classeur.opt.exportToDisk', [])
	.directive('clExportToDisk', function($window, clDialog, clToast, clEditorLayoutSvc, clSocketSvc, clEditorSvc, clSettingSvc, clTemplateManagerDialog) {
		function saveAs(byteString, name, type) {
			var buffer = new ArrayBuffer(byteString.length);
			var view = new Uint8Array(buffer);
			for (var i = 0; i < byteString.length; i++) {
				view[i] = byteString.charCodeAt(i);
			}
			var blob = new Blob([view], {
				type: type
			});
			$window.saveAs(blob, name);
		}

		clSocketSvc.addMsgHandler('pdf', function(msg) {
			saveAs(atob(msg.pdf), msg.name, 'application/pdf');
		});

		var config = {
			format: 'text',
			formattedTemplateKey: 'Styled HTML',
			pdfTemplateKey: 'PDF',
		};

		return {
			restrict: 'E',
			link: function(scope) {
				function showDialog() {
					function closeDialog() {
						clEditorLayoutSvc.currentControl = undefined;
					}
					var formattedPreview;
					clDialog.show({
						templateUrl: 'opt/exportToDisk/exportToDisk.html',
						controller: ['$scope', function(scope) {
							scope.templates = clSettingSvc.values.exportTemplates;
							scope.config = config;
							scope.export = function() {
								clDialog.hide();
							};
							scope.cancel = function() {
								clDialog.cancel();
							};
							scope.manageTemplates = function() {
								clTemplateManagerDialog(clSettingSvc.values.exportTemplates)
									.then(function(templates) {
										clSettingSvc.values.exportTemplates = templates;
									});
							};
						}],
						onComplete: function(scope, element) {
							var textareaElt = element[0].querySelector('textarea');
							function select() {
								setTimeout(function() {
									textareaElt.select();
								}, 100);
							}
							textareaElt.addEventListener('focus', select);
							textareaElt.addEventListener('click', select);
							textareaElt.addEventListener('keyup', select);
							scope.$watch('config.formattedTemplateKey', function(templateKey) {
								formattedPreview = clEditorSvc.applyTemplate(scope.templates[templateKey]);
								scope.formattedPreview = formattedPreview;
							});
							scope.$watch('formattedPreview', function() {
								scope.formattedPreview = formattedPreview;
							});
						}
					}).then(function() {
						closeDialog();
						if (config.format === 'text') {
							saveAs(scope.currentFileDao.contentDao.text, scope.currentFileDao.name, 'text/plain');
						} else if (config.format === 'formatted') {
							saveAs(clEditorSvc.applyTemplate(clSettingSvc.values.exportTemplates[config.formattedTemplateKey]), scope.currentFileDao.name, 'text/html');
						} else if (config.format === 'pdf') {
							var html = clEditorSvc.applyTemplate(clSettingSvc.values.exportTemplates[config.pdfTemplateKey]);
							clToast('PDF is being prepared...');
							clSocketSvc.sendMsg({
								type: 'toPdf',
								name: scope.currentFileDao.name,
								html: html
							});
						}
					}, closeDialog);
				}

				scope.$watch('editorLayoutSvc.currentControl === "exportToDisk"', function(value) {
					value && showDialog();
				});
			}
		};
	});
