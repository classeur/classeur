angular.module('classeur.extensions.emoji', [])
	.directive('clEmoji',
		function($window, clEditorSvc) {
			var options, twemojiScript, twemoji;

			function initTwemoji() {
				twemojiScript = document.createElement('script');
				twemojiScript.src = 'https://twemoji.maxcdn.com/twemoji.min.js';
				twemojiScript.onload = function() {
					twemoji = $window.twemoji;
					options && Array.prototype.forEach.call(clEditorSvc.previewElt.querySelectorAll('.cl-preview-section'), function(elt) {
						twemoji.parse(elt);
					});
				};
				twemojiScript.onerror = function() {
					twemojiScript = undefined;
				};
				document.head.appendChild(twemojiScript);
			}

			clEditorSvc.onMarkdownInit(10, function(markdown) {
				if (options) {
					var emojiOptions = {};
					if(!options.shortcuts) {
						emojiOptions.shortcuts = {};
					}
					markdown.use($window.markdownitEmoji, emojiOptions);
					!twemojiScript && initTwemoji();
					clEditorSvc.onAsyncPreview(function(cb) {
						twemoji && Array.prototype.forEach.call(clEditorSvc.previewElt.querySelectorAll('.cl-preview-section.modified'), function(elt) {
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
					var newOptions = fileProperties['ext:emoji'] === '1' ? {
						shortcuts: fileProperties['ext:emoji:shortcuts'] !== '0'
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
