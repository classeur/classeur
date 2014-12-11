angular.module('classeur.extensions.markdownExtra', [])
	.directive('clMarkdownExtraSettings', function() {
		return {
			restrict: 'E',
			templateUrl: 'app/extensions/markdownExtra/markdownExtraSettings.html'
		};
	})
	.directive('clMarkdownExtra', function(cledit, settings) {
		settings.setDefaultValue('markdownExtra', true);

		var options = {
			extensions: [
				"fenced_code_gfm",
				"tables",
				"def_list",
				"attr_list",
				"footnotes",
				"smartypants",
				"strikethrough",
				"newlines"
			],
			intraword: true,
			highlighter: 'highlight'
		};

		cledit.onInitConverter(50, function(converter) {
			var isEnabled = settings.values.markdownExtra;
			function hasExtension(extensionName) {
				return isEnabled && options.extensions.some(function(extension) {
						return extension == extensionName;
					});
			}

			var converterOptions = {};
			if(isEnabled && options.intraword) {
				converterOptions = {
					_DoItalicsAndBold: function(text) {
						text = text.replace(/([^\w*]|^)(\*\*|__)(?=\S)(.+?[*_]*)(?=\S)\2(?=[^\w*]|$)/g, "$1<strong>$3</strong>");
						text = text.replace(/([^\w*]|^)(\*|_)(?=\S)(.+?)(?=\S)\2(?=[^\w*]|$)/g, "$1<em>$3</em>");
						// Redo bold to handle _**word**_
						text = text.replace(/([^\w*]|^)(\*\*|__)(?=\S)(.+?[*_]*)(?=\S)\2(?=[^\w*]|$)/g, "$1<strong>$3</strong>");
						return text;
					}
				};
			}
			converter.setOptions(converterOptions);

			if(isEnabled) {
				window.Markdown.Extra.init(converter, {
					extensions: options.extensions,
					highlighter: 'prettify'
				});

				if(options.highlighter == "highlight") {
					cledit.onAsyncPreview(function(cb) {
						Array.prototype.forEach.call(document.querySelectorAll('.prettyprint > code'), function(elt) {
							!elt.highlighted && window.hljs.highlightBlock(elt);
							elt.highlighted = true;
						});
						cb();
					});
				}
				else if(options.highlighter == "prettify") {
					cledit.onAsyncPreview(function(cb) {
						window.prettify.prettyPrint();
						cb();
					});
				}
			}

			// Set cledit options
			if(hasExtension('fenced_code_gfm')) {
				// Add new fenced code block delimiter with priority 25
				cledit.setSectionDelimiter(25, '^```[^`\\n]*\\n[\\s\\S]*?\\n```|');
			}
			else {
				// Unset fenced code block delimiter
				cledit.setSectionDelimiter(25, undefined);
			}
			cledit.setPrismOptions({
				fcbs: hasExtension('fenced_code_gfm'),
				tables: hasExtension('tables'),
				footnotes: hasExtension('footnotes'),
				strikes: hasExtension('strikethrough')
			});
		});

		return {
			restrict: 'A',
			link: function(scope) {

				scope.$watch('settings.values.markdownExtra', function() {
					cledit.initConverter();
				});
			}
		};
	});
