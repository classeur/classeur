angular.module('classeur.extensions.emoji', [])
	.directive('clEmoji',
		function($window, clEditorSvc) {
			var options, twemojiScript, twemoji;

			function initTwemoji() {
				twemojiScript = document.createElement('script');
				twemojiScript.src = 'https://twemoji.maxcdn.com/twemoji.min.js';
				twemojiScript.onload = function() {
					twemoji = $window.twemoji;
					options && clEditorSvc.previewElt.querySelectorAll('.cl-preview-section').cl_each(function(elt) {
						twemoji.parse(elt);
					});
				};
				twemojiScript.onerror = function() {
					twemojiScript = undefined;
				};
				document.head.appendChild(twemojiScript);
			}

			clEditorSvc.onMarkdownInit(1, function(markdown) {
				if (options) {
					var emojiOptions = {};
					if(!options.shortcuts) {
						emojiOptions.shortcuts = {};
					}
					markdown.use($window.markdownitEmoji, emojiOptions);
					!twemojiScript && initTwemoji();
					clEditorSvc.onAsyncPreview(function(cb) {
						twemoji && clEditorSvc.previewElt.querySelectorAll('.cl-preview-section.modified').cl_each(function(elt) {
							twemoji.parse(elt);
						});
						cb();
					});
				}
			});

			return {
				restrict: 'A',
				link: link
			};

			function link(scope) {
				function checkEnabled() {
					var fileProperties = scope.currentFileDao.contentDao.properties;
					var newOptions = fileProperties['ext:emoji'] === 'true' ? {
						shortcuts: fileProperties['ext:emoji:shortcuts'] !== 'false'
					} : undefined;
					if (JSON.stringify(newOptions) !== JSON.stringify(options)) {
						options = newOptions;
						return true;
					}
				}

				checkEnabled();
				scope.$watch('currentFileDao.contentDao.properties', function(properties) {
					if (properties && checkEnabled()) {
						clEditorSvc.initConverter();
					}
				});
			}
		});
