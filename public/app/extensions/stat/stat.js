angular.module('classeur.extensions.stat', [])
	.directive('clStat', function() {
		function Stat(name, regex) {
			this.name = name;
			this.regex = new RegExp(regex, 'g');
		}

		var stats = [
			new Stat('Characters', '\\S'),
			new Stat('Words', '\\S+'),
			new Stat('Paragraphs', '\\S.*'),
		];

		return {
			restrict: 'E',
			scope: true,
			templateUrl: 'app/extensions/stat/stat.html',
			link: function(scope) {
				scope.stats = stats;
				scope.$watch('cledit.previewText', function(text) {
					stats.forEach(function(stat) {
						stat.value = (text.match(stat.regex) || []).length;
					});
				});
			}
		};
	});
