angular.module('classeur.optional.exportToDisk', [])
	.directive('clExportToDisk',
		function($window, clDialog, clToast, clUserSvc, clEditorLayoutSvc, clSocketSvc, clEditorSvc, clSettingSvc, clTemplateManagerDialog) {
			var mimeTypes = {
				asciidoc: 'text/plain',
				epub: 'application/epub+zip',
				epub3: 'application/epub+zip',
				html: 'text/html',
				latex: 'application/x-latex',
				odt: 'application/vnd.oasis.opendocument.text',
				pdf: 'application/pdf',
				rst: 'text/plain',
				rtf: 'application/rtf',
				textile: 'text/plain',
				txt: 'text/plain',
				md: 'text/plain',
				docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
			};

			function saveAs(byteString, name, format) {
				var mimeType = mimeTypes[format];
				var buffer = new ArrayBuffer(byteString.length);
				var view = new Uint8Array(buffer);
				for (var i = 0; i < byteString.length; i++) {
					view[i] = byteString.charCodeAt(i);
				}
				var blob = new Blob([view], {
					type: mimeType
				});
				var extension = '.' + format;
				if (name.slice(-extension.length) !== extension) {
					name += extension;
				}
				$window.saveAs(blob, name);
			}

			clSocketSvc.addMsgHandler('document', function(msg) {
				if (msg.error) {
					return clToast(msg.error.slice(0, 100));
				}
				saveAs(atob(msg.content), msg.name, msg.format);
			});

			var config = {
				format: 'text',
				textTemplateKey: 'Plain text',
				documentFormatKey: 'pdf',
			};

			return {
				restrict: 'E',
				link: link
			};

			function link(scope) {
				function closeDialog() {
					clEditorLayoutSvc.currentControl = undefined;
				}

				function openDialog() {
					if (clEditorLayoutSvc.currentControl !== 'exportToDisk') {
						clEditorLayoutSvc.currentControl = 'exportToDisk';
						return;
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
										openDialog();
									}, openDialog);
							};
							scope.$watch('config.textTemplateKey', function(templateKey) {
								clEditorSvc.applyTemplate(scope.templates[templateKey])
									.then(function(preview) {
										textPreview = preview;
										scope.textPreview = textPreview;
									});
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
							var format = template.indexOf('file.content.html') === -1 ? 'txt' : 'html';
							clEditorSvc.applyTemplate(template)
								.then(function(text) {
									saveAs(text, scope.currentFileDao.name, format);
								});
						} else if (config.format === 'document') {
							var contentDao = scope.currentFileDao.contentDao;
							if (!clUserSvc.user || (!clUserSvc.isUserPremium() && contentDao.text.length > 5000)) {
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
							clToast('Document is being prepared...');
							var fileProperties = contentDao.properties;
							var options = {
								abbr: fileProperties['ext:markdown:abbr'] !== 'false',
								breaks: fileProperties['ext:markdown:breaks'] !== 'false',
								deflist: fileProperties['ext:markdown:deflist'] !== 'false',
								del: fileProperties['ext:markdown:del'] !== 'false',
								fence: fileProperties['ext:markdown:fence'] !== 'false',
								footnote: fileProperties['ext:markdown:footnote'] !== 'false',
								linkify: fileProperties['ext:markdown:linkify'] !== 'false',
								sub: fileProperties['ext:markdown:sub'] !== 'false',
								sup: fileProperties['ext:markdown:sup'] !== 'false',
								table: fileProperties['ext:markdown:table'] !== 'false',
								typographer: fileProperties['ext:markdown:typographer'] !== 'false',
								math: fileProperties['ext:mathjax'] !== 'false',
							};
							var extensions = {
								fenced_code_blocks: options.fence,
								backtick_code_blocks: options.fence,
								fenced_code_attributes: options.fence,
								definition_lists: options.deflist,
								pipe_tables: options.table,
								strikeout: options.del,
								superscript: options.sup,
								subscript: options.sub,
								tex_math_dollars: options.math,
								tex_math_double_backslash: options.math,
								footnotes: options.footnote,
								inline_notes: options.footnote,
								hard_line_breaks: options.breaks,
								autolink_bare_uris: options.linkify,
								abbreviations: options.abbr,
							};
							clSocketSvc.sendMsg({
								type: 'toDocument',
								name: scope.currentFileDao.name,
								format: config.documentFormatKey,
								extensions: extensions,
								options: {
									highlightStyle: clSettingSvc.values.pandocHighlightStyle,
									toc: clSettingSvc.values.pandocToc,
									tocDepth: clSettingSvc.values.pandocTocDepth,
								},
								metadata: contentDao.properties,
								text: contentDao.text
							});
						}
					}, closeDialog);

				}

				scope.$watch('editorLayoutSvc.currentControl === "exportToDisk"', function(value) {
					value && openDialog();
				});
			}
		});
