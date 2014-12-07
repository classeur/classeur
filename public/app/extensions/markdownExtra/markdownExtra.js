angular.module('classeur.extensions.markdownExtra', [])
	.directive('clMarkdownExtra', function(cledit, settings) {
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
		return {
			restrict: 'A',
			link: function(scope, element) {
				scope.$watch('cledit.converter', function(converter) {
					if(!converter) {
						return;
					}

					if(options.intraword === true) {
						var converterOptions = {
							_DoItalicsAndBold: function(text) {
								text = text.replace(/([^\w*]|^)(\*\*|__)(?=\S)(.+?[*_]*)(?=\S)\2(?=[^\w*]|$)/g, "$1<strong>$3</strong>");
								text = text.replace(/([^\w*]|^)(\*|_)(?=\S)(.+?)(?=\S)\2(?=[^\w*]|$)/g, "$1<em>$3</em>");
								// Redo bold to handle _**word**_
								text = text.replace(/([^\w*]|^)(\*\*|__)(?=\S)(.+?[*_]*)(?=\S)\2(?=[^\w*]|$)/g, "$1<strong>$3</strong>");
								return text;
							}
						};
						converter.setOptions(converterOptions);
					}

					var onPreviewRefreshed;

					if(options.highlighter == "highlight") {
						onPreviewRefreshed = function() {
							Array.prototype.forEach.call(element[0].querySelectorAll('.prettyprint > code'), function(elt) {
								!elt.highlighted && hljs.highlightBlock(elt);
								elt.highlighted = true;
							});
						};
					}
					else if(options.highlighter == "prettify") {
						onPreviewRefreshed = window.prettify.prettyPrint;
					}

					onPreviewRefreshed && scope.$watch('cledit.lastPreview', onPreviewRefreshed);

					window.Markdown.Extra.init(converter, options);
				});
			}
		};
	});
