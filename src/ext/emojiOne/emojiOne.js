angular.module('classeur.ext.emojiOne', [])
	.directive('clEmojiOne', function($window, clEditorSvc) {

		var options;

		clEditorSvc.onInitConverter(85, function(converter) {
			$window.emojione.ascii = !!options && options.ascii;
			options && converter.hooks.chain("postConversion", function(html) {
				return $window.emojione.shortnameToImage(html);
			});
		});

		return {
			restrict: 'A',
			link: function(scope) {
				function checkEnabled() {
					var fileProperties = scope.currentFileDao.contentDao.properties;
					var newOptions = fileProperties['ext:emojione'] === '1' ? {
						ascii: fileProperties['ext:emojione:ascii'] === '1'
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
		};
	});
