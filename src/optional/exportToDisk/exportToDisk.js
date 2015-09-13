angular.module('classeur.optional.exportToDisk', [])
	.directive('clExportToDisk',
		function($window, clDialog, clToast, clUserSvc, clEditorLayoutSvc, clSocketSvc, clEditorSvc, clSettingSvc, clTemplateManagerDialog) {
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
				textTemplateKey: 'Plain text',
				pdfTemplateKey: 'PDF',
			};

			return {
				restrict: 'E',
				link: link
			};

			function link(scope) {
				function showDialog() {
					function closeDialog() {
						clEditorLayoutSvc.currentControl = undefined;
					}
					var textPreview;
					clDialog.show({
						templateUrl: 'optional/exportToDisk/exportToDisk.html',
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
							scope.$watch('config.textTemplateKey', function(templateKey) {
								textPreview = clEditorSvc.applyTemplate(scope.templates[templateKey]);
								scope.textPreview = textPreview;
							});
							scope.$watch('textPreview', function() {
								scope.textPreview = textPreview;
							});
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
						}
					}).then(function() {
						closeDialog();
						if (config.format === 'text') {
							var template = clSettingSvc.values.exportTemplates[config.textTemplateKey];
							var mimeType = template.indexOf('file.content.html') === -1 ? 'text/plain' : 'text/html';
							saveAs(clEditorSvc.applyTemplate(template), scope.currentFileDao.name, mimeType);
						} else if (config.format === 'pdf') {
							var html = clEditorSvc.applyTemplate(clSettingSvc.values.exportTemplates[config.pdfTemplateKey]);
							if (!clUserSvc.user || (clUserSvc.user.roles.indexOf('premium_user') === -1 && html.length > 10000)) {
								return clDialog.show({
									templateUrl: 'optional/exportToDisk/premiumPdfDialog.html',
									controller: ['$scope', function(scope) {
										scope.userSvc = clUserSvc;
										scope.cancel = function() {
											clDialog.cancel();
										};
									}]
								});
							}
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
		});
