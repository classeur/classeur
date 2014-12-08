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

		var converterOptions;
		if(options.intraword === true) {
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

		var onPreviewRefreshed;

		if(options.highlighter == "highlight") {
			onPreviewRefreshed = function() {
				Array.prototype.forEach.call(document.querySelectorAll('.prettyprint > code'), function(elt) {
					!elt.highlighted && window.hljs.highlightBlock(elt);
					elt.highlighted = true;
				});
			};
		}
		else if(options.highlighter == "prettify") {
			onPreviewRefreshed = window.prettify.prettyPrint;
		}

		return {
			restrict: 'A',
			link: function(scope) {
				scope.$watch('cledit.converter', function(converter) {
					if(!converter) {
						return;
					}

					converterOptions && converter.setOptions(converterOptions);
					onPreviewRefreshed && scope.$watch('cledit.lastPreview', onPreviewRefreshed);
					settings.values.markdownExtra && window.Markdown.Extra.init(converter, {
						extensions: options.extensions,
						highlighter: 'prettify'
					});
				});

				scope.$watch('settings.values.markdownExtra', function() {
					cledit.converter = new window.Markdown.Converter();
				});
			}
		};
	});
